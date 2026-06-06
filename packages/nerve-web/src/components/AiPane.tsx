import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { setCompileResult } from "../lib/compile-client.js"
import { getApiKey, runAgentTurn, setApiKey, type AgentEvent, type ChatTurn } from "../lib/ai.js"

interface ToolPill {
  readonly name: string
  readonly status: "running" | "ok" | "failed"
  readonly detail?: string
}

interface Message extends ChatTurn {
  readonly pills?: ReadonlyArray<ToolPill>
}

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
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }])

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
          <span className="spec-tag">[AI COPILOT]</span>
          <p>
            Edits your harness through compile-verified patches. Calls go directly from your
            browser to Anthropic — the key is stored locally and sent nowhere else.
          </p>
          <input
            type="password"
            placeholder="sk-ant-…"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyDraft.startsWith("sk-ant-")) {
                setApiKey(keyDraft)
                setHasKey(true)
              }
            }}
          />
          <button
            className="compile-button"
            disabled={!keyDraft.startsWith("sk-ant-")}
            onClick={() => {
              setApiKey(keyDraft)
              setHasKey(true)
            }}
          >
            Save key
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ai-pane">
      <div className="ai-header">
        <span className="spec-tag">[AI COPILOT]</span>
        <button
          className="ai-key-clear"
          title="Forget API key"
          onClick={() => {
            setApiKey("")
            setHasKey(false)
          }}
        >
          key ✕
        </button>
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
          <div key={i} className={`ai-msg ${m.role}`}>
            {m.pills !== undefined && m.pills.length > 0 && (
              <div className="ai-pills">
                {m.pills.map((p, j) => (
                  <span key={j} className={`ai-pill ${p.status}`} title={p.detail}>
                    {p.status === "running" ? "⋯ " : p.status === "ok" ? "✓ " : "✕ "}
                    {p.name === "edit_harness_source" ? "patch" : p.name === "rewrite_harness_source" ? "rewrite" : p.name}
                  </span>
                ))}
              </div>
            )}
            {m.text !== "" && <div className="ai-text">{m.text}</div>}
            {m.role === "assistant" && m.text === "" && (m.pills === undefined || m.pills.length === 0) && busy && i === messages.length - 1 && (
              <div className="ai-text thinking">thinking…</div>
            )}
          </div>
        ))}
      </div>
      <div className="ai-input">
        <textarea
          rows={2}
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
        <button className="compile-button" disabled={busy || input.trim() === ""} onClick={send}>
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  )
}
