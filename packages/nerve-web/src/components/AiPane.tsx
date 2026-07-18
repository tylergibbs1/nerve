import { memo, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { setCompileResult } from "../lib/compile-client.js"
import { getApiKey, runAgentTurn, setApiKey, type AgentEvent, type ChatTurn } from "../lib/ai.js"
import { useMinimumLoading } from "../lib/useMinimumLoading.js"
import { Button } from "../ui/button.js"
import { Badge } from "../ui/badge.js"
import { Input } from "../ui/input.js"
import { Textarea } from "../ui/textarea.js"

interface ToolPill {
  readonly name: string
  readonly status: "running" | "ok" | "failed"
  readonly detail?: string
}

interface Message extends ChatTurn {
  readonly id: string
  readonly pills?: ReadonlyArray<ToolPill>
}

// Streaming replaces only the last array element, so memo lets every earlier
// row skip re-rendering on each token.
const MessageRow = memo(function MessageRow({
  message,
  showThinking
}: {
  message: Message
  showThinking: boolean
}) {
  return (
    <div className={`ai-msg ${message.role}`}>
      {message.pills !== undefined && message.pills.length > 0 && (
        <div className="ai-pills">
          {message.pills.map((p, j) => (
            <Badge
              key={j}
              variant={p.status === "ok" ? "default" : p.status === "failed" ? "destructive" : "secondary"}
              className={p.status === "running" ? "ai-pill-running" : undefined}
              title={p.detail}
            >
              {p.status === "running" ? "⋯ " : p.status === "ok" ? "✓ " : "✕ "}
              {p.name === "edit_harness_source" ? "patch" : p.name === "rewrite_harness_source" ? "rewrite" : p.name}
            </Badge>
          ))}
        </div>
      )}
      {message.text !== "" && <div className="ai-text">{message.text}</div>}
      {message.role === "assistant" && message.text === "" && (message.pills === undefined || message.pills.length === 0) && showThinking && (
        <div className="ai-text thinking">thinking…</div>
      )}
    </div>
  )
})

/**
 * AI copilot pane (datum's chat-pane pattern, PRD §12). Edits the harness
 * through compile-verified tools; the source pane and render pane update
 * live as patches land.
 */
export function AiPane({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [hasKey, setHasKey] = useState(() => getApiKey() !== undefined)
  const [keyDraft, setKeyDraft] = useState("")
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const showBusy = useMinimumLoading(busy)
  const threadRef = useRef<HTMLDivElement>(null)

  // Reset the thread when switching projects.
  useEffect(() => {
    setMessages([])
  }, [projectId])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (text === "" || busy) return
    setInput("")
    setBusy(true)
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, text: m.text }))
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text },
      { id: crypto.randomUUID(), role: "assistant", text: "" }
    ])

    const onEvent = (e: AgentEvent) => {
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last === undefined || last.role !== "assistant") return prev
        if (e.type === "text") {
          next[next.length - 1] = { ...last, text: last.text + (e.text ?? "") }
        } else if (e.type === "tool" && e.tool !== undefined) {
          const pills = [...(last.pills ?? [])]
          let idx = -1
          for (let k = pills.length - 1; k >= 0; k--) {
            const candidate = pills[k]
            if (candidate !== undefined && candidate.name === e.tool.name && candidate.status === "running") {
              idx = k
              break
            }
          }
          const pill: ToolPill = { name: e.tool.name, status: e.tool.status, ...(e.tool.detail !== undefined ? { detail: e.tool.detail } : {}) }
          if (e.tool.status === "running" || idx === -1) pills.push(pill)
          else pills[idx] = pill
          next[next.length - 1] = { ...last, pills }
        } else if (e.type === "error") {
          next[next.length - 1] = { ...last, text: `${last.text}\n\n⚠ ${e.text ?? "error"}`.trim() }
        }
        return next
      })
      if (e.type === "done" || e.type === "error") setBusy(false)
      // A failed turn gives the prompt back for editing and resend, unless
      // the user already started typing something new.
      if (e.type === "error") setInput((current) => (current === "" ? text : current))
    }

    void runAgentTurn(projectId, history, text, onEvent, (result) => {
      // Land the verified compile in the shared cache: diagram, tables and
      // diagnostics all update live, exactly like a manual editor compile.
      setCompileResult(queryClient, projectId, result)
    })
  }

  if (!hasKey) {
    return (
      <div className="ai-pane">
        <div className="ai-setup">
          <span className="spec-tag">Assistant</span>
          <p>
            Edits your harness for you; every change is compiled and checked before it lands.
            Requests go directly from your browser to OpenAI. The key is stored locally and
            sent nowhere else.
          </p>
          <Input
            type="password"
            placeholder="sk-…"
            aria-label="OpenAI API key"
            className="h-9 text-sm"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyDraft.startsWith("sk-")) {
                setApiKey(keyDraft)
                setHasKey(true)
              }
            }}
          />
          <Button
            size="xs"
            disabled={!keyDraft.startsWith("sk-")}
            onClick={() => {
              setApiKey(keyDraft)
              setHasKey(true)
            }}
          >
            Save key
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="ai-pane">
      <div className="ai-header">
        <span className="spec-tag">Assistant</span>
        <Button
          variant="ghost"
          size="xs"
          className="h-auto p-0 text-[11px]"
          onClick={() => {
            setApiKey("")
            setHasKey(false)
          }}
        >
          Forget key
        </Button>
      </div>
      <div className="ai-thread" ref={threadRef}>
        {messages.length === 0 && (
          <p className="ai-hint">
            Ask for harness changes in plain language — “add a third sensor on the CAN bus”,
            “swap W2 to 18AWG and fix whatever breaks”. Every edit is compiled and rule-checked
            before it lands; watch the diagram update live.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageRow key={m.id} message={m} showThinking={showBusy && i === messages.length - 1} />
        ))}
      </div>
      <div className="ai-input">
        <Textarea
          rows={2}
          className="min-h-0 flex-1 resize-none px-2.5 py-1.5 text-sm leading-snug"
          aria-label="Describe a change"
          placeholder={busy ? "Working…" : "Describe a change…"}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <Button size="xs" disabled={busy || input.trim() === ""} onClick={send}>
          {busy ? "…" : "Send"}
        </Button>
      </div>
    </div>
  )
}
