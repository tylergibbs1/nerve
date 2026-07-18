/**
 * Selected-object inspector (PRD §11.3): a quiet overlay card describing
 * whatever is selected in any sheet, with a jump to its source definition.
 */
import { useEffect } from "react"
import type { Hir } from "@grayhaven/nerve"
import { Button } from "@/components/ui/button"
import { jumpToSource } from "../lib/editor-registry.js"
import { setSelection, useSelection, type Selection } from "../lib/selection.js"

const rows = (hir: Hir, sel: Selection): Array<readonly [string, string]> => {
  if (sel.kind === "wire") {
    const w = hir.wires.find((x) => x.id === sel.ref)
    if (w === undefined) return []
    const end = (e: typeof w.from): string =>
      "connector" in e ? `${e.connector}.${e.pin}` : e.splice
    return [
      ["wire", w.id],
      ["from", end(w.from)],
      ["to", end(w.to)],
      ...(w.signal !== undefined ? [["signal", w.signal] as const] : []),
      ...(w.gauge !== undefined ? [["gauge", w.gauge] as const] : []),
      ...(w.color !== undefined ? [["color", w.color] as const] : []),
      ...(w.length !== undefined ? [["length", `${w.length} ${hir.harness.units}`] as const] : []),
      ...(w.twistGroup !== undefined ? [["twist", w.twistGroup] as const] : [])
    ]
  }
  if (sel.kind === "connector" || sel.kind === "pin") {
    const c = hir.connectors.find((x) => x.ref === sel.ref)
    if (c === undefined) return []
    const base: Array<readonly [string, string]> = [
      ["connector", c.ref],
      ["mpn", c.mpn],
      ...(c.family !== undefined ? [["family", c.family] as const] : []),
      ...(c.gender !== undefined ? [["gender", c.gender] as const] : []),
      ["pins", String(c.pinCount)]
    ]
    if (sel.kind === "pin") {
      const p = c.pins.find((x) => x.pin === sel.pin)
      return [
        ["pin", `${c.ref}.${sel.pin ?? ""}`],
        ...(p?.signal !== undefined ? [["signal", p.signal] as const] : []),
        ["mpn", c.mpn]
      ]
    }
    return base
  }
  const s = hir.splices.find((x) => x.id === sel.ref)
  if (s === undefined) return []
  return [
    ["splice", s.id],
    ...(s.type !== undefined ? [["type", s.type] as const] : []),
    ...(s.branch !== undefined ? [["branch", s.branch] as const] : [])
  ]
}

export function Inspector({ hir }: { hir: Hir }) {
  const sel = useSelection()
  // Escape clears the selection while the inspector is showing — unless a
  // text field has focus (Escape there belongs to the field/editor).
  useEffect(() => {
    if (sel === undefined) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const t = e.target
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return
      }
      setSelection(undefined)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [sel])
  if (sel === undefined) return null
  const data = rows(hir, sel)
  if (data.length === 0) return null
  const sourceId = sel.kind === "pin" ? sel.ref : sel.ref
  return (
    <div className="inspector" role="region" aria-label="Selected object">
      <div className="inspector-head">
        <span className="spec-tag">{sel.kind}</span>
        <Button
          variant="ghost"
          size="xs"
          aria-label="Close inspector"
          onClick={() => setSelection(undefined)}
        >
          ✕
        </Button>
      </div>
      <dl>
        {data.map(([k, v]) => (
          <div key={k + v}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Button variant="ghost" size="xs" onClick={() => jumpToSource(sourceId)}>
        View source ↗
      </Button>
    </div>
  )
}
