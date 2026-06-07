/**
 * HIR satellite outputs (PRD §9.3): machine-readable JSON views derived
 * from HIR. Pure, deterministic (2-space JSON, canonical HIR ordering).
 *
 * - graph.json: connectivity graph — nodes (connectors, pins, splices),
 *   edges (wires), and computed nets for tooling that wants topology
 *   without parsing the full HIR.
 * - render-layout.json: the DrawingIR for every sheet — the exact layout
 *   the SVG/PDF renderers consumed, so external tools can re-render or
 *   diff geometry.
 * - bom/cut-list/label-schedule/diagnostics.json: JSON twins of the CSVs.
 */
import { isPinEndpoint, type Hir, type HirEndpoint } from "@grayhaven/nerve"
import { schematicDrawing } from "./svg.js"
import { boardDrawing } from "./board.js"
import { connectorFacesDrawing } from "./faces.js"
import { bomTable, cutListTable, labelScheduleTable, type CutListOptions } from "./csv.js"

const stringify = (value: unknown): string => JSON.stringify(value, null, 2) + "\n"

const endpointNode = (e: HirEndpoint): string =>
  isPinEndpoint(e) ? `connector:${e.connector}.pin:${e.pin}` : `splice:${e.splice}`

export const graphJson = (hir: Hir): string => {
  const nodes = [
    ...hir.connectors.flatMap((c) => [
      { id: `connector:${c.ref}`, kind: "connector", ref: c.ref, mpn: c.mpn },
      ...c.pins.map((p) => ({
        id: `connector:${c.ref}.pin:${p.pin}`,
        kind: "pin",
        connector: c.ref,
        pin: p.pin,
        ...(p.signal !== undefined ? { signal: p.signal } : {})
      }))
    ]),
    ...hir.splices.map((s) => ({ id: `splice:${s.id}`, kind: "splice", splice: s.id }))
  ]
  const edges = hir.wires.map((w) => ({
    id: `wire:${w.id}`,
    from: endpointNode(w.from),
    to: endpointNode(w.to),
    ...(w.signal !== undefined ? { signal: w.signal } : {})
  }))
  // Nets: union of endpoints connected by wires (splices merge nets).
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string): void => {
    parent.set(find(a), find(b))
  }
  for (const w of hir.wires) union(endpointNode(w.from), endpointNode(w.to))
  const members = new Map<string, Array<string>>()
  for (const w of hir.wires) {
    for (const e of [w.from, w.to]) {
      const node = endpointNode(e)
      const root = find(node)
      const list = members.get(root) ?? []
      if (!list.includes(node)) list.push(node)
      members.set(root, list)
    }
  }
  const nets = [...members.values()]
    .map((m) => [...m].sort())
    .sort((a, b) => (a[0]! < b[0]! ? -1 : 1))
    .map((m, i) => ({ id: `net-${i + 1}`, nodes: m }))
  return stringify({ schemaVersion: hir.schemaVersion, harness: hir.harness, nodes, edges, nets })
}

export const renderLayoutJson = (hir: Hir): string =>
  stringify({
    schemaVersion: hir.schemaVersion,
    harness: hir.harness,
    sheets: {
      schematic: schematicDrawing(hir),
      board: boardDrawing(hir),
      connectorFaces: connectorFacesDrawing(hir)
    }
  })

export const diagnosticsJson = (hir: Hir): string =>
  stringify({ schemaVersion: hir.schemaVersion, harness: hir.harness, diagnostics: hir.diagnostics })

const tableJson = (hir: Hir, t: { headers: ReadonlyArray<string>; rows: ReadonlyArray<ReadonlyArray<unknown>> }): string =>
  stringify({
    harness: hir.harness,
    rows: t.rows.map((r) => Object.fromEntries(t.headers.map((h, i) => [h, r[i]])))
  })

export const bomJsonSatellite = (hir: Hir): string => tableJson(hir, bomTable(hir))

export const cutListJsonSatellite = (hir: Hir, options: CutListOptions = {}): string =>
  tableJson(hir, cutListTable(hir, options))

export const labelScheduleJsonSatellite = (hir: Hir): string =>
  tableJson(hir, labelScheduleTable(hir))
