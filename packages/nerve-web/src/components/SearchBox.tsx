/**
 * Workspace search (PRD §9.6): wires by id/signal, connectors by
 * ref/mpn/family, splices by id. Selecting a result sets the global
 * selection and navigates to the sheet that shows it.
 */
import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { Hir } from "@grayhaven/nerve"
import { Input } from "../ui/input.js"
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
  const navigate = useNavigate()
  const hits = useMemo(() => (query.length >= 2 ? findHits(hir, query) : []), [hir, query])
  return (
    <div className="searchbox">
      <Input
        type="search"
        placeholder="Search wires, signals, parts…"
        aria-label="Search the harness"
        className="h-7 w-52 text-xs"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {hits.length > 0 && (
        <ul className="search-results" role="listbox">
          {hits.map((h) => (
            <li key={h.sel.kind + h.label}>
              <button
                type="button"
                onClick={() => {
                  setSelection(h.sel)
                  setQuery("")
                  void navigate({
                    to: `/projects/$projectId/${h.tab}`,
                    params: { projectId }
                  })
                }}
              >
                <span className="hit-label">{h.label}</span>
                <span className="hit-detail">{h.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
