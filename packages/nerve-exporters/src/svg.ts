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
import type { Hir } from "@grayhaven/nerve"
import { renderSvg, type DrawItem, type Drawing } from "./drawing.js"

const BOX_W = 180
const ROW_H = 20
const HEADER_H = 40
const MARGIN = 48
const COL_GAP = 380
const V_GAP = 48
const TITLE_H = 64

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

  const width = rightX + BOX_W + MARGIN
  const height =
    Math.max(...[...placed.values()].map((p) => p.y + p.height), TITLE_H + MARGIN) +
    MARGIN

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

  // Wires beneath connector boxes.
  for (const w of hir.wires) {
    const from = placed.get(w.from.connector)
    const to = placed.get(w.to.connector)
    const y1 = from?.pinY.get(w.from.pin)
    const y2 = to?.pinY.get(w.to.pin)
    if (from === undefined || to === undefined || y1 === undefined || y2 === undefined) {
      continue // structural diagnostics already flagged the dangling endpoint
    }
    const x1 = from.side === "left" ? from.x + BOX_W : from.x
    const x2 = to.side === "left" ? to.x + BOX_W : to.x
    const dx = Math.max(60, Math.abs(x2 - x1) / 3)
    const c1 = from.side === "left" ? x1 + dx : x1 - dx
    const c2 = to.side === "left" ? x2 + dx : x2 - dx
    const isError = errorWires.has(w.id)
    items.push({
      kind: "path",
      d: `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`,
      stroke: isError ? "#d11" : strokeFor(w.color),
      strokeWidth: 2,
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
      anchor: "middle"
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
        strokeWidth: 1.5
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
        { kind: "circle", cx: anchorX, cy: y, r: 3, fill: "#333" },
        { kind: "text", x: p.x + 10, y: y + 4, text: pin.pin, fill: "#111" },
        { kind: "text", x: p.x + 34, y: y + 4, text: pin.signal ?? "", fill: "#555" }
      )
    }
  }

  return { width, height, background: "#fafafa", items }
}

export const schematicSvg = (hir: Hir): string => renderSvg(schematicDrawing(hir))
