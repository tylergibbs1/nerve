/**
 * Layout-invariant tests ("geometric linting"): parse the SVG we emit and
 * assert SPATIAL truths that byte snapshots cannot see. This is the
 * mitigation for the deterministic-but-visually-wrong bug class — all
 * three user-caught splice/channel bugs are expressible here:
 *   - every wire's endpoints touch a pin dot or splice dot (no detached wires)
 *   - every splice dot is connected to at least one wire
 *   - all geometry stays inside the canvas (no silent clipping)
 *   - bundle rails are wide enough to be rails
 * Run over the real examples AND fast-check-generated branchy designs.
 */
import { describe, expect, it } from "vitest"
import fc from "fast-check"
import { compileDesign, branch, connector, harness, wire, type HarnessDesign } from "@grayhaven/nerve"
import { schematicSvg } from "../src/svg.js"
import motor from "../../../examples/motor-controller/src/main.harness.js"
import sensor from "../../../examples/sensor-splice/src/main.harness.js"
import robot from "../../../examples/robot-platform/src/main.harness.js"

interface Geometry {
  readonly width: number
  readonly height: number
  readonly anchors: Array<{ x: number; y: number }>
  readonly spliceDots: Array<{ id: string; x: number; y: number }>
  readonly wirePathEnds: Array<{ id: string; pts: Array<[number, number]> }>
  readonly wireStubs: Array<{ id: string; x1: number; y1: number }>
  readonly rails: Array<{ x1: number; x2: number; y: number }>
}

const parseGeometry = (svg: string): Geometry => {
  const dims = /<svg[^>]* width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/.exec(svg)!
  const anchors: Geometry["anchors"] = []
  const spliceDots: Geometry["spliceDots"] = []
  for (const m of svg.matchAll(/<circle([^>]*)\/>/g)) {
    const attrs = m[1]!
    const cx = Number(/cx="([\d.-]+)"/.exec(attrs)?.[1])
    const cy = Number(/cy="([\d.-]+)"/.exec(attrs)?.[1])
    const splice = /data-splice="([^"]+)"/.exec(attrs)?.[1]
    if (splice !== undefined) spliceDots.push({ id: splice, x: cx, y: cy })
    anchors.push({ x: cx, y: cy })
  }
  const wirePathEnds: Geometry["wirePathEnds"] = []
  for (const m of svg.matchAll(/<path data-wire="([^"]+)"[^>]* d="([^"]+)"/g)) {
    const nums = (m[2]!.match(/-?[\d.]+/g) ?? []).map(Number)
    const first: [number, number] = [nums[0]!, nums[1]!]
    const last: [number, number] = [nums[nums.length - 2]!, nums[nums.length - 1]!]
    wirePathEnds.push({ id: m[1]!, pts: [first, last] })
  }
  const wireStubs: Geometry["wireStubs"] = []
  for (const m of svg.matchAll(/<line data-wire="([^"]+)"([^>]*)\/>/g)) {
    const attrs = m[2]!
    wireStubs.push({
      id: m[1]!,
      x1: Number(/x1="([\d.-]+)"/.exec(attrs)?.[1]),
      y1: Number(/y1="([\d.-]+)"/.exec(attrs)?.[1])
    })
  }
  const rails: Geometry["rails"] = []
  for (const m of svg.matchAll(/<line ([^>]*stroke="#e4e0d8"[^>]*)\/>/g)) {
    const attrs = m[1]!
    rails.push({
      x1: Number(/x1="([\d.-]+)"/.exec(attrs)?.[1]),
      x2: Number(/x2="([\d.-]+)"/.exec(attrs)?.[1]),
      y: Number(/y1="([\d.-]+)"/.exec(attrs)?.[1])
    })
  }
  return {
    width: Number(dims[1]),
    height: Number(dims[2]),
    anchors,
    spliceDots,
    wirePathEnds,
    wireStubs,
    rails
  }
}

const near = (a: { x: number; y: number }, b: [number, number], tol = 1): boolean =>
  Math.abs(a.x - b[0]) <= tol && Math.abs(a.y - b[1]) <= tol

const assertInvariants = (design: HarnessDesign): void => {
  const { hir } = compileDesign(design)
  const g = parseGeometry(schematicSvg(hir))

  // 1. No detached wires: every routed/bezier wire endpoint touches an anchor.
  for (const w of g.wirePathEnds) {
    for (const end of w.pts) {
      expect(
        g.anchors.some((a) => near(a, end)),
        `wire ${w.id} endpoint (${end[0]},${end[1]}) touches no pin/splice dot`
      ).toBe(true)
    }
  }
  // 2. Net-flag stubs start at an anchor too.
  for (const s of g.wireStubs) {
    expect(
      g.anchors.some((a) => near(a, [s.x1, s.y1])),
      `stub ${s.id} starts off-anchor at (${s.x1},${s.y1})`
    ).toBe(true)
  }
  // 3. Every splice dot is connected: some wire path or stub touches it.
  for (const d of g.spliceDots) {
    const touched =
      g.wirePathEnds.some((w) => w.pts.some((p) => near(d, p))) ||
      g.wireStubs.some((s) => near(d, [s.x1, s.y1]))
    expect(touched, `splice ${d.id} dot at (${d.x},${d.y}) has no wire touching it`).toBe(true)
  }
  // 4. Nothing escapes the canvas.
  for (const w of g.wirePathEnds) {
    for (const [x, y] of w.pts) {
      expect(x >= 0 && x <= g.width && y >= 0 && y <= g.height, `wire ${w.id} clips`).toBe(true)
    }
  }
  // 5. Rails are rails, not slivers (the 80px-channel regression).
  for (const r of g.rails) {
    expect(r.x2 - r.x1, `rail at y=${r.y} too narrow`).toBeGreaterThanOrEqual(120)
  }
}

describe("layout invariants — real examples", () => {
  it("motor-controller", () => assertInvariants(motor))
  it("sensor-splice", () => assertInvariants(sensor))
  it("robot-platform", () => assertInvariants(robot))
})

describe("layout invariants — generated branchy designs (property)", () => {
  const part = { mpn: "LI-6", pinCount: 6 }
  const designArb = fc
    .tuple(
      fc.integer({ min: 2, max: 6 }), // connectors
      fc.array(fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()), { minLength: 1, maxLength: 14 }), // wires
      fc.integer({ min: 0, max: 3 }) // branches
    )
    .map(([nConn, wireSpecs, nBranch]) => {
      const conns = Array.from({ length: nConn }, (_, i) =>
        connector(`J${i + 1}`, part, {
          pins: Object.fromEntries(Array.from({ length: 6 }, (_, p) => [p + 1, `SIG${p}`]))
        })
      )
      const wires = wireSpecs.map(([fc1, fp1, fc2, fp2], i) =>
        wire(
          `W${i + 1}`,
          conns[fc1 % nConn]!.pin((fp1 % 6) + 1),
          conns[fc2 % nConn]!.pin((fp2 % 6) + 1),
          { gauge: "24AWG", color: "red", length: 100, signal: `SIG${fp1 % 6}` }
        )
      )
      const branches = Array.from({ length: Math.min(nBranch, nConn - 1) }, (_, i) =>
        branch(`B${i + 1}`, {
          ...(i > 0 ? { parent: `B${i}`, breakoutDistance: 50 } : {}),
          path: [conns[i]!, conns[i + 1]!],
          nominalLength: 100
        })
      )
      return harness("layout-prop", {
        revision: "A",
        units: "mm",
        connectors: conns,
        wires,
        branches
      })
    })

  it("hold for arbitrary designs with branch trees", () => {
    fc.assert(
      fc.property(designArb, (design) => assertInvariants(design)),
      { numRuns: 150 }
    )
  })
})
