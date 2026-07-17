import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { compileDesign } from "@grayhaven/nerve"
import { exportWireViz, importWireViz } from "@grayhaven/nerve-wireviz"

const fixture = (name: string): string =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8")

describe("WireViz import (PRD §27.2)", () => {
  const { design, diagnostics } = importWireViz(fixture("motor.yml"), {
    harnessId: "imported-motor"
  })
  const { hir, diagnostics: structural } = compileDesign(design)

  it("imports connectors with pinlabels and genders", () => {
    expect(diagnostics).toEqual([])
    expect(structural).toEqual([])
    expect(hir.connectors.map((c) => c.ref)).toEqual(["X1", "X2"])
    expect(hir.connectors[0]).toMatchObject({
      family: "Molex Micro-Fit 3.0",
      gender: "receptacle",
      pinCount: 4
    })
    expect(hir.connectors[0]?.pins[2]).toEqual({ pin: "3", signal: "CAN_H" })
  })

  it("imports cable conductors as wires with color/gauge/length", () => {
    expect(hir.wires).toHaveLength(4)
    expect(hir.wires[0]).toMatchObject({
      id: "W1.1",
      from: { connector: "X1", pin: "1" },
      to: { connector: "X2", pin: "1" },
      gauge: "20AWG",
      color: "red",
      length: 420,
      signal: "VBAT",
      cable: "W1"
    })
    expect(hir.cables[0]).toMatchObject({ id: "W1", conductors: 4, shield: "shield" })
  })

  it("matches the import snapshot", () => {
    expect(hir).toMatchSnapshot()
  })

  it("warns about unmapped concepts instead of silently dropping them", () => {
    const result = importWireViz(fixture("unsupported.yml"))
    const messages = result.diagnostics.map((d) => d.message)
    expect(messages.some((m) => m.includes('"options"'))).toBe(true)
    expect(messages.some((m) => m.includes('"image"'))).toBe(true)
    expect(result.design.metadata.sourceTitle).toBe("Demo")
    // Bundle wires import as loose wires with DIN colors, not a cable.
    const { hir: h } = compileDesign(result.design)
    expect(h.cables).toEqual([])
    expect(h.wires.map((w) => w.color)).toEqual(["white", "brown"])
  })

  it("supports prepend files, YAML merges, descending ranges, and explicit length units", () => {
    const prepend = `templates:
  connector: &connector
    type: JST-XH
    subtype: female
    pinlabels: [A, B, C, D]
  cable: &cable
    colors: [RD, BK, BU, WH]
    gauge: 22 awg
`
    const source = `connectors:
  X1:
    <<: *connector
  X2:
    <<: *connector
cables:
  W1:
    <<: *cable
    length: 36 cm
connections:
  - [X1: [1-4], W1: [1-4], X2: [4-1]]
metadata:
  title: Reversing adapter
`
    const result = importWireViz(source, {
      harnessId: "real-wireviz",
      prependYaml: [prepend]
    })
    const { hir, diagnostics: structural } = compileDesign(result.design)

    expect(result.diagnostics).toEqual([])
    expect(structural).toEqual([])
    expect(hir.harness.metadata.sourceTitle).toBe("Reversing adapter")
    expect(hir.connectors[0]).toMatchObject({
      family: "JST-XH",
      gender: "receptacle",
      pinCount: 4
    })
    expect(
      hir.wires.map((w) => [
        "pin" in w.from ? w.from.pin : undefined,
        "pin" in w.to ? w.to.pin : undefined,
        w.gauge,
        w.length
      ])
    ).toEqual([
      ["1", "4", "22AWG", 360],
      ["2", "3", "22AWG", 360],
      ["3", "2", "22AWG", 360],
      ["4", "1", "22AWG", 360]
    ])
  })

  it("reports dropped connection rows as errors instead of succeeding with zero wires", () => {
    const result = importWireViz(`connectors:
  X1: { pincount: 2 }
cables:
  W1: { wirecount: 2 }
connections:
  - [X1: [1-2], W1: [1-2], [X, X]]
`)

    expect(result.design.wires).toEqual([])
    expect(result.diagnostics.map((d) => d.severity)).toEqual(["error", "error"])
    expect(result.diagnostics[0]?.message).toContain("unrecognized entry")
    expect(result.diagnostics[1]?.message).toContain("no wires were imported")
  })
})

describe("WireViz export (PRD §27.2)", () => {
  const { design } = importWireViz(fixture("motor.yml"), { harnessId: "rt" })
  const { hir } = compileDesign(design)

  it("round-trips through export and re-import", () => {
    const { yaml, diagnostics } = exportWireViz(hir)
    expect(diagnostics).toEqual([])
    const back = importWireViz(yaml, { harnessId: "rt" })
    const { hir: hir2 } = compileDesign(back.design)
    expect(hir2.connectors).toEqual(hir.connectors)
    expect(hir2.wires.map((w) => [w.id, w.color, w.gauge, w.length])).toEqual(
      hir.wires.map((w) => [w.id, w.color, w.gauge, w.length])
    )
  })

  it("reports splices as unrepresentable", async () => {
    const spliced = await import("../../../examples/sensor-splice/src/main.harness.js")
    const { hir: sHir } = compileDesign(spliced.default)
    const { diagnostics } = exportWireViz(sHir)
    expect(diagnostics.filter((d) => d.code === "HK-WV-002").length).toBeGreaterThan(0)
  })
})
