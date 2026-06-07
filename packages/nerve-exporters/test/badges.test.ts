import { describe, expect, it } from "vitest"
import { compileDesign, connector, harness, runRules, splice, wire, type ConnectorPart } from "@grayhaven/nerve"
import { builtinRules } from "@grayhaven/nerve-rules"
import { boardDrawing, connectorFacesDrawing, diagnosticBadges, parseRef, schematicDrawing } from "@grayhaven/nerve-exporters"

const part: ConnectorPart = { mpn: "TEST-4", pinCount: 4 }

/** A deliberately broken harness: untwisted CAN pair + overloaded wire. */
const brokenHir = () => {
  const j1 = connector("J1", part, { pins: { 1: "CAN_H", 2: "CAN_L", 3: "VBAT_24V", 4: "GND" } })
  const j2 = connector("J2", part, { pins: { 1: "CAN_H", 2: "CAN_L", 3: "VBAT_24V", 4: "GND" } })
  const { hir } = compileDesign(
    harness("badge-fixture", {
      revision: "A",
      units: "mm",
      connectors: [j1, j2],
      wires: [
        wire("W1", j1.pin(1), j2.pin(1), { signal: "CAN_H", gauge: "24AWG", color: "yellow", length: 100 }),
        wire("W2", j1.pin(2), j2.pin(2), { signal: "CAN_L", gauge: "24AWG", color: "green", length: 100 }),
        wire("W3", j1.pin(3), j2.pin(3), {
          signal: "VBAT_24V",
          gauge: "24AWG",
          color: "red",
          length: 100,
          currentEstimate: 5
        }),
        wire("W4", j1.pin(4), j2.pin(4), { signal: "GND", gauge: "24AWG", color: "black", length: 100 })
      ]
    })
  )
  const diagnostics = runRules(hir, builtinRules)
  return { ...hir, diagnostics }
}

describe("parseRef", () => {
  it("parses the PRD §19 grammar", () => {
    expect(parseRef("wire:W1")).toEqual({ kind: "wire", ref: "W1" })
    expect(parseRef("connector:J1.pin:3")).toEqual({ kind: "pin", ref: "J1", pin: "3" })
    expect(parseRef("branch:B1")).toEqual({ kind: "branch", ref: "B1" })
    expect(parseRef("nonsense")).toBeUndefined()
  })
})

describe("diagnosticBadges", () => {
  it("multi-entity diagnostics badge every involved ref", () => {
    const hir = brokenHir()
    const elec = hir.diagnostics.filter((d) => d.code === "HK-ELEC-001")
    expect(elec.length).toBeGreaterThan(0)
    // The pair rule reports W1 with W2 as an involved target (and vice versa).
    expect(elec[0]?.targets?.length).toBeGreaterThan(0)

    const seen: Array<string> = []
    const items = diagnosticBadges(hir.diagnostics, (r) => {
      seen.push(`${r.kind}:${r.ref}`)
      return { x: seen.length * 20, y: 10, data: { wire: r.ref } }
    })
    // Both wires of the pair anchored, badge circle+text pairs emitted.
    expect(seen).toContain("wire:W1")
    expect(seen).toContain("wire:W2")
    expect(items.filter((i) => i.kind === "circle").length).toBeGreaterThan(0)
    const texts = items.filter((i) => i.kind === "text")
    expect(texts.every((t) => t.data?.["diagnostic"] !== undefined)).toBe(true)
  })

  it("groups co-anchored diagnostics into one counted badge", () => {
    const items = diagnosticBadges(
      [
        { code: "HK-A", severity: "warning", message: "a", target: "wire:W1" },
        { code: "HK-B", severity: "error", message: "b", target: "wire:W1" }
      ],
      () => ({ x: 5, y: 5 })
    )
    const circles = items.filter((i) => i.kind === "circle")
    expect(circles).toHaveLength(1)
    expect(circles[0]).toMatchObject({ fill: "#d11" }) // worst severity wins
    const text = items.find((i) => i.kind === "text")
    expect(text).toMatchObject({ text: "2", data: { diagnostic: "HK-A HK-B" } })
  })

  it("ignores info diagnostics and unresolvable refs", () => {
    const items = diagnosticBadges(
      [
        { code: "HK-I", severity: "info", message: "i", target: "wire:W1" },
        { code: "HK-X", severity: "error", message: "x", target: "wire:GHOST" }
      ],
      (r) => (r.ref === "W1" ? { x: 1, y: 1 } : undefined)
    )
    expect(items).toHaveLength(0)
  })
})

describe("badges land on every view", () => {
  it("schematic badges gauge-current errors at the wire-adjacent pins and faces/board render", () => {
    const hir = brokenHir()
    // The schematic marks error wires; pin/connector findings get badges.
    // HK-WIRE-004 targets wire:W3 (red-dash treatment, no badge), so add a
    // pin-targeted finding to verify the badge path end-to-end.
    const withPin = {
      ...hir,
      diagnostics: [
        ...hir.diagnostics,
        { code: "HK-CONN-011", severity: "error" as const, message: "swap", target: "connector:J1.pin:1", targets: ["wire:W1"] }
      ]
    }
    for (const draw of [schematicDrawing, connectorFacesDrawing]) {
      const items = draw(withPin).items
      const badge = items.find(
        (i) => i.kind === "circle" && i.data?.["diagnostic"]?.includes("HK-CONN-011") === true
      )
      expect(badge, draw.name).toBeDefined()
      expect(badge?.data).toMatchObject({ connector: "J1", pin: "1" })
    }
    // Board view has no branches here — badge resolution simply no-ops.
    expect(() => boardDrawing(withPin)).not.toThrow()
  })

  it("splice findings badge the splice symbol on the schematic", () => {
    const j1 = connector("J1", part, { pins: { 1: "PWR" } })
    const sp = splice("SP1", { notes: "tap" })
    const { hir } = compileDesign(
      harness("splice-badge", {
        revision: "A",
        units: "mm",
        connectors: [j1],
        splices: [sp],
        wires: [wire("W1", j1.pin(1), sp, { signal: "PWR" })]
      })
    )
    // SpliceTooFewWires fires during compile with structured data.
    const diag = hir.diagnostics.find((d) => d.code === "HK-SPLICE-003")
    expect(diag?.data).toMatchObject({ attachedWires: 1 })
    expect(diag?.targets).toEqual(["wire:W1"])
    const items = schematicDrawing(hir).items
    const badge = items.find(
      (i) => i.kind === "circle" && i.data?.["diagnostic"]?.includes("HK-SPLICE-003") === true
    )
    expect(badge?.data).toMatchObject({ splice: "SP1" })
  })
})
