import { describe, expect, it } from "vitest"
import { compileDesign, connector, harness, wire } from "@grayhaven/nerve"
import { textWidth } from "../src/drawing.js"
import { pinoutSvg } from "../src/pinout.js"
import motor from "../../../examples/motor-controller/src/main.harness.js"

const fixture = () => {
  const part = {
    mpn: "DT06-4S",
    pinCount: 4,
    cavityLayout: { rows: 2, columns: 2 },
    compatibleTerminals: ["0462-201-16141"]
  }
  const j1 = connector("J1", part, {
    pins: { 1: "CAN_H", 2: "CAN_L", 3: "PWR", 4: "GND" },
    terminals: "0462-201-16141",
    seals: { 1: "0281-934-9PK" }
  })
  const j2 = connector("J2", part, { pins: { 1: "CAN_H", 2: "CAN_L", 3: "PWR", 4: "GND" } })
  return compileDesign(
    harness("pinout-fixture", {
      revision: "A",
      units: "mm",
      connectors: [j1, j2],
      wires: [
        wire("W1", j1.pin(1), j2.pin(1), { signal: "CAN_H", gauge: "24AWG", color: "yellow", length: 100 }),
        wire("W2", j1.pin(2), j2.pin(2), { signal: "CAN_L", gauge: "24AWG", color: "green", length: 100 }),
        wire("W3", j1.pin(3), j2.pin(3), { signal: "PWR", gauge: "18AWG", color: "red", length: 100 }),
        wire("W4", j1.pin(4), j2.pin(4), { signal: "GND", gauge: "18AWG", color: "black", length: 100 })
      ]
    })
  ).hir
}

describe("pinout cards (PRD §9.5.2)", () => {
  it("is deterministic and renders the golden fixture", () => {
    const svg = pinoutSvg(fixture())
    expect(svg).toBe(pinoutSvg(fixture()))
    expect(svg).toMatchSnapshot()
  })

  it("every cavity gets a label row with wire, gauge, terminal, and seal", () => {
    const svg = pinoutSvg(fixture())
    expect(svg).toContain("1 · CAN_H · W1 · 24AWG · t:0462-201-16141 · s:0281-934-9PK")
    expect(svg).toContain("4 · GND · W4 · 18AWG · t:0462-201-16141")
    // Unsealed J2 rows still show pin/signal/wire/gauge.
    expect(svg).toContain("3 · PWR · W3 · 18AWG")
  })

  it("renders the real example and keeps every label on-canvas", () => {
    const svg = pinoutSvg(compileDesign(motor).hir)
    const dims = /<svg[^>]* width="(\d+(?:\.\d+)?)"/.exec(svg)!
    const width = Number(dims[1])
    for (const m of svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)) {
      const attrs = m[1]!
      const x = Number(/ x="([\d.-]+)"/.exec(attrs)?.[1])
      const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? 12)
      const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? "start"
      const w = textWidth(m[2]!, size)
      const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x
      expect(x0 >= 0 && x0 + w <= width, `"${m[2]}" overflows`).toBe(true)
    }
  })

  it("leaders are crossing-free: no horizontal run intersects another cavity's vertical", () => {
    const svg = pinoutSvg(fixture())
    interface Seg { x1: number; y1: number; x2: number; y2: number }
    const segs: Array<Seg> = []
    for (const m of svg.matchAll(/<line[^>]*stroke="#b0aca2"[^>]*\/>/g)) {
      const at = (n: string) => Number(new RegExp(`${n}="([\\d.-]+)"`).exec(m[0])?.[1])
      segs.push({ x1: at("x1"), y1: at("y1"), x2: at("x2"), y2: at("y2") })
    }
    expect(segs.length).toBeGreaterThan(0)
    const verticals = segs.filter((s) => s.x1 === s.x2)
    const horizontals = segs.filter((s) => s.y1 === s.y2)
    for (const h of horizontals) {
      for (const v of verticals) {
        const [hx0, hx1] = [Math.min(h.x1, h.x2), Math.max(h.x1, h.x2)]
        const [vy0, vy1] = [Math.min(v.y1, v.y2), Math.max(v.y1, v.y2)]
        const crosses = v.x1 > hx0 && v.x1 < hx1 && h.y1 > vy0 && h.y1 < vy1
        expect(crosses, `leader at y=${h.y1} crosses vertical at x=${v.x1}`).toBe(false)
      }
    }
  })

  it("carries selection data-* attributes", () => {
    const svg = pinoutSvg(fixture())
    expect(svg).toContain('data-connector="J1" data-pin="1" data-wire="W1"')
  })
})
