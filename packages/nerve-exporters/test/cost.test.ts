import { describe, expect, it } from "vitest"
import { compileDesign, variant, type CostModel } from "@grayhaven/nerve"
import { generateBop, generateQuote, quoteCsv, quoteDiff } from "@grayhaven/nerve-exporters"
import motor from "../../../examples/motor-controller/src/main.harness.js"

const model: CostModel = {
  currency: "USD",
  laborRatePerHour: 36,
  scrapFactor: 0.05,
  yield: 0.96,
  longLeadThresholdDays: 60,
  parts: {
    "43025-0800": { unitCost: 0.68, supplier: "Molex" },
    "43020-0800": { unitCost: 0.72, supplier: "Molex", leadTimeDays: 90, lifecycle: "nrnd" },
    "43030-0007": { unitCost: 0.08, supplier: "Molex" },
    "43031-0007": { unitCost: 0.08, supplier: "Molex" }
  },
  wireCostPerMeter: { "20AWG": 0.25, "24AWG": 0.14 },
  sleeveCostPerMeter: 1.4,
  labelUnitCost: 0.35
}

const { hir } = compileDesign(motor)
const quote = generateQuote(hir, model)

describe("quote generation (PRD §29)", () => {
  it("rolls up material: parts, wire by gauge/length, sleeve, labels", () => {
    const byItem = Object.fromEntries(quote.lines.map((l) => [l.item, l]))
    expect(byItem["43025-0800"]).toMatchObject({ qty: 1, extendedCost: 0.68 })
    // W1+W2 = 840mm of 20AWG → 0.84m × 0.25
    expect(byItem["wire 20AWG"]).toMatchObject({ qty: 0.84, extendedCost: 0.21 })
    expect(byItem["sleeving"]).toMatchObject({ qty: 0.42 })
    expect(byItem["labels"]).toMatchObject({ qty: 1, extendedCost: 0.35 })
  })

  it("labor comes from the §28 BOP time model", () => {
    const bop = generateBop(hir)
    expect(quote.laborSeconds).toBe(bop.totalEstimatedSeconds)
    expect(quote.laborCost).toBeCloseTo((bop.totalEstimatedSeconds / 3600) * 36, 2)
  })

  it("applies scrap and yield: total = material + scrap + labor; per-unit /= yield", () => {
    expect(quote.scrapCost).toBeCloseTo(quote.materialCost * 0.05, 2)
    expect(quote.totalCost).toBeCloseTo(
      quote.materialCost + quote.scrapCost + quote.laborCost,
      2
    )
    expect(quote.perUnitCost).toBeCloseTo(quote.totalCost / 0.96, 2)
  })

  it("flags long-lead, lifecycle risk, and unpriced items", () => {
    expect(quote.longLeadItems).toEqual(["43020-0800"])
    expect(quote.lifecycleRisks).toEqual(["43020-0800"])
    // W3/W4 have no length → only priced gauges appear; nothing unpriced here.
    expect(quote.unpricedItems).toEqual([])
    const noPrices = generateQuote(hir, { laborRatePerHour: 36 })
    expect(noPrices.unpricedItems.length).toBeGreaterThan(0)
  })

  it("is deterministic and exports CSV with totals", () => {
    expect(generateQuote(hir, model)).toEqual(quote)
    const csv = quoteCsv(hir, model)
    expect(csv).toContain("PER UNIT @ 96.0% yield")
    expect(csv).toMatchSnapshot()
  })
})

describe("quote diff between revisions (PRD §29)", () => {
  it("reports material and per-unit deltas for a variant", () => {
    const long = variant(motor, {
      id: "motor-controller-harness-long",
      revision: "B",
      wires: { override: { W1: { length: 800 }, W2: { length: 800 } } },
      branches: { override: { main: { nominalLength: 800 } } }
    })
    const quoteB = generateQuote(compileDesign(long).hir, model)
    const d = quoteDiff(quote, quoteB)
    // Longer wires + longer sleeve cost more.
    expect(d.materialDelta).toBeGreaterThan(0)
    expect(d.perUnitDelta).toBeGreaterThan(0)
    expect(d.lineChanges.some((c) => c.item === "wire:wire 20AWG")).toBe(true)
    expect(d.from.revision).toBe("A")
    expect(d.to.revision).toBe("B")
  })
})
