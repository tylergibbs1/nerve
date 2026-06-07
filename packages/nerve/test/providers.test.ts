/** Part-data provider abstraction (PRD §42). */
import { describe, expect, it } from "vitest"
import { resolvePart, staticProvider, type ConnectorPart } from "@grayhaven/nerve"

const part = (mpn: string, extra: Partial<ConnectorPart> = {}): ConnectorPart => ({
  mpn,
  pinCount: 4,
  ...extra
})

describe("staticProvider", () => {
  const lib = staticProvider("lib", {
    "PHR-4": part("PHR-4", { family: "PH", description: "JST PH housing" })
  })
  it("gets by MPN and searches by mpn/family/description", () => {
    expect(lib.get("PHR-4")?.mpn).toBe("PHR-4")
    expect(lib.get("NOPE")).toBeUndefined()
    expect(lib.search?.("ph housing")).toEqual(["PHR-4"])
    expect(lib.search?.("zzz")).toEqual([])
  })
})

describe("resolvePart", () => {
  it("first provider wins; agreeing providers are silent", () => {
    const a = staticProvider("a", { X: part("X", { pinCount: 4 }) })
    const b = staticProvider("b", { X: part("X", { pinCount: 4 }) })
    const r = resolvePart([a, b], "X")
    expect(r.provider).toBe("a")
    expect(r.diagnostics).toEqual([])
  })

  it("conflicting load-bearing fields produce HK-LIB-001, never a silent overwrite", () => {
    const plm = staticProvider("plm", { X: part("X", { pinCount: 4, currentLimitA: 5 }) })
    const vendor = staticProvider("vendor", { X: part("X", { pinCount: 6, currentLimitA: 5 }) })
    const r = resolvePart([plm, vendor], "X")
    expect(r.part?.pinCount).toBe(4) // plm wins
    expect(r.diagnostics).toHaveLength(1)
    expect(r.diagnostics[0]).toMatchObject({ code: "HK-LIB-001", severity: "warning" })
    expect(r.diagnostics[0]!.message).toContain("pinCount")
  })

  it("unknown MPN resolves to nothing with no diagnostics", () => {
    expect(resolvePart([staticProvider("a", {})], "MISSING")).toEqual({ diagnostics: [] })
  })
})
