import { describe, expect, it } from "vitest"
import {
  compileDesign,
  connector,
  harness,
  hasErrors,
  rule,
  runRules,
  wire,
  type ConnectorPart,
  type HarnessDesign,
  type Hir
} from "@grayhaven/nerve"
import { builtinRules, parseAwg, requiredAwgForCurrent } from "@grayhaven/nerve-rules"
import design from "../../../examples/motor-controller/src/main.harness.js"

const part: ConnectorPart = {
  mpn: "TEST-4",
  pinCount: 4,
  wireGaugeRange: { min: "30AWG", max: "18AWG" }
}

const compile = (d: HarnessDesign): Hir => compileDesign(d).hir

const make = (
  wires: Parameters<typeof harness>[1]["wires"],
  overrides: Partial<Parameters<typeof harness>[1]> = {}
): Hir => {
  const a = connector("J1", part, { pins: { 1: "VBAT_24V", 2: "GND" } })
  const b = connector("J2", part, { pins: { 1: "VBAT_24V", 2: "GND" } })
  return compile(
    harness("rule-fixture", {
      revision: "A",
      units: "mm",
      connectors: [a, b],
      wires,
      ...overrides
    })
  )
}

// Connectors used by tests that need custom pin assignments.
const j1 = connector("J1", part, { pins: { 1: "VBAT_24V", 2: "GND" } })
const j2 = connector("J2", part, { pins: { 1: "VBAT_24V", 2: "GND" } })

const codesOf = (hir: Hir, names?: ReadonlyArray<string>) =>
  runRules(hir, builtinRules, Object.fromEntries(
    names === undefined
      ? []
      : builtinRules.filter((r) => !names.includes(r.name)).map((r) => [r.name, "off"] as const)
  )).map((d) => d.code)

describe("golden fixture under built-in rules", () => {
  const { hir } = compileDesign(design)
  const diagnostics = runRules(hir, builtinRules)

  it("has no errors (PRD §8.1: compiles without errors)", () => {
    expect(hasErrors(diagnostics)).toBe(false)
  })

  it("warns about known incompleteness, deterministically", () => {
    // ENC_A/ENC_B/MOTOR_TEMP assigned but unwired (×2 connectors),
    // SHIELD_DRAIN unconnected (×2), W3/W4 missing length.
    const counts = diagnostics.reduce<Record<string, number>>((acc, d) => {
      acc[d.code] = (acc[d.code] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({
      "HK-CONN-010": 6,
      "HK-ELEC-004": 2,
      "HK-MFG-001": 2
    })
    expect(runRules(hir, builtinRules)).toEqual(diagnostics)
  })
})

describe("documentation rules", () => {
  it("HK-DOC-001: missing revision", () => {
    const hir = compile(
      harness("no-rev", { revision: "  ", units: "mm", connectors: [], wires: [] })
    )
    expect(codesOf(hir, ["missingRevision"])).toEqual(["HK-DOC-001"])
  })

  it("HK-DOC-002: branch without label", () => {
    const { hir } = compileDesign({
      ...design,
      labels: []
    })
    expect(codesOf(hir, ["branchMissingLabel"])).toEqual(["HK-DOC-002"])
  })
})

describe("manufacturing rules", () => {
  it("HK-MFG-001/002/003: missing length, color, gauge", () => {
    const hir = make([wire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })])
    expect(
      codesOf(hir, ["missingWireLength", "missingWireColor", "missingWireGauge"]).sort()
    ).toEqual(["HK-MFG-001", "HK-MFG-002", "HK-MFG-003"])
  })

  it("HK-MFG-004: gauge outside connector range", () => {
    const hir = make([
      wire("W1", j1.pin(1), j2.pin(1), { gauge: "14AWG", signal: "VBAT_24V" })
    ])
    const diags = runRules(hir, [
      ...builtinRules.filter((r) => r.name === "gaugeOutsideConnectorRange")
    ])
    expect(diags.map((d) => d.code)).toEqual(["HK-MFG-004", "HK-MFG-004"])
    expect(diags[0]?.message).toContain("accepts 18AWG to 30AWG")
  })
})

describe("electrical rules", () => {
  it("HK-WIRE-004: gauge below current requirement", () => {
    const hir = make([
      wire("W1", j1.pin(1), j2.pin(1), {
        gauge: "24AWG",
        currentEstimate: 5,
        signal: "VBAT_24V"
      })
    ])
    const diags = runRules(
      hir,
      builtinRules.filter((r) => r.name === "gaugeCurrentMismatch")
    )
    expect(diags.map((d) => d.code)).toEqual(["HK-WIRE-004"])
    expect(diags[0]?.message).toContain("requires at least 18AWG")
  })

  it("HK-ELEC-001: differential pair not twisted", () => {
    const a = connector("J1", part, { pins: { 1: "CAN_H", 2: "CAN_L" } })
    const b = connector("J2", part, { pins: { 1: "CAN_H", 2: "CAN_L" } })
    const hir = compile(
      harness("untwisted", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [
          wire("W1", a.pin(1), b.pin(1), { signal: "CAN_H" }),
          wire("W2", a.pin(2), b.pin(2), { signal: "CAN_L" })
        ]
      })
    )
    expect(codesOf(hir, ["differentialPairNotTwisted"])).toEqual(["HK-ELEC-001"])
  })

  it("HK-ELEC-002: twist group with a single wire", () => {
    const hir = make([
      wire("W1", j1.pin(1), j2.pin(1), { twistGroup: "LONELY", signal: "VBAT_24V" })
    ])
    expect(codesOf(hir, ["twistGroupTooSmall"])).toEqual(["HK-ELEC-002"])
  })

  it("HK-ELEC-003: power without ground return", () => {
    const hir = make([
      wire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })
    ])
    expect(codesOf(hir, ["missingGroundReturn"])).toEqual(["HK-ELEC-003"])
  })

  it("HK-ELEC-004: shield drain unconnected", () => {
    const a = connector("J1", part, { pins: { 1: "SIG", 4: "SHIELD_DRAIN" } })
    const b = connector("J2", part, { pins: { 1: "SIG" } })
    const hir = compile(
      harness("shield", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [wire("W1", a.pin(1), b.pin(1), { signal: "SIG" })]
      })
    )
    expect(codesOf(hir, ["shieldDrainUnconnected"])).toEqual(["HK-ELEC-004"])
  })
})

describe("connectivity rules", () => {
  it("HK-CONN-010: assigned pin with no wire", () => {
    const hir = make([wire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })])
    // GND pins on both connectors are assigned but unwired.
    expect(codesOf(hir, ["unconnectedAssignedPin"])).toEqual([
      "HK-CONN-010",
      "HK-CONN-010"
    ])
  })

  it("HK-CONN-011: wire signal mismatches pin signal", () => {
    const hir = make([
      wire("W1", j1.pin(1), j2.pin(2), { signal: "VBAT_24V" })
    ])
    // j2 pin 2 is GND but the wire claims VBAT_24V.
    expect(codesOf(hir, ["wireSignalMismatch"])).toEqual(["HK-CONN-011"])
  })
})

describe("rule engine", () => {
  it("severity overrides and 'off' work", () => {
    const hir = make([wire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })])
    const raised = runRules(
      hir,
      builtinRules.filter((r) => r.name === "missingWireLength"),
      { missingWireLength: "error" }
    )
    expect(raised[0]?.severity).toBe("error")
    const off = runRules(hir, builtinRules, {
      ...Object.fromEntries(builtinRules.map((r) => [r.name, "off"] as const))
    })
    expect(off).toEqual([])
  })

  it("custom rules run with a generated stable code", () => {
    const requireMmUnits = rule("require-mm-units", (ctx) => {
      if (ctx.hir.harness.units !== "mm") {
        ctx.report({ severity: "error", message: "Harness must use mm." })
      }
    })
    const hir = compile(
      harness("inches", { revision: "A", units: "in", connectors: [], wires: [] })
    )
    const diags = runRules(hir, [requireMmUnits])
    expect(diags).toEqual([
      {
        code: "HK-RULE-REQUIRE-MM-UNITS",
        severity: "error",
        message: "Harness must use mm."
      }
    ])
  })
})

describe("wire data helpers", () => {
  it("parses gauges and computes required AWG", () => {
    expect(parseAwg("18AWG")).toBe(18)
    expect(parseAwg("awg 24")).toBe(24)
    expect(parseAwg("2.5mm2")).toBeUndefined()
    expect(requiredAwgForCurrent(5)).toBe(18)
    expect(requiredAwgForCurrent(1000)).toBeUndefined()
  })
})
