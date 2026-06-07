import { describe, expect, it } from "vitest"
import {
  canonicalGauge,
  compileDesign,
  connector,
  harness,
  parseAwg,
  wire,
  type ConnectorPart
} from "@grayhaven/nerve"

describe("parseAwg", () => {
  it.each([
    ["18AWG", 18],
    ["18 AWG", 18],
    ["awg18", 18],
    ["AWG 18", 18],
    ["20", 20],
    [" 20 ", 20],
    ["0AWG", undefined], // zero is not a hookup gauge
    ["0", undefined],
    ["41", undefined], // bare numbers only inside hookup-wire range
    ["0.5", undefined], // metric mm² stays unparsed
    ["0.5mm2", undefined],
    ["18AWG TXL", undefined], // anchored: trailing junk is not silently accepted
    ["", undefined]
  ])("%j → %j", (input, expected) => {
    expect(parseAwg(input)).toBe(expected)
  })
})

describe("canonicalGauge", () => {
  it("normalizes every AWG spelling to NAWG", () => {
    for (const spelling of ["20AWG", "20 AWG", "awg 20", "AWG20", "20"]) {
      expect(canonicalGauge(spelling)).toBe("20AWG")
    }
  })

  it("passes unparseable gauges through unchanged", () => {
    expect(canonicalGauge("0.5mm2")).toBe("0.5mm2")
    expect(canonicalGauge("twisted-pair")).toBe("twisted-pair")
  })
})

describe("compileDesign gauge canonicalization", () => {
  const part: ConnectorPart = { mpn: "TEST-2", pinCount: 2 }
  const j1 = connector("J1", part, { pins: { 1: "PWR", 2: "GND" } })
  const j2 = connector("J2", part, { pins: { 1: "PWR", 2: "GND" } })

  it("every AWG spelling compiles to identical HIR bytes", () => {
    const build = (gauge: string) =>
      compileDesign(
        harness("gauge-fixture", {
          revision: "A",
          units: "mm",
          connectors: [j1, j2],
          wires: [wire("W1", j1.pin(1), j2.pin(1), { gauge })]
        })
      ).hir
    const canonical = JSON.stringify(build("20AWG"))
    for (const spelling of ["20 AWG", "awg 20", "20"]) {
      expect(JSON.stringify(build(spelling))).toBe(canonical)
    }
    expect(build("20AWG").wires[0]?.gauge).toBe("20AWG")
  })

  it("keeps unparseable gauges verbatim for the rule layer to flag", () => {
    const hir = compileDesign(
      harness("gauge-fixture", {
        revision: "A",
        units: "mm",
        connectors: [j1, j2],
        wires: [wire("W1", j1.pin(1), j2.pin(1), { gauge: "0.5mm2" })]
      })
    ).hir
    expect(hir.wires[0]?.gauge).toBe("0.5mm2")
  })
})
