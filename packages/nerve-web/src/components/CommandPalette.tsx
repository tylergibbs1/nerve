/**
 * Global ⌘K command palette — navigation only (v1). Owns its open state;
 * Escape is handled on the input (not a window listener) so it can never
 * fight the Inspector's Escape handling. cmdk does the filtering.
 */
import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "../ui/command.js"

const PAGES = [
  { label: "Home", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Showcase", to: "/showcase" }
] as const

const WORKSPACES = [
  { label: "Motor controller", projectId: "motor-controller" },
  { label: "Sensor splice", projectId: "sensor-splice" },
  { label: "Robot platform", projectId: "robot-platform" }
] as const

// Mirrors the GROUPS nav in routes/docs.tsx.
const DOCS = [
  { label: "Quickstart", to: "/docs" },
  { label: "DSL", to: "/docs/dsl" },
  { label: "TypeScript SDK", to: "/docs/sdk" },
  { label: "Validation Rules", to: "/docs/rules" },
  { label: "HIR Schema", to: "/docs/hir" },
  { label: "Part Library", to: "/docs/library" },
  { label: "CLI", to: "/docs/cli" },
  { label: "Artifacts", to: "/docs/artifacts" },
  { label: "AI Copilot", to: "/docs/ai" },
  { label: "Production Lifecycle", to: "/docs/lifecycle" }
] as const

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  if (!open) return null

  const close = () => setOpen(false)

  return (
    <>
      <div className="palette-scrim" onClick={close} />
      <div className="palette-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <Command label="Command palette">
          <CommandInput
            autoFocus
            placeholder="Where to?"
            className="h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key !== "Escape") return
              e.preventDefault()
              e.stopPropagation()
              close()
            }}
          />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {PAGES.map((p) => (
              <CommandItem
                key={p.to}
                value={p.label}
                className="palette-item"
                onSelect={() => {
                  void navigate({ to: p.to })
                  close()
                }}
              >
                {p.label}
              </CommandItem>
            ))}
            {WORKSPACES.map((w) => (
              <CommandItem
                key={w.projectId}
                value={w.label}
                className="palette-item"
                onSelect={() => {
                  void navigate({
                    to: "/projects/$projectId/diagram",
                    params: { projectId: w.projectId }
                  })
                  close()
                }}
              >
                {w.label}
              </CommandItem>
            ))}
            {DOCS.map((d) => (
              <CommandItem
                key={d.to}
                value={d.label}
                className="palette-item"
                onSelect={() => {
                  void navigate({ to: d.to })
                  close()
                }}
              >
                {d.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </div>
    </>
  )
}
