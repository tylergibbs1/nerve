import { describe, expect, it } from "vitest"
import {
  compileDesign,
  computeNets,
  connector,
  harness,
  rule,
  runRules,
  splice,
  wire,
  type ConnectorPart,
  type HarnessDesign
} from "@grayhaven/nerve"

const part: ConnectorPart = { mpn: "TEST-4", pinCount: 4 }
const j1 = connector("J1", part, { pins: { 1: "PWR", 2: "GND" } })
const j2 = connector("J2", part, { pins: { 1: "PWR", 2: "GND" } })
const j3 = connector("J3", part, { pins: { 1: "PWR" } })
const sp = splice("SP1", { notes: "power tap" })

const design = (wires: HarnessDesign["wires"]): HarnessDesign =>
  harness("nets-fixture", {
    revision: "A",
    units: "mm",
    connectors: [j1, j2, j3],
    splices: [sp],
    wires
  })

describe("computeNets", () => {
  it("nets are splice-transitive", () => {
    const { hir } = compileDesign(
      design([
        wire("W1", j1.pin(1), sp, { signal: "PWR" }),
        wire("W2", j2.pin(1), sp, { signal: "PWR" }),
        wire("W3", j3.pin(1), sp, { signal: "PWR" }),
        wire("W4", j1.pin(2), j2.pin(2), { signal: "GND" })
      ])
    )
    const nets = computeNets(hir)
    // All three pins + the splice share one net…
    expect(nets.rootOf({ connector: "J2", pin: "1" })).toBe(nets.rootOf({ splice: "SP1" }))
    expect(nets.rootOf({ connector: "J3", pin: "1" })).toBe(nets.rootOf({ connector: "J1", pin: "1" }))
    // …and GND is a separate net.
    expect(nets.rootOf({ connector: "J1", pin: "2" })).not.toBe(nets.rootOf({ connector: "J1", pin: "1" }))
    expect(nets.groups).toHaveLength(2)
    expect(nets.nameOf({ splice: "SP1" })).toBe("PWR")
    expect(nets.nameOf({ connector: "J1", pin: "2" })).toBe("GND")
  })

  it("is independent of wire authoring order", () => {
    const a = compileDesign(
      design([
        wire("W1", j1.pin(1), sp, { signal: "PWR" }),
        wire("W2", j2.pin(1), sp, { signal: "PWR" })
      ])
    ).hir
    const b = compileDesign(
      design([
        wire("W2", j2.pin(1), sp, { signal: "PWR" }),
        wire("W1", j1.pin(1), sp, { signal: "PWR" })
      ])
    ).hir
    expect(computeNets(a).groups).toEqual(computeNets(b).groups)
  })

  it("nameOf is undefined for endpoints on no wire", () => {
    const { hir } = compileDesign(design([wire("W1", j1.pin(1), j2.pin(1), { signal: "PWR" })]))
    expect(computeNets(hir).nameOf({ connector: "J1", pin: "2" })).toBeUndefined()
  })
})

describe("RuleContext.nets", () => {
  it("custom rules get the shared connectivity lazily", () => {
    const { hir } = compileDesign(
      design([
        wire("W1", j1.pin(1), sp, { signal: "PWR" }),
        wire("W2", j2.pin(1), sp, { signal: "PWR" })
      ])
    )
    const sameNet = rule("pins-share-net", (ctx) => {
      if (
        ctx.nets.rootOf({ connector: "J1", pin: "1" }) ===
        ctx.nets.rootOf({ connector: "J2", pin: "1" })
      ) {
        ctx.report({ severity: "info", message: "J1.1 and J2.1 are common" })
      }
    })
    const diags = runRules(hir, [sameNet])
    expect(diags.map((d) => d.message)).toEqual(["J1.1 and J2.1 are common"])
  })
})
