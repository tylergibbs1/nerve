import { defineConfig } from "@grayhaven/nerve"

export default defineConfig({
  units: "mm",
  defaultWireTolerance: 10,
  outputDir: "dist",
  costing: {
    currency: "USD",
    laborRatePerHour: 38,
    scrapFactor: 0.05,
    yield: 0.97,
    longLeadThresholdDays: 60,
    parts: {
      "XT60PW-M": { unitCost: 1.1, supplier: "AMASS" },
      "XT60PW-F": { unitCost: 1.2, supplier: "AMASS" },
      "63824-1": { unitCost: 0.42, supplier: "TE" },
      "76829-0008": { unitCost: 1.85, supplier: "Molex" },
      "43025-0800": { unitCost: 0.68, supplier: "Molex" },
      "43025-1600": { unitCost: 1.32, supplier: "Molex", leadTimeDays: 84 },
      "PHR-2": { unitCost: 0.08, supplier: "JST" },
      "PHR-4": { unitCost: 0.11, supplier: "JST" },
      "GT-2.5": { unitCost: 0.22, supplier: "TE" },
      "D-406-0001": { unitCost: 1.95, supplier: "TE", lifecycle: "nrnd" },
    },
    wireCostPerMeter: {
      "12AWG": 0.92,
      "14AWG": 0.61,
      "18AWG": 0.34,
      "20AWG": 0.24,
      "22AWG": 0.19,
      "24AWG": 0.14,
      "26AWG": 0.11,
    },
    sleeveCostPerMeter: 1.4,
    labelUnitCost: 0.35,
  },
})
