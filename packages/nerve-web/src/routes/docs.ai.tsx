import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/ai")({
  component: AiDocs
})

function AiDocs() {
  return (
    <>
      <span className="spec-tag">AI Copilot</span>
      <h1>Compile-verified edits.</h1>
      <p>
        The editor's left pane is an agent that changes the harness for you — "add a third
        sensor on the CAN bus", "swap W2 to 18AWG and fix whatever breaks". It is not a chat
        box that pastes code: every proposed edit is a structured patch.
      </p>
      <h2>The loop</h2>
      <p>
        Each tool call the agent makes is compiled in the local worker <em>before</em> it
        lands. Diagnostics feed back into the loop: if a patch introduces <code>HK-*</code>{" "}
        errors, the agent sees them and must converge to a clean compile — it cannot bypass
        rule failures. Applied edits write through the editor and the diagram live, exactly
        like keystrokes.
      </p>
      <h2>Keys and privacy</h2>
      <p>
        There is no server. Your browser calls Anthropic directly with an API key you paste
        into the pane; the key lives in localStorage and is sent nowhere else. The "key ✕"
        button forgets it.
      </p>
      <p>
        Try it in <Link to="/projects">the editor</Link> — open a project and ask for a change
        while watching the diagram.
      </p>
    </>
  )
}
