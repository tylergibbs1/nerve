/**
 * Harness-board / nailboard layout (PRD §9.5.3) emitting DrawingIR.
 *
 * Shows approximate physical branch layout for technicians: branch trunks
 * scaled from nominal lengths, connector endpoints, breakout children,
 * label positions with offsets, sleeve callouts, and length dimensions.
 * 1:1-scale print tiling (§33) comes later; this view targets screen and
 * packet pages.
 */
import type { Hir, HirBranch } from "@grayhaven/nerve"
import { diagnosticBadges } from "./badges.js"
import { renderSvg, scaleDrawing, textWidth, type DrawItem, type Drawing } from "./drawing.js"

// The board lays out in REAL MILLIMETERS (1 unit = 1 mm): the formboard
// windows it 1:1 with no rescale (calibration stays exact, no lossy
// round-trip), and boardSvg applies a display scale for screens.
const MARGIN = 48
const TITLE_H = 64
const TRUNK_GAP = 150
const DEFAULT_LEN_MM = 240
const NODE_W = 64
const NODE_H = 26

const lengthMm = (mm: number | undefined): number =>
  mm !== undefined ? Math.max(120, mm) : DEFAULT_LEN_MM

export const boardDrawing = (hir: Hir): Drawing => {
  const items: Array<DrawItem> = [
    {
      kind: "text",
      x: MARGIN,
      y: 28,
      text: `${hir.harness.id} — harness board`,
      size: 18,
      weight: "bold",
      fill: "#111"
    },
    {
      kind: "text",
      x: MARGIN,
      y: 48,
      text: `rev ${hir.harness.revision} · units ${hir.harness.units} · 1 unit = 1 ${hir.harness.units} (1:1)`,
      fill: "#555"
    }
  ]

  const roots = hir.branches.filter((b) => b.parent === undefined)
  const children = (parent: string): ReadonlyArray<HirBranch> =>
    hir.branches.filter((b) => b.parent === parent)

  let maxX = MARGIN + 400
  let y = TITLE_H + MARGIN + NODE_H

  // First drawn position of each entity — diagnostic badges anchor here.
  const connectorAt = new Map<string, { x: number; y: number }>()
  const spliceAt = new Map<string, { x: number; y: number }>()
  const branchAt = new Map<string, { x: number; y: number }>()

  const drawEndpoint = (x: number, cy: number, ref: string): void => {
    if (!connectorAt.has(ref)) connectorAt.set(ref, { x, y: cy })
    items.push(
      {
        kind: "rect",
        x: x - NODE_W / 2,
        y: cy - NODE_H / 2,
        w: NODE_W,
        h: NODE_H,
        rx: 4,
        fill: "#ffffff",
        stroke: "#333",
        strokeWidth: 1.5
      },
      {
        kind: "text",
        x,
        y: cy + 4,
        text: ref,
        weight: "bold",
        fill: "#111",
        anchor: "middle"
      }
    )
  }

  const drawBranch = (branch: HirBranch, x0: number, cy: number, depth: number): number => {
    const len = lengthMm(branch.nominalLength)
    const x1 = x0 + len
    maxX = Math.max(maxX, x1 + NODE_W)
    branchAt.set(branch.id, { x: x0 + len / 2, y: cy })

    // Trunk (thickness suggests the bundle).
    items.push({
      kind: "line",
      x1: x0,
      y1: cy,
      x2: x1,
      y2: cy,
      stroke: "#444",
      strokeWidth: 5
    })

    // Endpoints from the branch path: first at start, last at end,
    // intermediates evenly spaced.
    const path = branch.path
    path.forEach((ref, i) => {
      const t = path.length > 1 ? i / (path.length - 1) : 0
      drawEndpoint(x0 + t * len, cy, ref)
    })

    // Branch ID + sleeve callout above; length dimension below.
    const callout = [
      branch.id,
      branch.sleeve !== undefined ? `sleeve: ${branch.sleeve}` : undefined
    ]
      .filter((s): s is string => s !== undefined)
      .join(" · ")
    items.push({
      kind: "text",
      x: x0 + len / 2,
      y: cy - NODE_H / 2 - 8,
      text: callout,
      fill: "#333",
      anchor: "middle"
    })
    if (branch.nominalLength !== undefined) {
      const dimY = cy + NODE_H / 2 + 16
      items.push(
        { kind: "line", x1: x0, y1: dimY, x2: x1, y2: dimY, stroke: "#999" },
        { kind: "line", x1: x0, y1: dimY - 4, x2: x0, y2: dimY + 4, stroke: "#999" },
        { kind: "line", x1: x1, y1: dimY - 4, x2: x1, y2: dimY + 4, stroke: "#999" },
        {
          kind: "text",
          x: x0 + len / 2,
          y: dimY + 14,
          text: `${branch.nominalLength} ${hir.harness.units} nominal`,
          size: 11,
          fill: "#777",
          anchor: "middle"
        }
      )
    }

    // Labels attached to this branch (offset measured from offsetFrom end).
    for (const label of hir.labels.filter((l) => l.attachTo === branch.id)) {
      const fromEnd = label.offsetFrom !== undefined && label.offsetFrom === path[path.length - 1]
      const off = label.distance ?? 0
      const lx = fromEnd ? x1 - off : x0 + off
      const flagText = `${label.id}: ${label.text}`
      items.push(
        { kind: "line", x1: lx, y1: cy, x2: lx, y2: cy - 34, stroke: "#b07a00" },
        {
          kind: "rect",
          x: lx,
          y: cy - 50,
          // Measured, not the old hand-tuned 6.7px/char approximation.
          w: 16 + textWidth(flagText, 11),
          h: 16,
          fill: "#fff3d6",
          stroke: "#b07a00",
          strokeWidth: 1
        },
        {
          kind: "text",
          x: lx + 8,
          y: cy - 38,
          text: flagText,
          size: 11,
          fill: "#8a5a00"
        }
      )
    }

    // Splices located on this branch.
    for (const s of hir.splices.filter((sp) => sp.branch === branch.id)) {
      const sx = x0 + Math.min(s.location ?? 0, len)
      spliceAt.set(s.id, { x: sx, y: cy })
      items.push(
        { kind: "circle", cx: sx, cy: cy, r: 6, fill: "#333" },
        {
          kind: "text",
          x: sx,
          y: cy + NODE_H / 2 + 30,
          text: `${s.id}${s.type !== undefined ? ` (${s.type})` : ""}`,
          size: 11,
          fill: "#333",
          anchor: "middle"
        }
      )
    }

    // Breakout children: drop down-right from the breakout point.
    let childY = cy
    for (const child of children(branch.id)) {
      const bx = x0 + Math.min(child.breakoutDistance ?? 0, len)
      childY += TRUNK_GAP * 0.7
      items.push({
        kind: "line",
        x1: bx,
        y1: cy,
        x2: bx + 24,
        y2: childY,
        stroke: "#444",
        strokeWidth: 3
      })
      childY = drawBranch(child, bx + 24, childY, depth + 1)
    }
    return childY
  }

  if (roots.length === 0) {
    items.push({
      kind: "text",
      x: MARGIN,
      y,
      text: "No branches defined — add branch(...) entries to lay out the board.",
      fill: "#777"
    })
    y += 24
  }
  for (const root of roots) {
    y = drawBranch(root, MARGIN + NODE_W / 2, y + 30, 0) + TRUNK_GAP
  }

  // Diagnostic badges at the entities technicians actually look at.
  // Pins are not drawn on the board view — pin findings badge the
  // connector node; wire findings badge nothing here (no wire geometry).
  items.push(
    ...diagnosticBadges(hir.diagnostics, (r) => {
      switch (r.kind) {
        case "connector":
        case "pin": {
          const p = connectorAt.get(r.ref)
          if (p === undefined) return undefined
          return {
            x: p.x + NODE_W / 2 + 10,
            y: p.y - NODE_H / 2 - 2,
            data: r.kind === "pin" ? { connector: r.ref, pin: r.pin! } : { connector: r.ref }
          }
        }
        case "splice": {
          const s = spliceAt.get(r.ref)
          if (s === undefined) return undefined
          return { x: s.x + 12, y: s.y - 12, data: { splice: r.ref } }
        }
        case "branch": {
          const b = branchAt.get(r.ref)
          if (b === undefined) return undefined
          return { x: b.x, y: b.y - NODE_H / 2 - 24, data: { branch: r.ref } }
        }
        default:
          return undefined
      }
    })
  )

  return {
    width: maxX + MARGIN,
    height: y + MARGIN,
    background: "#fafafa",
    items
  }
}

/** Screen rendering: the mm-native layout at a comfortable display scale. */
const BOARD_DISPLAY_SCALE = 0.8

export const boardSvg = (hir: Hir): string =>
  renderSvg(scaleDrawing(boardDrawing(hir), BOARD_DISPLAY_SCALE))
