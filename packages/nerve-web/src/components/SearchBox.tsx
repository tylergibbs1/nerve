/**
 * Workspace search (PRD §9.6): wires by id/signal, connectors by
 * ref/mpn/family, splices by id. Selecting a result sets the global
 * selection and navigates to the sheet that shows it.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { Hir } from "@grayhaven/nerve"
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { setSelection, type Selection } from "../lib/selection.js"

interface Hit {
  readonly label: string
  readonly detail: string
  readonly sel: Selection
  readonly tab: "diagram" | "connectors"
}

const findHits = (hir: Hir, query: string): Array<Hit> => {
  const q = query.toLowerCase()
  const hits: Array<Hit> = []
  for (const w of hir.wires) {
    if (w.id.toLowerCase().includes(q) || (w.signal?.toLowerCase().includes(q) ?? false)) {
      hits.push({
        label: w.id,
        detail: [w.signal, w.gauge].filter(Boolean).join(" · "),
        sel: { kind: "wire", ref: w.id },
        tab: "diagram"
      })
    }
  }
  for (const c of hir.connectors) {
    if (
      c.ref.toLowerCase().includes(q) ||
      c.mpn.toLowerCase().includes(q) ||
      (c.family?.toLowerCase().includes(q) ?? false)
    ) {
      hits.push({
        label: c.ref,
        detail: c.mpn,
        sel: { kind: "connector", ref: c.ref },
        tab: "connectors"
      })
    }
    for (const p of c.pins) {
      if (p.signal?.toLowerCase().includes(q) ?? false) {
        hits.push({
          label: `${c.ref}.${p.pin}`,
          detail: p.signal ?? "",
          sel: { kind: "pin", ref: c.ref, pin: p.pin },
          tab: "connectors"
        })
      }
    }
  }
  for (const s of hir.splices) {
    if (s.id.toLowerCase().includes(q)) {
      hits.push({ label: s.id, detail: s.type ?? "splice", sel: { kind: "splice", ref: s.id }, tab: "diagram" })
    }
  }
  return hits.slice(0, 8)
}

export function SearchBox({ hir, projectId }: { hir: Hir; projectId: string }) {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const hits = useMemo(() => (query.length >= 2 ? findHits(hir, query) : []), [hir, query])

  // Global focus shortcut: "/" only outside editable targets (the
  // CodeMirror editor is contentEditable). ⌘K belongs to the command
  // palette.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target
        const editable =
          t instanceof HTMLElement &&
          (t instanceof HTMLInputElement ||
            t instanceof HTMLTextAreaElement ||
            t instanceof HTMLSelectElement ||
            t.isContentEditable)
        if (!editable) {
          e.preventDefault()
          inputRef.current?.focus()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
  const go = (h: Hit) => {
    setSelection(h.sel)
    setQuery("")
    void navigate({
      to: `/projects/$projectId/${h.tab}`,
      params: { projectId }
    })
  }
  return (
    <div className="searchbox">
      {/* findHits already filters; cmdk owns arrow keys + enter. The label
          prop is the input's accessible name (cmdk wires aria-labelledby,
          which would override a plain aria-label). */}
      <Command shouldFilter={false} label="Search the harness" className="overflow-visible">
        <CommandInput
          ref={inputRef}
          placeholder="Search…  /"
          className="h-7 w-52 text-xs"
          value={query}
          onValueChange={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return
            e.preventDefault()
            if (query.length > 0) setQuery("")
            else inputRef.current?.blur()
          }}
        />
        {/* Always mounted so the input's aria-controls resolves; hidden
            (not unmounted) when unfocused or there is nothing to show.
            mousedown is prevented so clicking a result doesn't blur the
            input (and hide the list) before onSelect fires on click. */}
        <CommandList
          className="search-results"
          hidden={!focused || hits.length === 0}
          onMouseDown={(e) => e.preventDefault()}
        >
          {hits.map((h) => (
            <CommandItem
              key={h.sel.kind + h.label}
              value={h.sel.kind + h.label}
              onSelect={() => go(h)}
            >
              <span className="hit-label">{h.label}</span>
              <span className="hit-detail">{h.detail}</span>
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </div>
  )
}
