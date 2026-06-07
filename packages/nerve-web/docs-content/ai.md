# Compile-verified edits.

The editor's left pane is an agent that changes the harness for you: "add a third sensor on the CAN bus", "swap W2 to 18AWG and fix whatever breaks". It is not a chat box that pastes code: every proposed edit is a structured patch.

## The loop

Each tool call the agent makes is compiled in the local worker **before** it lands. Diagnostics feed back into the loop: if a patch introduces `HK-*` errors, the agent sees them and must converge to a clean compile; it cannot bypass rule failures. Applied edits write through the editor and the diagram live, exactly like keystrokes.

## Keys and privacy

There is no server. Your browser calls Anthropic directly with an API key you paste into the pane; the key lives in localStorage and is sent nowhere else. The "key ✕" button forgets it.

Try it in [the editor](/projects): open a project and ask for a change while watching the diagram.
