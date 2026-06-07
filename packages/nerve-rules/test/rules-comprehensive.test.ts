/**
 * Comprehensive rule coverage: for every rule, the three faces —
 * fires (positive), passes (negative), and the boundary between them —
 * plus the wire-data helpers and the rule-engine semantics.
 *
 * Ampacity boundaries encode the shipped AMPACITY_BY_AWG table, which sits
 * in the conservative bundled-harness band (between power-transmission and
 * free-air chassis columns of standard AWG tables; bundling requires
 * derating per NEC 310.15-style guidance).
 */
import { describe, expect, it } from "vitest"
import {
  branch,
  compileDesign,
  connector,
  harness,
  label,
  splice,
  wire,
  type ConnectorPart,
  type Diagnostic,
  type HarnessDesign,
  type Hir
} from "@grayhaven/nerve"
import { rule, runRules } from "@grayhaven/nerve"
import {
  AMPACITY_BY_AWG,
  builtinRules,
  differentialPartner,
  isGroundSignal,
  isPowerSignal,
  isShieldSignal,
  parseAwg,
  requiredAwgForCurrent
} from "@grayhaven/nerve-rules"

const part: ConnectorPart = {
  mpn: "TEST-4",
  pinCount: 4,
  wireGaugeRange: { min: "30AWG", max: "18AWG" }
}

const compile = (d: HarnessDesign): Hir => compileDesign(d).hir

/** Run exactly one built-in rule by name. */
const only = (hir: Hir, name: string): ReadonlyArray<Diagnostic> =>
  runRules(hir, builtinRules.filter((r) => r.name === name))

const fixture = (
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

const fullWire = (id: string, from: never | ReturnType<ReturnType<typeof connector>["pin"]>, to: never | ReturnType<ReturnType<typeof connector>["pin"]>, extra: Record<string, unknown> = {}) =>
  wire(id, from, to, { gauge: "24AWG", color: "red", length: 100, ...extra })

const j1 = connector("J1", part, { pins: { 1: "VBAT_24V", 2: "GND" } })
const j2 = connector("J2", part, { pins: { 1: "VBAT_24V", 2: "GND" } })

// ---------------------------------------------------------------------------
// wire-data helpers
// ---------------------------------------------------------------------------

describe("parseAwg", () => {
  it("accepts the common spellings", () => {
    expect(parseAwg("18AWG")).toBe(18)
    expect(parseAwg("18 AWG")).toBe(18)
    expect(parseAwg("awg18")).toBe(18)
    expect(parseAwg("AWG 18")).toBe(18)
    expect(parseAwg(" 20AWG ")).toBe(20)
    expect(parseAwg("18awg")).toBe(18)
  })

  it("rejects non-gauges", () => {
    expect(parseAwg("AWG")).toBeUndefined()
    expect(parseAwg("")).toBeUndefined()
    expect(parseAwg("red")).toBeUndefined()
    expect(parseAwg("1.5mm2")).toBeUndefined()
  })

  it("rejects zero (and therefore aught sizes — 4/0AWG is out of scope)", () => {
    expect(parseAwg("0AWG")).toBeUndefined()
    // "4/0AWG" finds the trailing 0AWG and rejects it: aught wire is not
    // a harness gauge this library models.
    expect(parseAwg("4/0AWG")).toBeUndefined()
  })

  it("documents the decimal quirk: '20.5AWG' parses as 5AWG", () => {
    // Known limitation: the regex finds the first integer-followed-by-AWG.
    // Decimal gauges do not exist in practice; this asserts the current
    // behavior so any future change is deliberate.
    expect(parseAwg("20.5AWG")).toBe(5)
  })
})

describe("ampacity table", () => {
  it("is monotonic: thicker wire always carries more", () => {
    const entries = Object.entries(AMPACITY_BY_AWG)
      .map(([awg, amps]) => [Number(awg), amps] as const)
      .sort(([a], [b]) => b - a) // thinnest (30) -> thickest (10)
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]![1]).toBeGreaterThan(entries[i - 1]![1])
    }
  })

  it("requiredAwgForCurrent picks the thinnest sufficient gauge", () => {
    expect(requiredAwgForCurrent(3.7)).toBe(20) // exactly at 20AWG's limit
    expect(requiredAwgForCurrent(3.71)).toBe(18) // just over -> next size up
    expect(requiredAwgForCurrent(0.1)).toBe(30)
    expect(requiredAwgForCurrent(38)).toBe(10) // top of the table
    expect(requiredAwgForCurrent(38.1)).toBeUndefined() // off-table
  })
})

describe("signal classifiers", () => {
  it("power: rails and voltage names", () => {
    for (const s of ["VBAT_24V", "VCC", "VDD3V3", "VIN", "VSYS", "PWR", "+5V", "5V", "3.3V", "24V_RAIL"]) {
      expect(isPowerSignal(s), s).toBe(true)
    }
    // Deliberately anchored: token-matching "5V" anywhere would classify
    // enable/sense lines (EN_5V) as rails — a false positive with real
    // HK-ELEC-003 consequences. Bare V-prefixed nets (V5) also stay out;
    // the sensor-splice example relies on that.
    for (const s of ["V5", "CAN_H", "GND", "DATA0", "EN_5V", "SENSE_24V"]) {
      expect(isPowerSignal(s), s).toBe(false)
    }
  })

  it("ground is token-aware: prefixed and suffixed grounds classify", () => {
    for (const s of ["GND", "GROUND", "0V", "RTN", "RETURN", "VSS", "gnd",
                     "AGND", "DGND", "PGND", "MOTOR_GND", "GND_SENSE"]) {
      expect(isGroundSignal(s), s).toBe(true)
    }
    for (const s of ["CHASSIS", "VBAT", "GROUNDED_PLANE_X"]) {
      expect(isGroundSignal(s), s).toBe(false)
    }
  })

  it("shield: unanchored, so prefixed drains match", () => {
    for (const s of ["SHIELD", "CABLE_SHIELD", "DRAIN", "SHLD", "SHLD1", "CAN_SHIELD"]) {
      expect(isShieldSignal(s), s).toBe(true)
    }
    expect(isShieldSignal("GND")).toBe(false)
  })
})

describe("differentialPartner", () => {
  it("CAN with and without underscore, with bus prefixes", () => {
    expect(differentialPartner("CAN_H")).toBe("CAN_L")
    expect(differentialPartner("CANH")).toBe("CANL")
    expect(differentialPartner("CAN1_H")).toBe("CAN1_L")
    expect(differentialPartner("MOTOR_CAN_L")).toBe("MOTOR_CAN_H")
  })

  it("RS-485, generic _P/_N, USB", () => {
    expect(differentialPartner("RS485_A")).toBe("RS485_B")
    expect(differentialPartner("RS485B")).toBe("RS485A")
    expect(differentialPartner("LVDS_P")).toBe("LVDS_N")
    expect(differentialPartner("LVDS_N")).toBe("LVDS_P")
    expect(differentialPartner("USB_DP")).toBe("USB_DM")
    expect(differentialPartner("USBDM")).toBe("USBDP")
  })

  it("non-pairs return undefined", () => {
    for (const s of ["GND", "CAN", "DATA_A", "VBAT_24V", "SHIELD"]) {
      expect(differentialPartner(s), s).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// documentation rules
// ---------------------------------------------------------------------------

describe("HK-DOC-001 missingRevision", () => {
  it("fires on whitespace-only revision", () => {
    const hir = compile(harness("h", { revision: "  ", units: "mm", connectors: [], wires: [] }))
    expect(only(hir, "missingRevision").map((d) => d.code)).toEqual(["HK-DOC-001"])
  })

  it("passes with a real revision", () => {
    const hir = compile(harness("h", { revision: "A", units: "mm", connectors: [], wires: [] }))
    expect(only(hir, "missingRevision")).toEqual([])
  })
})

describe("HK-DOC-002 branchMissingLabel", () => {
  const withBranch = (labels: ReadonlyArray<ReturnType<typeof label>>) =>
    fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })], {
      branches: [branch("B1", { path: [j1, j2], nominalLength: 100 })],
      labels
    })

  it("fires for an unlabeled branch with the branch target", () => {
    const diags = only(withBranch([]), "branchMissingLabel")
    expect(diags.map((d) => d.code)).toEqual(["HK-DOC-002"])
    expect(diags[0]?.target).toBe("branch:B1")
  })

  it("passes when a label attaches to the branch", () => {
    const hir = withBranch([label("L1", { text: "MAIN", attachTo: "B1" })])
    expect(only(hir, "branchMissingLabel")).toEqual([])
  })
})

describe("HK-DOC-003 spliceMissingNotes", () => {
  const withSplice = (s: ReturnType<typeof splice>) => {
    const a = connector("J1", part, { pins: { 1: "V5" } })
    return compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [a],
        wires: [fullWire("W1", a.pin(1), s as never)],
        splices: [s]
      })
    )
  }

  it("fires when type, part, and notes are all absent", () => {
    expect(only(withSplice(splice("S1")), "spliceMissingNotes").map((d) => d.code)).toEqual([
      "HK-DOC-003"
    ])
  })

  it("passes with any one of type / notes", () => {
    expect(only(withSplice(splice("S1", { type: "crimp" })), "spliceMissingNotes")).toEqual([])
    expect(
      only(withSplice(splice("S1", { notes: "solder and heatshrink" })), "spliceMissingNotes")
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// manufacturing rules
// ---------------------------------------------------------------------------

describe("HK-MFG-001/002/003 missing length/color/gauge", () => {
  it("each fires independently", () => {
    const noLength = fixture([wire("W1", j1.pin(1), j2.pin(1), { gauge: "24AWG", color: "red", signal: "VBAT_24V" })])
    expect(only(noLength, "missingWireLength").map((d) => d.code)).toEqual(["HK-MFG-001"])
    expect(only(noLength, "missingWireColor")).toEqual([])
    expect(only(noLength, "missingWireGauge")).toEqual([])
  })

  it("a fully specified wire passes all three", () => {
    const hir = fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })])
    for (const name of ["missingWireLength", "missingWireColor", "missingWireGauge"]) {
      expect(only(hir, name), name).toEqual([])
    }
  })

  it("length is a warning; color and gauge are errors", () => {
    const bare = fixture([wire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })])
    expect(only(bare, "missingWireLength")[0]?.severity).toBe("warning")
    expect(only(bare, "missingWireColor")[0]?.severity).toBe("error")
    expect(only(bare, "missingWireGauge")[0]?.severity).toBe("error")
  })
})

describe("HK-MFG-004 gaugeOutsideConnectorRange (range 30AWG..18AWG)", () => {
  const gauge = (g: string) =>
    only(fixture([fullWire("W1", j1.pin(1), j2.pin(1), { gauge: g, signal: "VBAT_24V" })]), "gaugeOutsideConnectorRange")

  it("boundaries are inclusive: exactly min and exactly max pass", () => {
    expect(gauge("30AWG")).toEqual([])
    expect(gauge("18AWG")).toEqual([])
  })

  it("one step outside fires at both endpoints of the wire", () => {
    expect(gauge("32AWG").map((d) => d.code)).toEqual(["HK-MFG-004", "HK-MFG-004"]) // too thin
    expect(gauge("16AWG").map((d) => d.code)).toEqual(["HK-MFG-004", "HK-MFG-004"]) // too thick
  })

  it("skips wires without a parseable gauge and connectors without a range", () => {
    expect(gauge("steel")).toEqual([])
    const noRange = connector("J9", { mpn: "NR", pinCount: 2 }, { pins: { 1: "V5" } })
    const hir = compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [noRange],
        wires: [fullWire("W1", noRange.pin(1), noRange.pin(1) as never, { gauge: "10AWG" })]
      })
    )
    expect(only(hir, "gaugeOutsideConnectorRange")).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// electrical rules
// ---------------------------------------------------------------------------

describe("HK-WIRE-004 gaugeCurrentMismatch", () => {
  const current = (gauge: string, currentEstimate: number) =>
    only(
      fixture([fullWire("W1", j1.pin(1), j2.pin(1), { gauge, currentEstimate, signal: "VBAT_24V" })]),
      "gaugeCurrentMismatch"
    )

  it("exactly at ampacity passes; just over fires", () => {
    expect(current("20AWG", 3.7)).toEqual([]) // 20AWG carries exactly 3.7A
    const diags = current("20AWG", 3.8)
    expect(diags.map((d) => d.code)).toEqual(["HK-WIRE-004"])
    expect(diags[0]?.message).toContain("requires at least 18AWG")
  })

  it("current beyond the whole table says so", () => {
    expect(current("10AWG", 50)[0]?.message).toContain("exceeds the ampacity table")
  })

  it("skips wires without an estimate or with an off-table gauge", () => {
    expect(current("8AWG", 50)).toEqual([]) // 8AWG not in the table
    const noEstimate = fixture([fullWire("W1", j1.pin(1), j2.pin(1), { gauge: "30AWG", signal: "VBAT_24V" })])
    expect(only(noEstimate, "gaugeCurrentMismatch")).toEqual([])
  })
})

describe("HK-ELEC-001 differentialPairNotTwisted", () => {
  const canPair = (twists: { h?: string; l?: string }) => {
    const a = connector("J1", part, { pins: { 1: "CAN_H", 2: "CAN_L" } })
    const b = connector("J2", part, { pins: { 1: "CAN_H", 2: "CAN_L" } })
    return compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [
          fullWire("W1", a.pin(1), b.pin(1), { signal: "CAN_H", ...(twists.h !== undefined ? { twistGroup: twists.h } : {}) }),
          fullWire("W2", a.pin(2), b.pin(2), { signal: "CAN_L", ...(twists.l !== undefined ? { twistGroup: twists.l } : {}) })
        ]
      })
    )
  }

  it("fires when neither wire is twisted, and when groups differ", () => {
    expect(only(canPair({}), "differentialPairNotTwisted").length).toBeGreaterThan(0)
    expect(only(canPair({ h: "T1", l: "T2" }), "differentialPairNotTwisted").length).toBeGreaterThan(0)
  })

  it("passes when the pair shares a twist group", () => {
    expect(only(canPair({ h: "T1", l: "T1" }), "differentialPairNotTwisted")).toEqual([])
  })

  it("a lone CAN_H with no CAN_L present is not a pair violation", () => {
    const a = connector("J1", part, { pins: { 1: "CAN_H" } })
    const hir = compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [a, j2],
        wires: [fullWire("W1", a.pin(1), j2.pin(1), { signal: "CAN_H" })]
      })
    )
    expect(only(hir, "differentialPairNotTwisted")).toEqual([])
  })
})

describe("HK-ELEC-002 twistGroupTooSmall", () => {
  it("a singleton group fires; a pair passes; two singletons sort deterministically", () => {
    const one = fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V", twistGroup: "T1" })])
    expect(only(one, "twistGroupTooSmall").map((d) => d.code)).toEqual(["HK-ELEC-002"])

    const two = fixture([
      fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V", twistGroup: "T1" }),
      fullWire("W2", j1.pin(2), j2.pin(2), { signal: "GND", twistGroup: "T1" })
    ])
    expect(only(two, "twistGroupTooSmall")).toEqual([])

    const singles = fixture([
      fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V", twistGroup: "TB" }),
      fullWire("W2", j1.pin(2), j2.pin(2), { signal: "GND", twistGroup: "TA" })
    ])
    expect(only(singles, "twistGroupTooSmall").map((d) => d.message)).toEqual([
      expect.stringContaining("TA"),
      expect.stringContaining("TB")
    ])
  })
})

describe("HK-ELEC-003 missingGroundReturn", () => {
  it("power without ground fires, listing unique sorted rails", () => {
    const hir = fixture([
      fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" }),
      fullWire("W2", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" }),
      fullWire("W3", j1.pin(1), j2.pin(1), { signal: "5V" })
    ])
    const diags = only(hir, "missingGroundReturn")
    expect(diags.map((d) => d.code)).toEqual(["HK-ELEC-003"])
    expect(diags[0]?.message).toContain("5V, VBAT_24V")
  })

  it("passes with a ground wire, and with no power at all", () => {
    const grounded = fixture([
      fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" }),
      fullWire("W2", j1.pin(2), j2.pin(2), { signal: "GND" })
    ])
    expect(only(grounded, "missingGroundReturn")).toEqual([])

    const dataOnly = fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "DATA0" })])
    expect(only(dataOnly, "missingGroundReturn")).toEqual([])
  })
})

describe("HK-ELEC-004 shieldDrainUnconnected (+ HK-CONN-010 exclusion)", () => {
  const shieldConn = connector("J1", part, { pins: { 1: "CAN_SHIELD", 2: "V5" } })

  it("fires as a warning for an unwired shield pin; CONN-010 stays silent for it", () => {
    const hir = compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [shieldConn, j2],
        wires: [fullWire("W1", shieldConn.pin(2), j2.pin(1))]
      })
    )
    const shield = only(hir, "shieldDrainUnconnected")
    expect(shield.map((d) => d.code)).toEqual(["HK-ELEC-004"])
    expect(shield[0]?.severity).toBe("warning")
    // The generic unconnected-pin rule must NOT double-report shield pins.
    expect(only(hir, "unconnectedAssignedPin").map((d) => d.target)).not.toContain(
      "connector:J1.pin:1"
    )
  })

  it("passes once the drain lands on a wire", () => {
    const hir = compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [shieldConn, j2],
        wires: [
          fullWire("W1", shieldConn.pin(1), j2.pin(1), { signal: "CAN_SHIELD" }),
          fullWire("W2", shieldConn.pin(2), j2.pin(2))
        ]
      })
    )
    expect(only(hir, "shieldDrainUnconnected")).toEqual([])
  })
})

describe("HK-CONN-010 unconnectedAssignedPin", () => {
  it("fires for an assigned, unwired pin; unassigned pins are fine", () => {
    const a = connector("J1", part, { pins: { 1: "V5" } }) // pin 2 unassigned
    const hir = compile(
      harness("h", { revision: "A", units: "mm", connectors: [a], wires: [] })
    )
    const diags = only(hir, "unconnectedAssignedPin")
    expect(diags.map((d) => d.target)).toEqual(["connector:J1.pin:1"])
    expect(diags[0]?.severity).toBe("warning")
  })

  it("a wire to a splice counts as wiring the pin", () => {
    const a = connector("J1", part, { pins: { 1: "V5" } })
    const s = splice("S1", { type: "crimp" })
    const hir = compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [a],
        wires: [fullWire("W1", a.pin(1), s as never)],
        splices: [s]
      })
    )
    expect(only(hir, "unconnectedAssignedPin")).toEqual([])
  })
})

describe("HK-CONN-011 wireSignalMismatch", () => {
  it("fires once per mismatched endpoint", () => {
    const hir = fixture([fullWire("W1", j1.pin(1), j2.pin(2), { signal: "VBAT_24V" })])
    // j1.1 = VBAT_24V (match), j2.2 = GND (mismatch)
    const diags = only(hir, "wireSignalMismatch")
    expect(diags.map((d) => d.target)).toEqual(["connector:J2.pin:2"])

    const both = fixture([fullWire("W1", j1.pin(2), j2.pin(2), { signal: "VBAT_24V" })])
    expect(only(both, "wireSignalMismatch")).toHaveLength(2)
  })

  it("passes on matching signals; skips unassigned pins and signalless wires", () => {
    expect(only(fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })]), "wireSignalMismatch")).toEqual([])
    const a = connector("J8", part, { pins: {} })
    const unassigned = compile(
      harness("h", {
        revision: "A",
        units: "mm",
        connectors: [a],
        wires: [fullWire("W1", a.pin(1), a.pin(2) as never, { signal: "ANYTHING" })]
      })
    )
    expect(only(unassigned, "wireSignalMismatch")).toEqual([])
    expect(only(fixture([fullWire("W1", j1.pin(1), j2.pin(2))]), "wireSignalMismatch")).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// engine semantics
// ---------------------------------------------------------------------------

describe("rule engine", () => {
  const noisy = fixture([wire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })])

  it("severity can be overridden per rule without changing the code", () => {
    const diags = runRules(noisy, builtinRules, {
      missingWireColor: "warning",
      missingWireLength: "off",
      missingWireGauge: "off",
      missingGroundReturn: "off",
      unconnectedAssignedPin: "off"
    })
    const color = diags.find((d) => d.code === "HK-MFG-002")
    expect(color?.severity).toBe("warning")
    expect(diags.some((d) => d.code === "HK-MFG-001")).toBe(false)
  })

  it("output is deterministic and canonically ordered by (target, code, message)", () => {
    const a = runRules(noisy, builtinRules)
    const b = runRules(noisy, builtinRules)
    expect(a).toEqual(b)
    const keys = a.map((d) => [d.target ?? "", d.code, d.message] as const)
    const sorted = [...keys].sort(
      (x, y) =>
        x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]) || x[2].localeCompare(y[2])
    )
    expect(keys).toEqual(sorted)
  })

  it("a report-level code overrides the rule's code", () => {
    const custom = rule(
      "customCode",
      (ctx) => ctx.report({ severity: "warning", message: "x", code: "ORG-042" }),
      { code: "ORG-001" }
    )
    expect(runRules(noisy, [custom]).map((d) => d.code)).toEqual(["ORG-042"])
  })
})

describe("HK-ELEC-005 voltageRatingBelowSignal", () => {
  it("fires when the wire's rating is below the signal's nominal volts", () => {
    const hir = fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V", voltageRating: 12 })])
    expect(only(hir, "voltageRatingBelowSignal").map((d) => d.code)).toEqual(["HK-ELEC-005"])
  })
  it("passes at exactly nominal and when either field is absent", () => {
    expect(only(fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V", voltageRating: 24 })]), "voltageRatingBelowSignal")).toEqual([])
    expect(only(fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "VBAT_24V" })]), "voltageRatingBelowSignal")).toEqual([])
    expect(only(fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "CAN_H", voltageRating: 5 })]), "voltageRatingBelowSignal")).toEqual([])
  })
  it("reads decimal rails", () => {
    const hir = fixture([fullWire("W1", j1.pin(1), j2.pin(1), { signal: "RAIL_3.3V", voltageRating: 3 })])
    expect(only(hir, "voltageRatingBelowSignal")).toHaveLength(1)
  })
})

describe("HK-CONN-015 reservedPinAssigned", () => {
  const part = { mpn: "RP-4", pinCount: 4, reservedPins: [4] }
  it("fires when a reserved pin carries a signal", () => {
    const a = connector("J1", part, { pins: { 1: "SIG", 4: "OOPS" } })
    const b = connector("J2", { mpn: "RP-4B", pinCount: 4 }, { pins: { 1: "SIG", 4: "OOPS" } })
    const { hir } = compileDesign(
      harness("t", { revision: "A", units: "mm", connectors: [a, b], wires: [
        wire("W1", a.pin(1), b.pin(1), { gauge: "24AWG", color: "red", length: 100 }),
        wire("W2", a.pin(4), b.pin(4), { gauge: "24AWG", color: "red", length: 100 })
      ] })
    )
    const diags = only(hir, "reservedPinAssigned")
    expect(diags.map((d) => d.target)).toEqual(["connector:J1.pin:4"])
  })
  it("passes when reserved pins stay empty", () => {
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const b = connector("J2", { mpn: "RP-4B", pinCount: 4 }, { pins: { 1: "SIG" } })
    const { hir } = compileDesign(
      harness("t", { revision: "A", units: "mm", connectors: [a, b], wires: [
        wire("W1", a.pin(1), b.pin(1), { gauge: "24AWG", color: "red", length: 100 })
      ] })
    )
    expect(only(hir, "reservedPinAssigned")).toEqual([])
  })
})

describe("HK-MFG-005 breakoutTighterThanBendRadius", () => {
  const two = () => {
    const a = connector("J1", { mpn: "BR-2", pinCount: 2 }, { pins: { 1: "S" } })
    const b = connector("J2", { mpn: "BR-2B", pinCount: 2 }, { pins: { 1: "S" } })
    return { a, b, wires: [wire("W1", a.pin(1), b.pin(1), { gauge: "24AWG", color: "red", length: 100 })] }
  }
  it("fires when breakout is inside the bend radius; passes at the boundary", () => {
    const mk = (breakoutDistance: number) => {
      const { a, b, wires } = two()
      return compileDesign(
        harness("t", {
          revision: "A", units: "mm", connectors: [a, b], wires,
          branches: [
            branch("main", { path: [a, b], nominalLength: 100 }),
            branch("drop", { parent: "main", path: [a, b], nominalLength: 50, breakoutDistance, minBendRadius: 30 })
          ]
        })
      ).hir
    }
    expect(only(mk(20), "breakoutTighterThanBendRadius").map((d) => d.code)).toEqual(["HK-MFG-005"])
    expect(only(mk(30), "breakoutTighterThanBendRadius")).toEqual([])
  })
})

describe("HK-MFG-006 bundleOverSleeveCapacity", () => {
  const mk = (sleeve: string, gauges: ReadonlyArray<string>) => {
    const part = { mpn: "BS-16", pinCount: 16 }
    const a = connector("J1", part, { pins: Object.fromEntries(gauges.map((_, i) => [i + 1, `S${i}`])) })
    const b = connector("J2", { ...part, mpn: "BS-16B" }, { pins: Object.fromEntries(gauges.map((_, i) => [i + 1, `S${i}`])) })
    return compileDesign(
      harness("t", {
        revision: "A", units: "mm", connectors: [a, b],
        wires: gauges.map((g, i) => wire(`W${i}`, a.pin(i + 1), b.pin(i + 1), { gauge: g, color: "red", length: 100 })),
        branches: [branch("main", { path: [a, b], sleeve, nominalLength: 100 })]
      })
    ).hir
  }
  it("fires when the estimated bundle exceeds the sleeve, passes inside it", () => {
    // 10x 12AWG (3.9mm OD) ~ 14.2mm bundle > 6mm sleeve
    expect(only(mk("braided-pet-6", Array.from({ length: 10 }, () => "12AWG")), "bundleOverSleeveCapacity").map((d) => d.code)).toEqual(["HK-MFG-006"])
    // 4x 24AWG (1.6mm) ~ 3.7mm < 6mm
    expect(only(mk("braided-pet-6", Array.from({ length: 4 }, () => "24AWG")), "bundleOverSleeveCapacity")).toEqual([])
  })
  it("stays silent for unparseable sleeves or gaugeless wires", () => {
    expect(only(mk("custom-sleeve", ["12AWG"]), "bundleOverSleeveCapacity")).toEqual([])
  })
})
