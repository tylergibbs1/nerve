/**
 * AMASS XT60 power connector family (30A continuous, 60A peak).
 * Provenance: AMASS catalog data, inspired-by tier (PRD §30/§38) — verify
 * before certification-grade use.
 */
import type { ConnectorPart } from "@grayhaven/nerve"

const provenance = {
  source: "AMASS catalog",
  datasheet: "https://www.amass-china.com/xt60",
  verification: "inspired-by",
  lastVerified: "2026-06-07"
} as const

export const AmassXT60 = {
  /** XT60PW male, PCB/panel, 2 circuits. */
  "XT60PW-M": {
    mpn: "XT60PW-M",
    manufacturer: "AMASS",
    family: "XT60",
    description: "XT60 power connector",
    pinCount: 2,
    cavityLayout: { rows: 1, columns: 2 },
    matingMpn: "XT60PW-F",
    wireGaugeRange: { min: "14AWG", max: "12AWG" },
    currentLimitA: 30,
    voltageLimitV: 500,
    provenance
  },
  /** XT60PW female, 2 circuits. */
  "XT60PW-F": {
    mpn: "XT60PW-F",
    manufacturer: "AMASS",
    family: "XT60",
    description: "XT60 power connector",
    gender: "receptacle",
    pinCount: 2,
    cavityLayout: { rows: 1, columns: 2 },
    matingMpn: "XT60PW-M",
    wireGaugeRange: { min: "14AWG", max: "12AWG" },
    currentLimitA: 30,
    voltageLimitV: 500,
    provenance
  }
} satisfies Record<string, ConnectorPart>
