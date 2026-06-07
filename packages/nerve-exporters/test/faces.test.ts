/** Connector face views (PRD §9.5.2). */
import { describe, expect, it } from "vitest"
import { compileDesign, connector, harness, wire } from "@grayhaven/nerve"
import { connectorFacesSvg } from "../src/faces.js"
import motor from "../../../examples/motor-controller/src/main.harness.js"

const small = () => {
  const part = { mpn: "FC-4", pinCount: 4, cavityLayout: { rows: 2, columns: 2 }, reservedPins: [4] }
  const a = connector("J1", part, { pins: { 1: "PWR", 2: "GND", 3: "SIG" } })
  const b = connector("J2", { mpn: "FC-4B", pinCount: 4 }, { pins: { 1: "PWR", 2: "GND" } })
  return compileDesign(
    harness("faces-fixture", {
      revision: "A",
      units: "mm",
      connectors: [a, b],
      wires: [
        wire("W1", a.pin(1), b.pin(1), { gauge: "20AWG", color: "red", length: 100 }),
        wire("W2", a.pin(2), b.pin(2), { gauge: "20AWG", color: "black", length: 100 })
      ]
    })
  ).hir
}

describe("connector face view", () => {
  it("renders FRONT and REAR views per connector with orientation captions", () => {
    const svg = connectorFacesSvg(small())
    expect((svg.match(/FRONT · mating side/g) ?? []).length).toBe(2)
    expect((svg.match(/REAR · wire side/g) ?? []).length).toBe(2)
  })

  it("populated cavities carry the wire color and id; every cavity is addressable", () => {
    const svg = connectorFacesSvg(small())
    // W1 (red) fills J1 pin 1 in both views.
    expect((svg.match(/<circle data-connector="J1" data-pin="1" data-wire="W1"[^>]*fill="red"/g) ?? []).length).toBe(2)
    // Assigned-but-unwired pin 3 has no fill circle, only the ring path.
    expect(svg).not.toContain('<circle data-connector="J1" data-pin="3"')
    expect(svg).toContain('data-connector="J1" data-pin="3"')
  })

  it("reserved cavities render dashed", () => {
    const svg = connectorFacesSvg(small())
    const ringForPin4 = svg
      .split("\n")
      .find((l) => l.includes('data-pin="4"') && l.includes("stroke-dasharray"))
    expect(ringForPin4).toContain('data-connector="J1"')
  })

  it("FRONT view mirrors columns (pin 1 swaps sides between views)", () => {
    const svg = connectorFacesSvg(small())
    const texts = [...svg.matchAll(/<text data-connector="J1" data-pin="(1|2)"[^>]* x="([\d.]+)"/g)]
      .map((m) => ({ pin: m[1], x: Number(m[2]) }))
    // 2-column grid: in one view pin1 is left of pin2, in the other right.
    const [front1, front2, rear1, rear2] = [texts[0]!, texts[1]!, texts[2]!, texts[3]!]
    expect(Math.sign(front1.x - front2.x)).toBe(-Math.sign(rear1.x - rear2.x))
  })

  it("derived grids announce themselves; explicit layouts do not", () => {
    const svg = connectorFacesSvg(small())
    const cards = svg.split("FC-4B")
    expect(cards[0]).not.toContain("derived grid") // FC-4 has explicit cavityLayout
    expect(cards[1]).toContain("derived grid")
  })

  it("is deterministic and renders the golden example", () => {
    const { hir } = compileDesign(motor)
    const a = connectorFacesSvg(hir)
    expect(connectorFacesSvg(hir)).toBe(a)
    expect(a).toContain('data-connector="J1"')
    expect(a).toMatchSnapshot()
  })
})
