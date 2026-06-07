import { describe, expect, it } from "vitest"
import {
  builtinRules,
  codesToNumbers,
  ruleCategory,
  ruleCodeFromNumber,
  ruleCodeNumber
} from "@grayhaven/nerve-rules"

describe("rule code numbers", () => {
  it("round-trips every built-in rule code", () => {
    for (const r of builtinRules) {
      const n = ruleCodeNumber(r.code)
      expect(n, r.code).toBeDefined()
      expect(ruleCodeFromNumber(n!), r.code).toBe(r.code)
    }
  })

  it("built-in numbers are unique and sort by category band", () => {
    const ns = builtinRules.map((r) => ruleCodeNumber(r.code)!)
    expect(new Set(ns).size).toBe(ns.length)
    expect(ruleCodeNumber("HK-DOC-001")).toBe(1001)
    expect(ruleCodeNumber("HK-MFG-004")).toBe(2004)
    expect(ruleCodeNumber("HK-WIRE-004")).toBe(3004)
    expect(ruleCodeNumber("HK-ELEC-003")).toBe(4003)
    expect(ruleCodeNumber("HK-CONN-011")).toBe(5011)
  })

  it("custom and malformed codes return undefined (strings stay the contract)", () => {
    for (const code of ["ORG-042", "SHOP-001", "HK-NOPE-001", "HK-DOC-1", "HK-DOC-0001", ""]) {
      expect(ruleCodeNumber(code), code).toBeUndefined()
    }
    expect(ruleCodeFromNumber(6001)).toBeUndefined() // no band
    expect(ruleCodeFromNumber(1000)).toBeUndefined() // suffix 0 invalid
    expect(ruleCodeFromNumber(2004.5)).toBeUndefined()
  })

  it("category math works from either representation", () => {
    expect(ruleCategory("HK-ELEC-001")).toBe("ELEC")
    expect(ruleCategory(5011)).toBe("CONN")
    expect(ruleCategory("ORG-042")).toBeUndefined()
  })

  it("codesToNumbers dedupes, sorts, and drops custom codes", () => {
    expect(codesToNumbers(["HK-CONN-011", "HK-DOC-001", "HK-CONN-011", "ORG-042"])).toEqual([
      1001, 5011
    ])
  })
})
