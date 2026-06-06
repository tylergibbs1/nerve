/**
 * Molex Micro-Fit 3.0 connector family (3.00mm pitch).
 *
 * VERIFIED against Molex catalog data 2026-06-06 (PRD §30):
 * - 43030 female terminals: 43030-0007 = 20-24 AWG, 43030-0010 = 26-30 AWG
 * - 43031 male terminals mirror those ranges
 * - Family wire range is therefore 20-30 AWG — Micro-Fit 3.0 does NOT
 *   accept 18 AWG in any contact series (43030 / 43031 / RMF 46235)
 * - 8.5 A max per circuit, 600 V; hand crimp tool 63819-0000
 */
import type { ConnectorPart } from "@grayhaven/nerve"

export const MolexMicroFit = {
  /** Micro-Fit 3.0 receptacle housing, dual row, 8 circuits. */
  "43025-0800": {
    mpn: "43025-0800",
    manufacturer: "Molex",
    family: "Micro-Fit 3.0",
    description: "Micro-Fit 3.0 receptacle housing, dual row, 8 circuits",
    gender: "receptacle",
    pinCount: 8,
    pinNumbering: "molex-micro-fit-dual-row",
    cavityLayout: { rows: 2, columns: 4 },
    matingMpn: "43020-0800",
    compatibleTerminals: ["43030-0007", "43030-0010"],
    wireGaugeRange: { min: "30AWG", max: "20AWG" },
    currentLimitA: 8.5,
    voltageLimitV: 600,
    crimpTool: "63819-0000",
    insertionTool: "11-03-0044",
    extractionTool: "11-03-0043",
    provenance: {
      source: "Molex catalog",
      datasheet: "https://www.molex.com/en-us/products/part-detail/430250800",
      verification: "verified",
      lastVerified: "2026-06-06"
    }
  },
  /** Micro-Fit 3.0 plug housing, dual row, 8 circuits. */
  "43020-0800": {
    mpn: "43020-0800",
    manufacturer: "Molex",
    family: "Micro-Fit 3.0",
    description: "Micro-Fit 3.0 plug housing, dual row, 8 circuits",
    gender: "plug",
    pinCount: 8,
    pinNumbering: "molex-micro-fit-dual-row",
    cavityLayout: { rows: 2, columns: 4 },
    matingMpn: "43025-0800",
    compatibleTerminals: ["43031-0007", "43031-0010"],
    wireGaugeRange: { min: "30AWG", max: "20AWG" },
    currentLimitA: 8.5,
    voltageLimitV: 600,
    crimpTool: "63819-0000",
    insertionTool: "11-03-0044",
    extractionTool: "11-03-0043",
    provenance: {
      source: "Molex catalog",
      datasheet: "https://www.molex.com/en-us/products/part-detail/430200800",
      verification: "verified",
      lastVerified: "2026-06-06"
    }
  }
} as const satisfies Readonly<Record<string, ConnectorPart>>

