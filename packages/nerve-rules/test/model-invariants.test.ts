import { describe, expect, it } from "vitest"
import {
  cable,
  compileDesign,
  connector,
  harness,
  runRules,
  splice,
  wire
} from "@grayhaven/nerve"
import {
  missingCableConductor,
  missingTerminal,
  uncoveredNet
} from "@grayhaven/nerve-rules"

const completeWire = { gauge: "24AWG", color: "red", length: 100, signal: "SIG" }

describe("manufacturing completeness", () => {
  it("requires a terminal on every wired cavity of a crimp-contact housing", () => {
    const part = { mpn: "CRIMP-1", pinCount: 1, compatibleTerminals: ["T-100"] }
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const b = connector("J2", part, { pins: { 1: "SIG" }, terminals: "T-100" })
    const hir = compileDesign(
      harness("terminals", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [wire("W1", a.pin(1), b.pin(1), completeWire)]
      })
    ).hir

    expect(runRules(hir, [missingTerminal])).toEqual([
      expect.objectContaining({
        code: "HK-CONN-021",
        severity: "error",
        target: "connector:J1.pin:1",
        targets: ["wire:W1"]
      })
    ])
  })

  it("does not invent terminals for connector families without removable contacts", () => {
    const part = { mpn: "SOLDER-CUP-1", pinCount: 1 }
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const b = connector("J2", part, { pins: { 1: "SIG" } })
    const hir = compileDesign(
      harness("solder", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [wire("W1", a.pin(1), b.pin(1), completeWire)]
      })
    ).hir

    expect(runRules(hir, [missingTerminal])).toEqual([])
  })

  it("warns when cable membership does not identify a physical conductor", () => {
    const part = { mpn: "P", pinCount: 1 }
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const b = connector("J2", part, { pins: { 1: "SIG" } })
    const hir = compileDesign(
      harness("cable-member", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        cables: [cable("C1", { conductors: 2 })],
        wires: [wire("W1", a.pin(1), b.pin(1), { ...completeWire, cable: "C1" })]
      })
    ).hir

    expect(runRules(hir, [missingCableConductor])).toEqual([
      expect.objectContaining({ code: "HK-MFG-011", severity: "warning", target: "wire:W1" })
    ])
  })
})

describe("continuity-test reachability", () => {
  it("rejects a net with fewer than two accessible connector pins", () => {
    const part = { mpn: "P", pinCount: 1 }
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const s1 = splice("S1", { type: "crimp" })
    const s2 = splice("S2", { type: "crimp" })
    const hir = compileDesign(
      harness("unreachable", {
        revision: "A",
        units: "mm",
        connectors: [a],
        splices: [s1, s2],
        wires: [
          wire("W1", a.pin(1), s1, completeWire),
          wire("W2", s1, s2, completeWire),
          wire("W3", s2, s1, completeWire)
        ]
      })
    ).hir

    expect(runRules(hir, [uncoveredNet])).toEqual([
      expect.objectContaining({
        code: "HK-ELEC-011",
        severity: "error",
        data: { accessiblePins: 1, wireCount: 3 }
      })
    ])
  })

  it("accepts a net with two accessible pins even when splices are chained", () => {
    const part = { mpn: "P", pinCount: 1 }
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const b = connector("J2", part, { pins: { 1: "SIG" } })
    const s1 = splice("S1", { type: "crimp" })
    const s2 = splice("S2", { type: "crimp" })
    const hir = compileDesign(
      harness("reachable", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        splices: [s1, s2],
        wires: [
          wire("W1", a.pin(1), s1, completeWire),
          wire("W2", s1, s2, completeWire),
          wire("W3", s2, b.pin(1), completeWire)
        ]
      })
    ).hir

    expect(runRules(hir, [uncoveredNet])).toEqual([])
  })
})
