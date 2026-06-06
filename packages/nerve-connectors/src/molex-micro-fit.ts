/**
 * Molex Micro-Fit 3.0 connector family (3.00mm pitch).
 *
 * Seed data for the verified component library (PRD §30). Field values come
 * from public Molex catalog data; treat as "inspired by" provenance until a
 * verification pass stamps them (verification status modeling lands with the
 * Registry).
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
    wireGaugeRange: { min: "30AWG", max: "18AWG" },
    crimpTool: "63819-0000",
    insertionTool: "11-03-0044",
    extractionTool: "11-03-0043",
    provenance: {
      source: "Molex catalog",
      datasheet: "https://www.molex.com/en-us/products/part-detail/430250800",
      verification: "inspired-by"
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
    wireGaugeRange: { min: "30AWG", max: "18AWG" },
    crimpTool: "63819-0000",
    insertionTool: "11-03-0044",
    extractionTool: "11-03-0043",
    provenance: {
      source: "Molex catalog",
      datasheet: "https://www.molex.com/en-us/products/part-detail/430200800",
      verification: "inspired-by"
    }
  }
} as const satisfies Readonly<Record<string, ConnectorPart>>

