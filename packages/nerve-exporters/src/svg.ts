/**
 * SVG schematic renderer (PRD §9.5.1).
 *
 * Renders logical connectivity from HIR only: connector blocks with pin
 * rows, wires as colored curves with ID/gauge annotations, and error
 * highlighting for wires referenced by error diagnostics.
 *
 * Layout is intentionally simple and fully deterministic (no randomness, no
 * timestamps): connectors alternate between a left and right column in
 * canonical HIR order. Interactive layout (pan/zoom/selection) is the web
 * editor's job; this renderer owns exported artifacts.
 */
import type { Hir } from "@grayhaven/nerve"

const BOX_W = 180
const ROW_H = 20
const HEADER_H = 40
const MARGIN = 48
const COL_GAP = 380
const V_GAP = 48
const TITLE_H = 64

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/** Map authored color names to visible SVG strokes. */
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

export const schematicSvg = (hir: Hir): string => {
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
  const height = Math.max(
    ...[...placed.values()].map((p) => p.y + p.height),
    TITLE_H + MARGIN
  ) + MARGIN

  const errorWires = new Set(
    hir.diagnostics
      .filter((d) => d.severity === "error" && d.target?.startsWith("wire:"))
      .map((d) => d.target!.slice("wire:".length))
  )

  const parts: Array<string> = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12">`,
    `<rect width="${width}" height="${height}" fill="#fafafa"/>`,
    // Title block
    `<text x="${MARGIN}" y="28" font-size="18" font-weight="bold" fill="#111">${esc(hir.harness.id)}</text>`,
    `<text x="${MARGIN}" y="48" fill="#555">rev ${esc(hir.harness.revision)} · units ${esc(hir.harness.units)} · HIR ${esc(hir.schemaVersion)}</text>`
  )

  // Wires under connector boxes' text but above background.
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
    const stroke = isError ? "#d11" : strokeFor(w.color)
    const dash = isError ? ` stroke-dasharray="6 3"` : ""
    parts.push(
      `<path d="M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}" fill="none" stroke="${esc(stroke)}" stroke-width="2"${dash}/>`
    )
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2 - 6
    const annotation = [w.id, w.gauge, w.twistGroup !== undefined ? "twisted" : undefined]
      .filter((s): s is string => s !== undefined)
      .join(" · ")
    parts.push(
      `<text x="${midX}" y="${midY}" text-anchor="middle" fill="${isError ? "#d11" : "#333"}">${esc(annotation)}</text>`
    )
  }

  // Connector blocks.
  for (const c of hir.connectors) {
    const p = placed.get(c.ref)
    if (p === undefined) continue
    parts.push(
      `<rect x="${p.x}" y="${p.y}" width="${BOX_W}" height="${p.height}" rx="6" fill="#ffffff" stroke="#333" stroke-width="1.5"/>`,
      `<text x="${p.x + 10}" y="${p.y + 18}" font-weight="bold" fill="#111">${esc(c.ref)}</text>`,
      `<text x="${p.x + 10}" y="${p.y + 33}" fill="#777" font-size="10">${esc(c.mpn)}${c.gender !== undefined ? ` · ${esc(c.gender)}` : ""}</text>`,
      `<line x1="${p.x}" y1="${p.y + HEADER_H - 2}" x2="${p.x + BOX_W}" y2="${p.y + HEADER_H - 2}" stroke="#ddd"/>`
    )
    for (const pin of c.pins) {
      const y = p.pinY.get(pin.pin)!
      const anchorX = p.side === "left" ? p.x + BOX_W : p.x
      parts.push(
        `<circle cx="${anchorX}" cy="${y}" r="3" fill="#333"/>`,
        `<text x="${p.x + 10}" y="${y + 4}" fill="#111">${esc(pin.pin)}</text>`,
        `<text x="${p.x + 34}" y="${y + 4}" fill="#555">${esc(pin.signal ?? "")}</text>`
      )
    }
  }

  parts.push("</svg>")
  return parts.join("\n") + "\n"
}
