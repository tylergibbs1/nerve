import { describe, expect, it } from "vitest"
import {
  compileDesign,
  connector,
  harness,
  runRules,
  wire,
  type ConnectorPart
} from "@grayhaven/nerve"
import { MolexMicroFit } from "@grayhaven/nerve-connectors"
import {
  builtinRules,
  missingSeal,
  requireApprovedParts,
  sealIncompatible,
  terminalIncompatible
} from "@grayhaven/nerve-rules"

const sealedPart: ConnectorPart = {
  mpn: "SEALED-2",
  pinCount: 2,
  sealed: true,
  compatibleTerminals: ["T-100"],
  compatibleSeals: ["S-100"]
}

const make = (
  opts: Parameters<typeof connector>[2],
  partOverride: Partial<ConnectorPart> = {}
) => {
  const part = { ...sealedPart, ...partOverride }
  const a = connector("J1", part, opts)
  const b = connector("J2", part, opts)
  return compileDesign(
    harness("registry-fixture", {
      revision: "A",
      units: "mm",
      connectors: [a, b],
      wires: [
        wire("W1", a.pin(1), b.pin(1), { gauge: "20AWG", color: "red", length: 100, signal: "SIG" }),
        wire("W2", a.pin(2), b.pin(2), { gauge: "20AWG", color: "black", length: 100, signal: "GND" })
      ]
    })
  ).hir
}

describe("per-pin terminals and seals (PRD §30)", () => {
  it("carries terminal/seal assignments into HIR pins and the BOM", () => {
    const hir = make({
      pins: { 1: "SIG", 2: "GND" },
      terminals: "T-100",
      seals: { 1: "S-100", 2: "S-100" }
    })
    expect(hir.connectors[0]?.pins[0]).toMatchObject({
      pin: "1",
      terminal: "T-100",
      seal: "S-100"
    })
    const bom = Object.fromEntries(hir.bom.map((i) => [i.mpn, i]))
    expect(bom["T-100"]).toMatchObject({ category: "terminal", quantity: 4 })
    expect(bom["S-100"]).toMatchObject({ category: "seal", quantity: 4 })
    expect(bom["T-100"]?.usedBy).toContain("connector:J1.pin:1")
  })

  it("HK-CONN-012: terminal not in the part's compatible list", () => {
    const hir = make({ pins: { 1: "SIG", 2: "GND" }, terminals: "WRONG-1", seals: "S-100" })
    const diags = runRules(hir, [terminalIncompatible])
    expect(diags.map((d) => d.code)).toEqual(["HK-CONN-012", "HK-CONN-012", "HK-CONN-012", "HK-CONN-012"])
    expect(diags[0]?.message).toContain("allowed: T-100")
  })

  it("HK-CONN-013: sealed connector with unsealed populated pin", () => {
    const hir = make({ pins: { 1: "SIG", 2: "GND" }, terminals: "T-100" })
    const diags = runRules(hir, [missingSeal])
    expect(diags).toHaveLength(4) // 2 pins × 2 connectors
    expect(diags[0]?.code).toBe("HK-CONN-013")
  })

  it("HK-CONN-014: seal not in the part's compatible list", () => {
    const hir = make({ pins: { 1: "SIG", 2: "GND" }, terminals: "T-100", seals: "WRONG-S" })
    const diags = runRules(hir, [sealIncompatible])
    expect(diags[0]?.code).toBe("HK-CONN-014")
  })

  it("a fully sealed, compatible assignment passes all built-ins", () => {
    const hir = make({ pins: { 1: "SIG", 2: "GND" }, terminals: "T-100", seals: "S-100" })
    expect(
      runRules(hir, builtinRules).filter((d) => d.severity === "error")
    ).toEqual([])
  })
})

describe("approvals and provenance (PRD §30 acceptance)", () => {
  it("requireApprovedParts flags BOM items off the org list without mutating library data", () => {
    const hir = make({ pins: { 1: "SIG", 2: "GND" }, terminals: "T-100", seals: "S-100" })
    const diags = runRules(hir, [requireApprovedParts(["SEALED-2", "T-100"])])
    expect(diags.map((d) => d.target)).toEqual(["bom:S-100"])
    expect(diags[0]?.code).toBe("HK-DOC-004")
    // Library part object is untouched — approval lives in org config.
    expect("approved" in sealedPart).toBe(false)
  })

  it("library parts carry provenance into HIR", () => {
    const j1 = connector("J1", MolexMicroFit["43025-0800"], { pins: { 1: "SIG" } })
    const j2 = connector("J2", MolexMicroFit["43020-0800"], { pins: { 1: "SIG" } })
    const { hir } = compileDesign(
      harness("prov", {
        revision: "A",
        units: "mm",
        connectors: [j1, j2],
        wires: [wire("W1", j1.pin(1), j2.pin(1), { gauge: "20AWG", color: "red", length: 50, signal: "SIG" })]
      })
    )
    expect(hir.connectors[0]?.provenance).toMatchObject({ verification: "inspired-by" })
    expect(hir.connectors[0]?.crimpTool).toBe("63819-0000")
  })
})
