/** Library-wide integrity: every part in every family is well-formed. */
import { describe, expect, it } from "vitest"
import { parseAwg } from "@grayhaven/nerve-rules"
import { allParts, DeutschDT, nerveConnectorsProvider } from "../src/index.js"

describe("bundled part library", () => {
  it("every part is internally consistent", () => {
    expect(Object.keys(allParts).length).toBeGreaterThanOrEqual(19)
    for (const [key, p] of Object.entries(allParts)) {
      expect(p.mpn, key).toBe(key)
      expect(p.pinCount, key).toBeGreaterThan(0)
      expect(p.provenance?.verification, key).toBeDefined()
      expect(p.provenance?.lastVerified, key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (p.cavityLayout !== undefined) {
        expect(p.cavityLayout.rows * p.cavityLayout.columns, key).toBeGreaterThanOrEqual(p.pinCount)
      }
      if (p.wireGaugeRange !== undefined) {
        const thin = parseAwg(p.wireGaugeRange.min)
        const thick = parseAwg(p.wireGaugeRange.max)
        expect(thin, key).toBeDefined()
        expect(thick, key).toBeDefined()
        // AWG: larger number = thinner wire; min names the thinnest accepted.
        expect(thin!, key).toBeGreaterThanOrEqual(thick!)
      }
    }
  })

  it("mating references resolve within the library", () => {
    for (const [key, p] of Object.entries(allParts)) {
      if (p.matingMpn === undefined) continue
      // Headers (JST B*B-*) are PCB-side and intentionally out of library scope.
      if (/^B\d+B-/.test(p.matingMpn)) continue
      expect(allParts[p.matingMpn], `${key} mates ${p.matingMpn}`).toBeDefined()
      expect(allParts[p.matingMpn]?.matingMpn, key).toBe(key)
    }
  })

  it("DT plugs and receptacles pair with opposite genders", () => {
    expect(DeutschDT["DT06-2S"].gender).not.toBe(DeutschDT["DT04-2P"].gender)
  })

  it("the bundled provider serves and searches the library", () => {
    expect(nerveConnectorsProvider.get("PHR-4")?.family).toBe("PH")
    expect(nerveConnectorsProvider.search?.("mega-fit")).toContain("76829-0008")
  })
})
