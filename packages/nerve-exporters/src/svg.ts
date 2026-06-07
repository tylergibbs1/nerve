/**
 * Schematic layout (PRD §9.5.1) emitting DrawingIR (§27.4).
 *
 * Renders logical connectivity from HIR only: connector blocks with pin
 * rows, wires as colored curves with ID/gauge annotations, and error
 * highlighting for wires referenced by error diagnostics.
 *
 * Layout is intentionally simple and fully deterministic: connectors
 * alternate between a left and right column in canonical HIR order.
 */
import { isPinEndpoint, type Hir, type HirEndpoint } from "@grayhaven/nerve"
import { renderSvg, type DrawItem, type Drawing } from "./drawing.js"

const BOX_W = 180
const ROW_H = 20
const HEADER_H = 40
const MARGIN = 48
const COL_GAP = 380
const V_GAP = 48
const TITLE_H = 64
/** Signals carried by at least this many wires render as net labels
 * (pin stubs + flags) instead of routed paths — the EDA convention that
 * keeps high-fanout power/bus nets from dominating the sheet. */
const NET_LABEL_FANOUT = 3
const STUB_LEN = 26

/** Map authored color names to visible strokes. */
const strokeFor = (color: string | undefined): string => {
  if (color === undefined) return "#888888"
  const map: Record<string, string> = {
    white: "#b8b8b8",
    yellow: "#c9a800",
    black: "#222222"
  }
  return map[color.toLowerCase()] ?? color
}

interface PlacedConnector {
  readonly ref: string
  readonly x: number
  readonly y: number
  readonly height: number
  readonly side: "left" | "right"
  readonly pinY: ReadonlyMap<string, number>
}

export const schematicDrawing = (hir: Hir): Drawing => {
  const left: Array<(typeof hir.connectors)[number]> = []
  const right: Array<(typeof hir.connectors)[number]> = []
  hir.connectors.forEach((c, i) => (i % 2 === 0 ? left : right).push(c))

  const place = (
    column: ReadonlyArray<(typeof hir.connectors)[number]>,
    side: "left" | "right",
    x: number
  ): Array<PlacedConnector> => {
    let y = TITLE_H + MARGIN
    return column.map((c) => {
      const height = HEADER_H + c.pins.length * ROW_H + 8
      const pinY = new Map(
        c.pins.map((p, i) => [p.pin, y + HEADER_H + (i + 0.5) * ROW_H])
      )
      const placed: PlacedConnector = { ref: c.ref, x, y, height, side, pinY }
      y += height + V_GAP
      return placed
    })
  }

  const rightX = MARGIN + BOX_W + COL_GAP
  const placed = new Map(
    [...place(left, "left", MARGIN), ...place(right, "right", rightX)].map(
      (p) => [p.ref, p]
    )
  )

  // Splices live in the channel between the columns.
  const spliceCenterX = MARGIN + BOX_W + COL_GAP / 2
  const splicePos = new Map(
    hir.splices.map((s, i) => [
      s.id,
      { x: spliceCenterX, y: TITLE_H + MARGIN + 60 + i * 70 }
    ])
  )

  const width = rightX + BOX_W + MARGIN
  const height =
    Math.max(
      ...[...placed.values()].map((p) => p.y + p.height),
      ...[...splicePos.values()].map((p) => p.y + 40),
      TITLE_H + MARGIN
    ) + MARGIN

  const errorWires = new Set(
    hir.diagnostics
      .filter((d) => d.severity === "error" && d.target?.startsWith("wire:"))
      .map((d) => d.target!.slice("wire:".length))
  )

  const items: Array<DrawItem> = [
    // Title block
    {
      kind: "text",
      x: MARGIN,
      y: 28,
      text: hir.harness.id,
      size: 18,
      weight: "bold",
      fill: "#111"
    },
    {
      kind: "text",
      x: MARGIN,
      y: 48,
      text: `rev ${hir.harness.revision} · units ${hir.harness.units} · HIR ${hir.schemaVersion}`,
      fill: "#555"
    }
  ]

  // Resolve an endpoint to its anchor point and curve direction.
  const anchorOf = (
    e: HirEndpoint
  ): { x: number; y: number; dir: 1 | -1 | 0 } | undefined => {
    if (isPinEndpoint(e)) {
      const p = placed.get(e.connector)
      const y = p?.pinY.get(e.pin)
      if (p === undefined || y === undefined) return undefined
      return p.side === "left"
        ? { x: p.x + BOX_W, y, dir: 1 }
        : { x: p.x, y, dir: -1 }
    }
    const s = splicePos.get(e.splice)
    return s !== undefined ? { x: s.x, y: s.y, dir: 0 } : undefined
  }

  // High-fanout nets become labeled stubs rather than routed paths.
  const signalCounts = new Map<string, number>()
  for (const w of hir.wires) {
    if (w.signal !== undefined) {
      signalCounts.set(w.signal, (signalCounts.get(w.signal) ?? 0) + 1)
    }
  }
  const labeledNets = new Set(
    [...signalCounts.entries()].filter(([, n]) => n >= NET_LABEL_FANOUT).map(([sig]) => sig)
  )

  // Wires beneath connector boxes.
  for (const w of hir.wires) {
    const a = anchorOf(w.from)
    const b = anchorOf(w.to)
    if (a === undefined || b === undefined) {
      continue // structural diagnostics already flagged the dangling endpoint
    }
    const { x: x1, y: y1 } = a
    const { x: x2, y: y2 } = b
    if (w.signal !== undefined && labeledNets.has(w.signal)) {
      const isError = errorWires.has(w.id)
      const stroke = isError ? "#d11" : strokeFor(w.color)
      const flagFill = isError ? "#d11" : "#333"
      const detail = [w.id, w.gauge].filter((t): t is string => t !== undefined).join(" · ")
      for (const end of [a, b]) {
        const dir = end.dir !== 0 ? end.dir : 1
        const sx = end.x + dir * STUB_LEN
        items.push(
          {
            kind: "line",
            x1: end.x,
            y1: end.y,
            x2: sx,
            y2: end.y,
            stroke,
            strokeWidth: 2,
            data: { wire: w.id },
            ...(isError ? { dash: [6, 3] } : {})
          },
          {
            kind: "text",
            x: sx + dir * 6,
            y: end.y - 2,
            text: dir === 1 ? `▸ ${w.signal}` : `${w.signal} ◂`,
            size: 10,
            weight: "bold",
            fill: flagFill,
            anchor: dir === 1 ? "start" : "end",
            data: { wire: w.id }
          },
          {
            kind: "text",
            x: sx + dir * 6,
            y: end.y + 9,
            text: detail,
            size: 8,
            fill: "#888",
            anchor: dir === 1 ? "start" : "end",
            data: { wire: w.id }
          }
        )
      }
      continue
    }
    const dx = Math.max(60, Math.abs(x2 - x1) / 3)
    const dir1 = a.dir !== 0 ? a.dir : x2 > x1 ? 1 : -1
    const dir2 = b.dir !== 0 ? b.dir : x1 > x2 ? 1 : -1
    const c1 = x1 + dir1 * dx
    const c2 = x2 + dir2 * dx
    const isError = errorWires.has(w.id)
    items.push({
      kind: "path",
      d: `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`,
      stroke: isError ? "#d11" : strokeFor(w.color),
      strokeWidth: 2,
      data: { wire: w.id },
      ...(isError ? { dash: [6, 3] } : {})
    })
    const annotation = [w.id, w.gauge, w.twistGroup !== undefined ? "twisted" : undefined]
      .filter((s): s is string => s !== undefined)
      .join(" · ")
    items.push({
      kind: "text",
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2 - 6,
      text: annotation,
      fill: isError ? "#d11" : "#333",
      anchor: "middle",
      data: { wire: w.id }
    })
  }

  // Connector blocks.
  for (const c of hir.connectors) {
    const p = placed.get(c.ref)
    if (p === undefined) continue
    items.push(
      {
        kind: "rect",
        x: p.x,
        y: p.y,
        w: BOX_W,
        h: p.height,
        rx: 6,
        fill: "#ffffff",
        stroke: "#333",
        strokeWidth: 1.5,
        data: { connector: c.ref }
      },
      { kind: "text", x: p.x + 10, y: p.y + 18, text: c.ref, weight: "bold", fill: "#111" },
      {
        kind: "text",
        x: p.x + 10,
        y: p.y + 33,
        text: `${c.mpn}${c.gender !== undefined ? ` · ${c.gender}` : ""}`,
        size: 10,
        fill: "#777"
      },
      {
        kind: "line",
        x1: p.x,
        y1: p.y + HEADER_H - 2,
        x2: p.x + BOX_W,
        y2: p.y + HEADER_H - 2,
        stroke: "#ddd"
      }
    )
    for (const pin of c.pins) {
      const y = p.pinY.get(pin.pin)!
      const anchorX = p.side === "left" ? p.x + BOX_W : p.x
      items.push(
        { kind: "circle", cx: anchorX, cy: y, r: 3, fill: "#333", data: { connector: c.ref, pin: pin.pin } },
        { kind: "text", x: p.x + 10, y: y + 4, text: pin.pin, fill: "#111" },
        { kind: "text", x: p.x + 34, y: y + 4, text: pin.signal ?? "", fill: "#555" }
      )
    }
  }

  // Splice symbols (PRD §9.5.1) above the wires that meet them.
  for (const s of hir.splices) {
    const pos = splicePos.get(s.id)
    if (pos === undefined) continue
    items.push(
      { kind: "circle", cx: pos.x, cy: pos.y, r: 6, fill: "#333", data: { splice: s.id } },
      {
        kind: "text",
        x: pos.x,
        y: pos.y - 12,
        text: `${s.id}${s.type !== undefined ? ` · ${s.type}` : ""}`,
        size: 11,
        fill: "#333",
        anchor: "middle"
      }
    )
  }

  return { width, height, background: "#fafafa", items }
}

export const schematicSvg = (hir: Hir): string => renderSvg(schematicDrawing(hir))
