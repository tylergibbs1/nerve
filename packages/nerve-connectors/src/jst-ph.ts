/**
 * JST PH family (2.00mm pitch, 2A). Crimp contacts: SPH-002T-P0.5S
 * (32-28 AWG) and SPH-004T-P0.5S (28-24 AWG).
 * Provenance: JST catalog data, inspired-by tier.
 */
import type { ConnectorPart } from "@grayhaven/nerve"

const provenance = {
  source: "JST catalog",
  datasheet: "https://www.jst-mfg.com/product/detail_e.php?series=199",
  verification: "inspired-by",
  lastVerified: "2026-06-07"
} as const

const housing = (circuits: number): ConnectorPart => ({
  mpn: `PHR-${circuits}`,
  manufacturer: "JST",
  family: "PH",
  description: `JST PH housing, ${circuits} circuits`,
  gender: "receptacle",
  pinCount: circuits,
  cavityLayout: { rows: 1, columns: circuits },
  matingMpn: `B${circuits}B-PH-K-S`,
  compatibleTerminals: ["SPH-002T-P0.5S", "SPH-004T-P0.5S"],
  wireGaugeRange: { min: "32AWG", max: "24AWG" },
  currentLimitA: 2,
  voltageLimitV: 100,
  provenance
})

export const JstPH = {
  "PHR-2": housing(2),
  "PHR-3": housing(3),
  "PHR-4": housing(4),
  "PHR-6": housing(6)
} satisfies Record<string, ConnectorPart>
