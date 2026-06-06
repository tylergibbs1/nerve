/**
 * AI harness agent (PRD §12, datum's parametric-agent pattern).
 *
 * The agent edits harness source through two tools — a surgical patch and a
 * full rewrite — and every tool call is verified by the compile worker
 * before it lands. Diagnostics feed back into the loop, so the AI cannot
 * bypass HK-* rule failures (§12.3): it either converges to a clean compile
 * or surfaces the remaining diagnostics for review.
 *
 * No server: this is a static SPA, so calls go browser → Anthropic with a
 * user-supplied API key (kept in localStorage, sent only to Anthropic).
 */
// Import the bare client (not the root index): the root re-exports Node-only
// helpers (node:crypto) that break the browser bundle. Types are erased.
import { Anthropic } from "@anthropic-ai/sdk/client"
import { APIError, AuthenticationError } from "@anthropic-ai/sdk/error"
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages"
import { compileSource, countDiagnostics } from "./compile-client.js"
import { getSource, setSource } from "./sources.js"
import type { CompileResult } from "./compile-types.js"

const KEY_STORAGE = "nerve:anthropic-key"
const MODEL = "claude-opus-4-8"
const MAX_TOOL_ROUNDS = 6

export const getApiKey = (): string | undefined => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? undefined
  } catch {
    return undefined
  }
}

export const setApiKey = (key: string): void => {
  try {
    if (key === "") localStorage.removeItem(KEY_STORAGE)
    else localStorage.setItem(KEY_STORAGE, key)
  } catch {
    // privacy mode: session-only
  }
}

const TOOLS: Tool[] = [
  {
    name: "edit_harness_source",
    description:
      "Apply a surgical patch to the current harness source. Use for focused changes. " +
      "old_string must appear EXACTLY ONCE in the source (include surrounding lines to disambiguate). " +
      "The result is compiled immediately; you get back the diagnostics.",
    input_schema: {
      type: "object",
      properties: {
        old_string: {
          type: "string",
          description: "Exact text to replace — must be unique in the source"
        },
        new_string: { type: "string", description: "Replacement text" }
      },
      required: ["old_string", "new_string"]
    }
  },
  {
    name: "rewrite_harness_source",
    description:
      "Replace the entire harness source. Use only when changes are too extensive for patches " +
      "(roughly >30% of the file). The result is compiled immediately; you get back the diagnostics.",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "The complete new TypeScript harness source" }
      },
      required: ["source"]
    }
  }
]

const systemPrompt = (projectId: string): string =>
  `You are the Grayhaven Nerve harness agent — an AI copilot inside a wiring-harness design tool where harnesses are TypeScript programs ("harnesses as code").

The DSL (imported from "@grayhaven/nerve"): harness(), connector(id, part, {pins}), wire(id, from, to, {gauge, color, length}), branch(), splice(id, {type}), cable(id, {conductors, shield}), label(). Endpoints are written "CONNECTOR.pin" (e.g. "J1.3") or "SPLICE" for splice nodes. Gauges are strings like "20AWG". Connector parts declare wireGaugeRange {min, max} — wires must fit within it.

Rules of engagement:
- Each turn you receive the CURRENT source and its diagnostics. Make the user's change with the smallest edit that works: prefer edit_harness_source; rewrite only for sweeping changes.
- Every tool call compiles immediately in a local worker and returns diagnostics. If your edit introduces errors (HK-* codes), fix them before finishing — you may not leave the harness worse than you found it. Pre-existing warnings you weren't asked to fix may remain.
- The user watches the diagram update live as your edits land. Keep your prose to one or two sentences per turn; the diff and the diagram speak for themselves.
- Current project: ${projectId}. Do not invent connector part numbers — reuse parts already defined in the source unless asked to add new ones.`

export interface AgentEvent {
  readonly type: "text" | "tool" | "compile" | "done" | "error"
  readonly text?: string
  readonly tool?: { name: string; status: "running" | "ok" | "failed"; detail?: string }
  readonly compile?: { errors: number; warnings: number }
}

export interface ChatTurn {
  readonly role: "user" | "assistant"
  readonly text: string
  readonly tools?: ReadonlyArray<{ name: string; status: "ok" | "failed"; detail?: string }>
}

const diagnosticsReport = (result: CompileResult): string => {
  const { errors, warnings } = countDiagnostics(result.hir.diagnostics)
  if (result.hir.diagnostics.length === 0) return "Compiled clean: 0 errors, 0 warnings."
  const lines = result.hir.diagnostics
    .slice(0, 20)
    .map((d) => `${d.severity.toUpperCase()} ${d.code} ${d.target ?? ""}: ${d.message}`)
  return `Compiled: ${errors} error(s), ${warnings} warning(s).\n${lines.join("\n")}`
}

/** Apply a tool call, compile-verify it, and return the tool_result text. */
const applyTool = async (
  projectId: string,
  name: string,
  input: unknown
): Promise<{ ok: boolean; report: string; result?: CompileResult }> => {
  const current = getSource(projectId)
  let next: string
  if (name === "edit_harness_source") {
    const { old_string, new_string } = input as { old_string: string; new_string: string }
    const first = current.indexOf(old_string)
    if (first === -1) {
      return { ok: false, report: "old_string not found in source. Re-read the current source and retry with exact text." }
    }
    if (current.indexOf(old_string, first + 1) !== -1) {
      return { ok: false, report: "old_string is not unique. Include more surrounding context to disambiguate." }
    }
    next = current.slice(0, first) + new_string + current.slice(first + old_string.length)
  } else if (name === "rewrite_harness_source") {
    next = (input as { source: string }).source
  } else {
    return { ok: false, report: `Unknown tool: ${name}` }
  }

  try {
    const result = await compileSource(projectId, next)
    // The edit compiles — land it (PRD §12: reviewable, live, rule-checked).
    setSource(projectId, next)
    return { ok: true, report: diagnosticsReport(result), result }
  } catch (e) {
    return {
      ok: false,
      report: `Source failed to compile (not applied): ${e instanceof Error ? e.message : String(e)}`
    }
  }
}

/**
 * One user turn through the agent loop: stream text, execute tools with
 * compile verification, feed diagnostics back, repeat until end_turn.
 */
export const runAgentTurn = async (
  projectId: string,
  history: ReadonlyArray<ChatTurn>,
  userMessage: string,
  onEvent: (e: AgentEvent) => void,
  onSourceApplied: (result: CompileResult) => void
): Promise<void> => {
  const apiKey = getApiKey()
  if (apiKey === undefined) {
    onEvent({ type: "error", text: "No API key configured." })
    return
  }
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const messages: MessageParam[] = [
    ...history.map((t): MessageParam => ({ role: t.role, content: t.text || "(applied edits)" })),
    {
      role: "user",
      content: `${userMessage}\n\n<current_source>\n${getSource(projectId)}\n</current_source>`
    }
  ]

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: systemPrompt(projectId),
        tools: TOOLS,
        messages
      })
      stream.on("text", (delta) => onEvent({ type: "text", text: delta }))
      const message = await stream.finalMessage()

      if (message.stop_reason !== "tool_use") {
        onEvent({ type: "done" })
        return
      }

      messages.push({ role: "assistant", content: message.content })
      const toolResults: ToolResultBlockParam[] = []
      for (const block of message.content) {
        if (block.type !== "tool_use") continue
        onEvent({ type: "tool", tool: { name: block.name, status: "running" } })
        const outcome = await applyTool(projectId, block.name, block.input)
        if (outcome.ok && outcome.result !== undefined) {
          onSourceApplied(outcome.result)
          const counts = countDiagnostics(outcome.result.hir.diagnostics)
          onEvent({ type: "compile", compile: counts })
        }
        const detail = outcome.report.split("\n")[0]
        onEvent({
          type: "tool",
          tool: {
            name: block.name,
            status: outcome.ok ? "ok" : "failed",
            ...(detail !== undefined ? { detail } : {})
          }
        })
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: outcome.report,
          ...(outcome.ok ? {} : { is_error: true as const })
        })
      }
      messages.push({ role: "user", content: toolResults })
    }
    onEvent({ type: "error", text: `Stopped after ${MAX_TOOL_ROUNDS} tool rounds without finishing.` })
  } catch (e) {
    if (e instanceof AuthenticationError) {
      onEvent({ type: "error", text: "Invalid API key — check it in the panel header." })
    } else if (e instanceof APIError) {
      onEvent({ type: "error", text: `Anthropic API error ${e.status}: ${e.message}` })
    } else {
      onEvent({ type: "error", text: e instanceof Error ? e.message : String(e) })
    }
  }
}
