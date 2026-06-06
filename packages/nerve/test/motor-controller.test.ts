/**
 * Golden corpus seed (PRD §41): the PRD §9.1 motor-controller harness.
 *
 * These tests pin the three M0 guarantees:
 *   1. The PRD example compiles through the DSL unmodified.
 *   2. The emitted HIR round-trips through the versioned Effect Schema codec.
 *   3. Compilation is deterministic — authoring order never changes the bytes.
 */
import { describe, expect, it } from "vitest"
import {
  Codes,
  compileDesign,
  connector,
  decodeHir,
  harness,
  hasErrors,
  wire,
  type HarnessDesign
} from "@grayhaven/nerve"
import design from "../../../examples/motor-controller/src/main.harness.js"

describe("PRD §9.1 motor-controller harness (golden)", () => {
  const { hir, diagnostics } = compileDesign(design)

  it("compiles without diagnostics", () => {
    expect(diagnostics).toEqual([])
    expect(hasErrors(diagnostics)).toBe(false)
  })

  it("emits HIR that round-trips through the schema codec", () => {
    const json = JSON.parse(JSON.stringify(hir))
    const decoded = decodeHir(json)
    expect(decoded).toEqual(hir)
  })

  it("normalizes the design into expected HIR shape", () => {
    expect(hir.schemaVersion).toBe("0.1.0")
    expect(hir.harness).toEqual({
      id: "motor-controller-harness",
      revision: "A",
      units: "mm",
      metadata: {}
    })
    expect(hir.connectors.map((c) => c.ref)).toEqual(["J1", "M1"])
    expect(hir.wires.map((w) => w.id)).toEqual(["W1", "W2", "W3", "W4"])
    expect(hir.branches.map((b) => b.path)).toEqual([["J1", "M1"]])
    expect(hir.labels[0]).toMatchObject({
      id: "L1",
      text: "MOTOR CTRL A",
      attachTo: "main",
      offsetFrom: "J1",
      distance: 50
    })
    // Connector BOM rollup: one housing MPN per side.
    expect(hir.bom.map((b) => [b.mpn, b.quantity])).toEqual([
      ["43020-0800", 1],
      ["43025-0800", 1]
    ])
  })

  it("is deterministic regardless of authoring order", () => {
    const shuffled: HarnessDesign = {
      ...design,
      connectors: [...design.connectors].reverse(),
      wires: [...design.wires].reverse(),
      branches: [...design.branches].reverse(),
      labels: [...design.labels].reverse()
    }
    const a = JSON.stringify(compileDesign(design).hir)
    const b = JSON.stringify(compileDesign(shuffled).hir)
    expect(b).toBe(a)
  })

  it("matches the golden HIR snapshot", () => {
    expect(hir).toMatchSnapshot()
  })
})

describe("structural diagnostics", () => {
  const part = { mpn: "TEST-2", pinCount: 2 }

  it("reports duplicate wire IDs with a stable code", () => {
    const a = connector("J1", part, { pins: { 1: "SIG", 2: "GND" } })
    const b = connector("J2", part, { pins: { 1: "SIG", 2: "GND" } })
    const { diagnostics } = compileDesign(
      harness("dup-wire", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        wires: [
          wire("W1", a.pin(1), b.pin(1)),
          wire("W1", a.pin(2), b.pin(2))
        ]
      })
    )
    expect(diagnostics).toEqual([
      {
        code: Codes.DuplicateWireId,
        severity: "error",
        message: "Wire ID W1 is defined more than once.",
        target: "wire:W1"
      }
    ])
  })

  it("reports undefined pin and connector references", () => {
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const { diagnostics } = compileDesign(
      harness("bad-refs", {
        revision: "A",
        units: "mm",
        connectors: [a],
        wires: [
          // Pin 9 exceeds the 2-pin part; J9 doesn't exist at all.
          wire("W1", a.pin(9), { kind: "pin-ref", connector: "J9", pin: "1" })
        ]
      })
    )
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      Codes.UndefinedConnectorRef,
      Codes.UndefinedPinRef
    ])
    expect(diagnostics.find((d) => d.code === Codes.UndefinedPinRef)?.target).toBe(
      "connector:J1.pin:9"
    )
  })

  it("reports a wire that starts and ends on the same pin", () => {
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const { diagnostics } = compileDesign(
      harness("loop-wire", {
        revision: "A",
        units: "mm",
        connectors: [a],
        wires: [wire("W1", a.pin(1), a.pin(1))]
      })
    )
    expect(diagnostics.map((d) => d.code)).toEqual([Codes.WireEndpointsIdentical])
  })

  it("accepts unassigned-but-physical pins within pinCount", () => {
    const a = connector("J1", part, { pins: { 1: "SIG" } })
    const b = connector("J2", part, { pins: { 1: "SIG" } })
    const { diagnostics } = compileDesign(
      harness("physical-pin", {
        revision: "A",
        units: "mm",
        connectors: [a, b],
        // Pin 2 carries no signal assignment but exists on the 2-pin part.
        wires: [wire("W1", a.pin(2), b.pin(2))]
      })
    )
    expect(diagnostics).toEqual([])
  })
})
