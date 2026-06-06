/**
 * Costing and quote preparation (PRD §29).
 *
 * Structured cost rollup from HIR + the org's CostModel: material lines
 * (parts from BOM, wire by length and gauge, sleeves, labels, splices),
 * labor from the Bill of Process time model (§28), scrap factor, yield
 * assumptions, long-lead and lifecycle-risk flags, and quote diffs between
 * revisions. Not an ERP — a deterministic quote generator.
 */
import type { CostModel, Hir } from "@grayhaven/nerve"
import { generateBop } from "./bop.js"
import { toCsv, type TableData } from "./csv.js"

export interface QuoteLine {
  readonly category: "connector" | "wire" | "sleeve" | "label" | "splice"
  readonly item: string
  readonly qty: number
  readonly unit: string
  readonly unitCost: number
  readonly extendedCost: number
  readonly flags: ReadonlyArray<string>
}

export interface Quote {
  readonly harness: { readonly id: string; readonly revision: string }
  readonly currency: string
  readonly lines: ReadonlyArray<QuoteLine>
  readonly materialCost: number
  readonly scrapCost: number
  readonly laborSeconds: number
  readonly laborCost: number
  readonly totalCost: number
  /** Total divided by first-pass yield. */
  readonly perUnitCost: number
  readonly assumptions: {
    readonly laborRatePerHour: number
    readonly scrapFactor: number
    readonly yield: number
  }
  readonly longLeadItems: ReadonlyArray<string>
  readonly lifecycleRisks: ReadonlyArray<string>
  readonly unpricedItems: ReadonlyArray<string>
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Wire length in meters from harness units (mm or in). */
const toMeters = (length: number, units: string): number =>
  units === "in" ? (length * 25.4) / 1000 : length / 1000

export const generateQuote = (hir: Hir, model: CostModel): Quote => {
  const lines: Array<QuoteLine> = []
  const longLead = new Set<string>()
  const lifecycle = new Set<string>()
  const unpriced = new Set<string>()
  const threshold = model.longLeadThresholdDays ?? 60

  const partFlags = (mpn: string): Array<string> => {
    const info = model.parts?.[mpn]
    const flags: Array<string> = []
    if (info === undefined) {
      flags.push("UNPRICED")
      unpriced.add(mpn)
      return flags
    }
    if (info.leadTimeDays !== undefined && info.leadTimeDays >= threshold) {
      flags.push(`LONG-LEAD ${info.leadTimeDays}d`)
      longLead.add(mpn)
    }
    if (info.lifecycle !== undefined && info.lifecycle !== "active") {
      flags.push(info.lifecycle.toUpperCase())
      lifecycle.add(mpn)
    }
    return flags
  }

  // Connector housings (and future terminal/seal BOM lines) from the BOM.
  for (const item of hir.bom) {
    const unitCost = model.parts?.[item.mpn]?.unitCost ?? model.defaultPartCost ?? 0
    lines.push({
      category: "connector",
      item: item.mpn,
      qty: item.quantity,
      unit: item.unitOfMeasure,
      unitCost: round2(unitCost),
      extendedCost: round2(unitCost * item.quantity),
      flags: partFlags(item.mpn)
    })
  }

  // Wire by gauge, total length.
  const lengthByGauge = new Map<string, number>()
  for (const w of hir.wires) {
    if (w.length === undefined) continue
    const gauge = w.gauge ?? "unspecified"
    lengthByGauge.set(
      gauge,
      (lengthByGauge.get(gauge) ?? 0) + toMeters(w.length, hir.harness.units)
    )
  }
  for (const [gauge, meters] of [...lengthByGauge.entries()].sort()) {
    const perMeter =
      model.wireCostPerMeter?.[gauge] ?? model.defaultWireCostPerMeter ?? 0
    const flags: Array<string> = []
    if (model.wireCostPerMeter?.[gauge] === undefined && model.defaultWireCostPerMeter === undefined) {
      flags.push("UNPRICED")
      unpriced.add(`wire:${gauge}`)
    }
    lines.push({
      category: "wire",
      item: `wire ${gauge}`,
      qty: round2(meters),
      unit: "m",
      unitCost: round2(perMeter),
      extendedCost: round2(meters * perMeter),
      flags
    })
  }

  // Sleeves by branch nominal length.
  const sleeveMeters = hir.branches
    .filter((b) => b.sleeve !== undefined && b.nominalLength !== undefined)
    .reduce((sum, b) => sum + toMeters(b.nominalLength!, hir.harness.units), 0)
  if (sleeveMeters > 0) {
    const perMeter = model.sleeveCostPerMeter ?? 0
    lines.push({
      category: "sleeve",
      item: "sleeving",
      qty: round2(sleeveMeters),
      unit: "m",
      unitCost: round2(perMeter),
      extendedCost: round2(sleeveMeters * perMeter),
      flags: model.sleeveCostPerMeter === undefined ? ["UNPRICED"] : []
    })
  }

  if (hir.labels.length > 0) {
    const unitCost = model.labelUnitCost ?? 0
    const qty = hir.labels.reduce((sum, l) => sum + (l.quantity ?? 1), 0)
    lines.push({
      category: "label",
      item: "labels",
      qty,
      unit: "ea",
      unitCost: round2(unitCost),
      extendedCost: round2(unitCost * qty),
      flags: model.labelUnitCost === undefined ? ["UNPRICED"] : []
    })
  }

  for (const s of hir.splices) {
    const unitCost =
      (s.part !== undefined ? model.parts?.[s.part]?.unitCost : undefined) ??
      model.spliceUnitCost ??
      0
    lines.push({
      category: "splice",
      item: s.part ?? `splice ${s.id}`,
      qty: 1,
      unit: "ea",
      unitCost: round2(unitCost),
      extendedCost: round2(unitCost),
      flags: s.part !== undefined ? partFlags(s.part) : []
    })
  }

  const materialCost = round2(lines.reduce((sum, l) => sum + l.extendedCost, 0))
  const scrapFactor = model.scrapFactor ?? 0
  const scrapCost = round2(materialCost * scrapFactor)
  const bop = generateBop(hir)
  const laborCost = round2((bop.totalEstimatedSeconds / 3600) * model.laborRatePerHour)
  const totalCost = round2(materialCost + scrapCost + laborCost)
  const yield_ = model.yield ?? 1

  return {
    harness: { id: hir.harness.id, revision: hir.harness.revision },
    currency: model.currency ?? "USD",
    lines,
    materialCost,
    scrapCost,
    laborSeconds: bop.totalEstimatedSeconds,
    laborCost,
    totalCost,
    perUnitCost: round2(totalCost / yield_),
    assumptions: {
      laborRatePerHour: model.laborRatePerHour,
      scrapFactor,
      yield: yield_
    },
    longLeadItems: [...longLead].sort(),
    lifecycleRisks: [...lifecycle].sort(),
    unpricedItems: [...unpriced].sort()
  }
}

export const quoteTable = (quote: Quote): TableData => ({
  headers: ["Category", "Item", "Qty", "Unit", `Unit cost (${quote.currency})`, `Extended (${quote.currency})`, "Flags"],
  rows: [
    ...quote.lines.map((l) => [
      l.category,
      l.item,
      l.qty,
      l.unit,
      l.unitCost.toFixed(2),
      l.extendedCost.toFixed(2),
      l.flags.join("; ")
    ]),
    ["", "MATERIAL", "", "", "", quote.materialCost.toFixed(2), ""],
    ["", `SCRAP @ ${(quote.assumptions.scrapFactor * 100).toFixed(1)}%`, "", "", "", quote.scrapCost.toFixed(2), ""],
    ["", `LABOR (${Math.round(quote.laborSeconds / 60)} min @ ${quote.assumptions.laborRatePerHour}/h)`, "", "", "", quote.laborCost.toFixed(2), ""],
    ["", "TOTAL", "", "", "", quote.totalCost.toFixed(2), ""],
    ["", `PER UNIT @ ${(quote.assumptions.yield * 100).toFixed(1)}% yield`, "", "", "", quote.perUnitCost.toFixed(2), ""]
  ]
})

export const quoteCsv = (hir: Hir, model: CostModel): string =>
  toCsv((({ headers, rows }) => [headers, ...rows])(quoteTable(generateQuote(hir, model))))

export const quoteJson = (hir: Hir, model: CostModel): string =>
  JSON.stringify(generateQuote(hir, model), null, 2) + "\n"

export interface QuoteDiff {
  readonly from: { readonly revision: string; readonly perUnitCost: number }
  readonly to: { readonly revision: string; readonly perUnitCost: number }
  readonly materialDelta: number
  readonly laborDelta: number
  readonly totalDelta: number
  readonly perUnitDelta: number
  readonly lineChanges: ReadonlyArray<{
    readonly item: string
    readonly from: number
    readonly to: number
    readonly delta: number
  }>
}

/** Cost diff between revisions (PRD §29). */
export const quoteDiff = (a: Quote, b: Quote): QuoteDiff => {
  const byItem = (q: Quote): Map<string, number> =>
    new Map(q.lines.map((l) => [`${l.category}:${l.item}`, l.extendedCost]))
  const aMap = byItem(a)
  const bMap = byItem(b)
  const lineChanges: Array<QuoteDiff["lineChanges"][number]> = []
  for (const key of [...new Set([...aMap.keys(), ...bMap.keys()])].sort()) {
    const from = aMap.get(key) ?? 0
    const to = bMap.get(key) ?? 0
    if (round2(to - from) !== 0) {
      lineChanges.push({ item: key, from, to, delta: round2(to - from) })
    }
  }
  return {
    from: { revision: a.harness.revision, perUnitCost: a.perUnitCost },
    to: { revision: b.harness.revision, perUnitCost: b.perUnitCost },
    materialDelta: round2(b.materialCost - a.materialCost),
    laborDelta: round2(b.laborCost - a.laborCost),
    totalDelta: round2(b.totalCost - a.totalCost),
    perUnitDelta: round2(b.perUnitCost - a.perUnitCost),
    lineChanges
  }
}
