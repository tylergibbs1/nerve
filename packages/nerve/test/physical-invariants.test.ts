import { describe, expect, it } from "vitest"
import {
  Codes,
  branch,
  cable,
  compileDesign,
  connector,
  harness,
  label,
  protection,
  splice,
  wire
} from "@grayhaven/nerve"

const part = { mpn: "TEST-2", pinCount: 2 }

describe("physical-model invariants", () => {
  it("rejects two wires claiming the same canonical cable conductor", () => {
    const a = connector("J1", part, { pins: { 1: "A", 2: "B" } })
    const b = connector("J2", part, { pins: { 1: "A", 2: "B" } })
    const { hir, diagnostics } = compileDesign(
      harness("duplicate-conductor", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        cables: [cable("C1", { conductors: 2 })],
        wires: [
          wire("W1", a.pin(1), b.pin(1), { cable: "C1", conductor: "01" }),
          wire("W2", a.pin(2), b.pin(2), { cable: "C1", conductor: 1 })
        ]
      })
    )

    expect(hir.wires.map((w) => w.conductor)).toEqual(["1", "1"])
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: Codes.DuplicateCableConductor,
        target: "wire:W2",
        targets: ["wire:W1"],
        data: expect.objectContaining({ cable: "C1", conductor: "1" })
      })
    )
  })

  it("rejects negative and length-sized tolerances", () => {
    const a = connector("J1", part, { pins: { 1: "A", 2: "B" } })
    const b = connector("J2", part, { pins: { 1: "A", 2: "B" } })
    const { diagnostics } = compileDesign(
      harness("bad-tolerances", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [
          wire("W1", a.pin(1), b.pin(1), { length: 100, lengthTolerance: -1 }),
          wire("W2", a.pin(2), b.pin(2), { length: 100, lengthTolerance: 100 })
        ]
      })
    )

    expect(diagnostics.filter((d) => d.code === Codes.InvalidWireQuantity)).toHaveLength(2)
  })

  it("rejects conductor references without a cable and outside cable capacity", () => {
    const a = connector("J1", part, { pins: { 1: "A", 2: "B" } })
    const b = connector("J2", part, { pins: { 1: "A", 2: "B" } })
    const { diagnostics } = compileDesign(
      harness("bad-conductor-refs", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        cables: [cable("C1", { conductors: 2 })],
        wires: [
          wire("W1", a.pin(1), b.pin(1), { conductor: 1 }),
          wire("W2", a.pin(2), b.pin(2), { cable: "C1", conductor: 3 })
        ]
      })
    )

    expect(diagnostics.filter((d) => d.code === Codes.InvalidCableConductor)).toHaveLength(2)
  })

  it("rejects impossible scalar quantities before domain rules run", () => {
    const a = connector("J1", part, { pins: { 1: "A" } })
    const b = connector("J2", part, { pins: { 1: "A" } })
    const invalidConnector = connector(
      "J3",
      {
        mpn: "BAD",
        pinCount: 0,
        cavityLayout: { rows: 0, columns: 1 },
        currentLimitA: 0,
        voltageLimitV: -1
      },
      { pins: {} }
    )
    const joint = splice("S1", { location: -1 })
    const { diagnostics } = compileDesign(
      harness("invalid-quantities", {
        revision: "A",
        units: "mm",
        connectors: [a, b, invalidConnector],
        splices: [joint],
        cables: [cable("C1", { conductors: 0, outerDiameter: 0 })],
        wires: [
          wire("W1", a.pin(1), joint, {
            length: 100,
            voltageRating: 0,
            currentEstimate: -1
          }),
          wire("W2", joint, b.pin(1), { length: 100 })
        ],
        branches: [
          branch("B1", {
            path: [a, b],
            nominalLength: 0,
            breakoutDistance: -1,
            minBendRadius: 0
          })
        ],
        labels: [label("L1", { text: "BAD", attachTo: "B1", distance: -1, quantity: 0 })],
        protections: [protection("F1", { kind: "fuse", ratingA: 0, protects: ["W1"] })]
      })
    )

    const codes = new Set(diagnostics.map((d) => d.code))
    expect(codes).toEqual(
      new Set([
        Codes.InvalidConnectorQuantity,
        Codes.InvalidWireQuantity,
        Codes.InvalidBranchGeometry,
        Codes.InvalidLabelQuantity,
        Codes.InvalidSpliceLocation,
        Codes.InvalidCableDefinition,
        Codes.InvalidProtectionRating
      ])
    )
  })
})
