import { describe, expect, it } from "vitest"
import {
  Codes,
  compileDesign,
  connector,
  decodeHir,
  harness,
  splice,
  wire
} from "@grayhaven/nerve"
import design from "../../../examples/sensor-splice/src/main.harness.js"

describe("splice + cable compilation (PRD §9.2, golden)", () => {
  const { hir, diagnostics } = compileDesign(design)

  it("compiles the sensor-splice example without diagnostics", () => {
    expect(diagnostics).toEqual([])
  })

  it("normalizes splices with attached wires", () => {
    expect(hir.splices.map((s) => [s.id, s.wires])).toEqual([
      ["S1", ["W1", "W2", "W3"]],
      ["S2", ["W4", "W5", "W6"]]
    ])
    expect(hir.splices[0]).toMatchObject({
      type: "crimp",
      part: "GT-0.5",
      branch: "main",
      location: 120
    })
  })

  it("normalizes cables with members and cut length", () => {
    expect(hir.cables).toHaveLength(1)
    expect(hir.cables[0]).toMatchObject({
      id: "C1",
      conductors: 2,
      cutLength: 300,
      wires: ["W7", "W8"]
    })
  })

  it("represents splice endpoints in wires and round-trips the schema", () => {
    const w2 = hir.wires.find((w) => w.id === "W2")!
    expect(w2.from).toEqual({ splice: "S1" })
    const decoded = decodeHir(JSON.parse(JSON.stringify(hir)))
    expect(decoded).toEqual(hir)
  })

  it("matches the golden snapshot", () => {
    expect(hir).toMatchSnapshot()
  })
})

describe("splice/cable structural diagnostics", () => {
  const part = { mpn: "T-2", pinCount: 2 }
  const a = connector("J1", part, { pins: { 1: "SIG", 2: "GND" } })
  const b = connector("J2", part, { pins: { 1: "SIG", 2: "GND" } })

  it("reports undefined splice references", () => {
    const { diagnostics } = compileDesign(
      harness("bad-splice", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [
          wire("W1", a.pin(1), { kind: "splice-ref", splice: "NOPE" }, { color: "red", gauge: "24AWG", length: 10 })
        ]
      })
    )
    expect(diagnostics.map((d) => d.code)).toEqual([Codes.UndefinedSpliceRef])
  })

  it("reports splices joining fewer than 2 wires", () => {
    const s = splice("S1")
    const { diagnostics } = compileDesign(
      harness("lonely-splice", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        splices: [s],
        wires: [wire("W1", a.pin(1), s, { color: "red", gauge: "24AWG", length: 10 })]
      })
    )
    expect(diagnostics.map((d) => d.code)).toEqual([Codes.SpliceTooFewWires])
  })

  it("reports undefined cable references and splice branches", () => {
    const s = splice("S1", { branch: "ghost" })
    const { diagnostics } = compileDesign(
      harness("bad-refs", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        splices: [s],
        wires: [
          wire("W1", a.pin(1), s, { cable: "ghost-cable", color: "red", gauge: "24AWG", length: 10 }),
          wire("W2", s, b.pin(1), { color: "red", gauge: "24AWG", length: 10 })
        ]
      })
    )
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      Codes.UndefinedCableRef,
      Codes.SpliceUndefinedBranch
    ])
  })
})
