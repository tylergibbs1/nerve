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

  // ── Branch-following bundle lanes (PRD §9.5.1 extension) ─────────────
  // Each branch renders as a horizontal "bundle rail" in the channel;
  // wires ride their branch's rail in per-wire slots and transfer rails
  // at the child branch's junction x — the schematic reads like the
  // physical harness tree.
  const branchById = new Map(hir.branches.map((b) => [b.id, b]))
  const branchOfNode = new Map<string, string>()
  for (const b of hir.branches) {
    for (const ref of b.path) {
      if (!branchOfNode.has(ref)) branchOfNode.set(ref, b.id)
    }
  }
  for (const sp of hir.splices) {
    if (sp.branch !== undefined && branchById.has(sp.branch) && !branchOfNode.has(sp.id)) {
      branchOfNode.set(sp.id, sp.branch)
    }
  }
  const childrenOf = new Map<string, Array<string>>()
  const laneRoots: Array<string> = []
  for (const b of hir.branches) {
    if (b.parent !== undefined && branchById.has(b.parent)) {
      const list = childrenOf.get(b.parent) ?? []
      list.push(b.id)
      childrenOf.set(b.parent, list)
    } else {
      laneRoots.push(b.id)
    }
  }
  const laneOrder: Array<string> = []
  const visitLane = (id: string): void => {
    laneOrder.push(id)
    for (const c of childrenOf.get(id) ?? []) visitLane(c)
  }
  for (const r of laneRoots) visitLane(r)
  const laneIndex = new Map(laneOrder.map((id, i) => [id, i]))

  /** Branch chain from a to b through the tree (a..lca..b), or undefined. */
  const chainOf = (brA: string, brB: string): Array<string> | undefined => {
    const up = (id: string): Array<string> => {
      const seq = [id]
      let cur = branchById.get(id)
      while (cur?.parent !== undefined && branchById.has(cur.parent)) {
        seq.push(cur.parent)
        cur = branchById.get(cur.parent)
      }
      return seq
    }
    const ua = up(brA)
    const ub = up(brB)
    const inB = new Set(ub)
    const lcaIdx = ua.findIndex((x) => inB.has(x))
    if (lcaIdx === -1) return undefined
    const lca = ua[lcaIdx]!
    return [...ua.slice(0, lcaIdx + 1), ...ub.slice(0, ub.indexOf(lca)).reverse()]
  }

  // Splices live in the channel between the columns.
  const spliceCenterX = MARGIN + BOX_W + COL_GAP / 2
  const splicePos = new Map(
    hir.splices.map((s, i) => [
      s.id,
      { x: spliceCenterX, y: TITLE_H + MARGIN + 60 + i * 70 }
    ])
  )

  const width = rightX + BOX_W + MARGIN

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

  // Pre-pass: assign routed wires to lane slots (deterministic, wire order).
  const nodeOfEnd = (e: HirEndpoint): string => (isPinEndpoint(e) ? e.connector : e.splice)
  const wireChain = new Map<string, Array<string>>()
  const laneSlots = new Map<string, Map<string, number>>() // branch -> wire -> slot
  for (const w of hir.wires) {
    if (w.signal !== undefined && labeledNets.has(w.signal)) continue
    const brA = branchOfNode.get(nodeOfEnd(w.from))
    const brB = branchOfNode.get(nodeOfEnd(w.to))
    if (brA === undefined || brB === undefined) continue
    const chain = chainOf(brA, brB)
    if (chain === undefined) continue
    wireChain.set(w.id, chain)
    for (const br of chain) {
      const slots = laneSlots.get(br) ?? new Map<string, number>()
      if (!slots.has(w.id)) slots.set(w.id, slots.size)
      laneSlots.set(br, slots)
    }
  }

  // Lane geometry: stacked rails in the channel, inset past the net-flag
  // zone and vertically centered against the connector columns.
  const channelLeft = MARGIN + BOX_W + 150
  const channelRight = rightX - 150
  const SLOT_GAP = 5
  const laneBlockH = laneOrder.reduce(
    (h, id) => h + 16 + (laneSlots.get(id)?.size ?? 0) * SLOT_GAP + 14,
    0
  )
  const colBottom = Math.max(...[...placed.values()].map((p) => p.y + p.height), TITLE_H + MARGIN)
  const laneTopStart =
    TITLE_H + MARGIN + Math.max(12, (colBottom - TITLE_H - MARGIN - laneBlockH) / 2)
  const laneTop = new Map<string, number>()
  let laneCursor = laneTopStart
  for (const id of laneOrder) {
    laneTop.set(id, laneCursor)
    laneCursor += 16 + (laneSlots.get(id)?.size ?? 0) * SLOT_GAP + 14
  }
  const slotY = (br: string, wireId: string): number =>
    (laneTop.get(br) ?? 0) + 14 + (laneSlots.get(br)?.get(wireId) ?? 0) * SLOT_GAP
  const junctionX = (br: string): number =>
    channelLeft + 30 + (laneIndex.get(br) ?? 0) * 34

  // Rails + labels (under the wires).
  for (const id of laneOrder) {
    const top = laneTop.get(id)!
    const used = laneSlots.get(id)?.size ?? 0
    const railY = top + 14 + Math.max(0, used - 1) * SLOT_GAP * 0.5
    items.push(
      {
        kind: "line",
        x1: channelLeft,
        y1: railY,
        x2: channelRight,
        y2: railY,
        stroke: "#e4e0d8",
        strokeWidth: 8 + used * 1.5
      },
      {
        kind: "text",
        x: channelLeft + 2,
        y: top + 4,
        text: `[ ${id} ]`,
        size: 9,
        weight: "bold",
        fill: "#9a958a"
      }
    )
  }

  // Lane splices sit on their rail, spread by per-branch order.
  {
    const perBranch = new Map<string, number>()
    for (const sp of hir.splices) {
      const br = sp.branch
      if (br === undefined || !laneTop.has(br)) continue
      const i = perBranch.get(br) ?? 0
      perBranch.set(br, i + 1)
      splicePos.set(sp.id, {
        x: channelLeft + 90 + i * 80,
        y: laneTop.get(br)! + 14 + (laneSlots.get(br)?.size ?? 0) * SLOT_GAP + 6
      })
    }
  }

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
    const chain = wireChain.get(w.id)
    if (chain !== undefined) {
      const isError = errorWires.has(w.id)
      const stroke = isError ? "#d11" : strokeFor(w.color)
      const pts: Array<readonly [number, number]> = []
      const dirA = a.dir !== 0 ? a.dir : 1
      const stagA = (laneSlots.get(chain[0]!)?.get(w.id) ?? 0) * 4
      const dropA =
        a.dir === 0 ? a.x + 12 : dirA === 1 ? channelLeft - 12 - stagA : channelRight + 12 + stagA
      pts.push([a.x, a.y], [dropA, a.y], [dropA, slotY(chain[0]!, w.id)])
      for (let i = 0; i + 1 < chain.length; i++) {
        const cur = chain[i]!
        const next = chain[i + 1]!
        // Transfer at the junction of whichever branch is the child.
        const jx = junctionX(branchById.get(next)?.parent === cur ? next : cur)
        pts.push([jx, slotY(cur, w.id)], [jx, slotY(next, w.id)])
      }
      const last = chain[chain.length - 1]!
      const dirB = b.dir !== 0 ? b.dir : 1
      const stagB = (laneSlots.get(last)?.get(w.id) ?? 0) * 4
      const dropB =
        b.dir === 0 ? b.x + 12 : dirB === 1 ? channelLeft - 12 - stagB : channelRight + 12 + stagB
      pts.push([dropB, slotY(last, w.id)], [dropB, b.y], [b.x, b.y])
      items.push({
        kind: "path",
        d: pts.map(([px, py], i) => `${i === 0 ? "M" : "L"} ${px} ${py}`).join(" "),
        stroke,
        strokeWidth: 1.6,
        data: { wire: w.id },
        ...(isError ? { dash: [6, 3] } : {})
      })
      const annotation = [w.id, w.gauge, w.twistGroup !== undefined ? "twisted" : undefined]
        .filter((t): t is string => t !== undefined)
        .join(" · ")
      // Annotation hugs the pin exit (the channel itself stays clean).
      items.push({
        kind: "text",
        x: a.x + dirA * 6,
        y: a.y - 3,
        text: annotation,
        size: 8,
        fill: isError ? "#d11" : "#777",
        anchor: dirA === 1 ? "start" : "end",
        data: { wire: w.id }
      })
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

  const height =
    Math.max(
      ...[...placed.values()].map((p) => p.y + p.height),
      ...[...splicePos.values()].map((p) => p.y + 40),
      laneCursor,
      TITLE_H + MARGIN
    ) + MARGIN

  return { width, height, background: "#fafafa", items }
}

export const schematicSvg = (hir: Hir): string => renderSvg(schematicDrawing(hir))
