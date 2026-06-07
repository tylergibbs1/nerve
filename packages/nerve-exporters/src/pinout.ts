/**
 * Pinout cards (PRD §9.5.2): per-connector wire-side cavity grids with
 * elbow leaders from every cavity to a label row — pin · signal · wire ·
 * gauge · terminal · seal. The artifact harness shops pin above the bench:
 * the faces view shows population at a glance; this view tells the
 * technician what lands in each cavity, including the §9.5.2 terminal and
 * seal part numbers the faces legend has no room for.
 *
 * Leader routing is deterministic and crossing-free by construction: the
 * top cavity row fans up, the bottom row fans down, and within a row the
 * leftmost cavity takes the level closest to the grid — a horizontal run
 * can then never intersect another cavity's vertical.
 */
import { isPinEndpoint, type Hir, type HirConnector, type HirWire } from "@grayhaven/nerve"
import { renderSvg, textWidth, type DrawItem, type Drawing } from "./drawing.js"

const CAV_R = 9
const PITCH = 26
const CARD_PAD = 18
const HEADER = 46
const MARGIN = 40
const TITLE_H = 64
const LABEL_H = 13
const LABEL_SIZE = 9
const LEADER_GAP = 24 // min horizontal run between label column and grid

const layoutOf = (c: HirConnector): { rows: number; columns: number } =>
  c.cavityLayout !== undefined
    ? c.cavityLayout
    : c.pinCount <= 6
      ? { rows: 1, columns: c.pinCount }
      : { rows: 2, columns: Math.ceil(c.pinCount / 2) }

interface CavityInfo {
  readonly pin: string
  readonly row: number
  readonly col: number
  readonly label: string
  readonly wire?: HirWire | undefined
}

export const pinoutDrawing = (hir: Hir): Drawing => {
  const wireAt = new Map<string, HirWire>()
  for (const w of hir.wires) {
    for (const e of [w.from, w.to]) {
      if (isPinEndpoint(e)) {
        const key = `${e.connector}:${e.pin}`
        if (!wireAt.has(key)) wireAt.set(key, w)
      }
    }
  }

  const items: Array<DrawItem> = [
    { kind: "text", x: MARGIN, y: 28, text: `${hir.harness.id} — pinout`, size: 18, weight: "bold", fill: "#111" },
    {
      kind: "text",
      x: MARGIN,
      y: 48,
      text: `rev ${hir.harness.revision} · wire side · HIR ${hir.schemaVersion}`,
      fill: "#555"
    }
  ]

  let y = TITLE_H + 8
  let maxRight = 0

  for (const c of hir.connectors) {
    const { rows, columns } = layoutOf(c)
    const byPin = new Map(c.pins.map((p) => [p.pin, p]))
    const cavities: Array<CavityInfo> = Array.from({ length: c.pinCount }, (_, i) => {
      const pin = String(i + 1)
      const assigned = byPin.get(pin)
      const w = wireAt.get(`${c.ref}:${pin}`)
      const label = [
        pin,
        assigned?.signal ?? "—",
        w?.id,
        w?.gauge,
        assigned?.terminal !== undefined ? `t:${assigned.terminal}` : undefined,
        assigned?.seal !== undefined ? `s:${assigned.seal}` : undefined
      ]
        .filter((s): s is string => s !== undefined)
        .join(" · ")
      return { pin, row: Math.floor(i / columns), col: i % columns, label, wire: w }
    })

    const topCavs = cavities.filter((cv) => cv.row === 0)
    const botCavs = cavities.filter((cv) => cv.row > 0)
    const labelColW = Math.max(120, ...cavities.map((cv) => textWidth(cv.label, LABEL_SIZE) + 8))

    const gridW = columns * PITCH
    const gridH = rows * PITCH
    const textX = CARD_PAD + labelColW
    const gridX = MARGIN + textX + LEADER_GAP
    const topBand = topCavs.length * LABEL_H + 10
    const botBand = botCavs.length > 0 ? botCavs.length * LABEL_H + 10 : 0
    const gridY = y + HEADER + topBand
    const cardW = textX + LEADER_GAP + gridW + CARD_PAD
    const cardH = HEADER + topBand + gridH + botBand + CARD_PAD

    items.push(
      { kind: "rect", x: MARGIN, y, w: cardW, h: cardH, rx: 6, fill: "#ffffff", stroke: "#333", strokeWidth: 1.5, data: { connector: c.ref } },
      { kind: "text", x: MARGIN + 12, y: y + 20, text: c.ref, weight: "bold", fill: "#111", data: { connector: c.ref } },
      {
        kind: "text",
        x: MARGIN + 12,
        y: y + 36,
        text: `${c.mpn}${c.gender !== undefined ? ` · ${c.gender}` : ""} · wire side`,
        size: 10,
        fill: "#777"
      }
    )

    const cavCenter = (cv: CavityInfo): { x: number; y: number } => ({
      x: gridX + cv.col * PITCH + PITCH / 2,
      y: gridY + cv.row * PITCH + PITCH / 2
    })

    // Cavity grid (wire side, not mirrored).
    for (const cv of cavities) {
      const { x: cx, y: cy } = cavCenter(cv)
      const populated = cv.wire !== undefined
      const data = {
        connector: c.ref,
        pin: cv.pin,
        ...(cv.wire !== undefined ? { wire: cv.wire.id } : {})
      }
      items.push(
        {
          kind: "path",
          d: `M ${cx - CAV_R} ${cy} A ${CAV_R} ${CAV_R} 0 1 0 ${cx + CAV_R} ${cy} A ${CAV_R} ${CAV_R} 0 1 0 ${cx - CAV_R} ${cy} Z`,
          stroke: populated ? "#333" : "#999",
          strokeWidth: populated ? 1.6 : 1.1,
          data
        },
        {
          kind: "text",
          x: cx,
          y: cy + 3.5,
          text: cv.pin,
          size: 9,
          weight: populated ? "bold" : "normal",
          fill: populated ? "#111" : "#888",
          anchor: "middle",
          data
        }
      )
    }

    // Elbow leaders + labels. Within a band, leftmost col = level closest
    // to the grid (crossing-free; see header comment).
    const lead = (cv: CavityInfo, levelIdx: number, dir: "up" | "down"): void => {
      const { x: cx, y: cy } = cavCenter(cv)
      const levelY =
        dir === "up"
          ? gridY - 10 - levelIdx * LABEL_H
          : gridY + gridH + 10 + levelIdx * LABEL_H
      const startY = dir === "up" ? cy - CAV_R : cy + CAV_R
      const data = {
        connector: c.ref,
        pin: cv.pin,
        ...(cv.wire !== undefined ? { wire: cv.wire.id } : {})
      }
      items.push(
        { kind: "line", x1: cx, y1: startY, x2: cx, y2: levelY, stroke: "#b0aca2", strokeWidth: 1, data },
        { kind: "line", x1: MARGIN + textX + 4, y1: levelY, x2: cx, y2: levelY, stroke: "#b0aca2", strokeWidth: 1, data },
        {
          kind: "text",
          x: MARGIN + textX,
          y: levelY + 3,
          text: cv.label,
          size: LABEL_SIZE,
          fill: "#333",
          anchor: "end",
          data
        }
      )
    }
    topCavs.forEach((cv, i) => lead(cv, i, "up"))
    botCavs.forEach((cv, i) => lead(cv, i, "down"))

    maxRight = Math.max(maxRight, MARGIN + cardW)
    y += cardH + 16
  }

  // Canvas covers whichever is wider: the cards or the title block.
  const width = Math.max(
    maxRight + MARGIN,
    MARGIN + textWidth(`${hir.harness.id} — pinout`, 18) + MARGIN
  )
  return { width, height: y + MARGIN, background: "#fafafa", items }
}

export const pinoutSvg = (hir: Hir): string => renderSvg(pinoutDrawing(hir))
