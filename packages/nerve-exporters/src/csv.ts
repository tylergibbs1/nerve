/**
 * CSV exporters (PRD §9.8, §20).
 *
 * Column sets follow the PRD §20 specs exactly so output drops into
 * spreadsheet and ERP workflows. All output is deterministic: rows follow
 * HIR's canonical ordering, line endings are `\n`, and there are no
 * timestamps.
 */
import type { Hir } from "@grayhaven/nerve"
import type { TestPlan } from "./test-plan.js"

type Cell = string | number | undefined

const escapeCell = (cell: Cell): string => {
  if (cell === undefined) return ""
  const s = String(cell)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (rows: ReadonlyArray<ReadonlyArray<Cell>>): string =>
  rows.map((row) => row.map(escapeCell).join(",")).join("\n") + "\n"

/** BOM CSV (PRD §20.1). */
export const bomCsv = (hir: Hir): string =>
  toCsv([
    [
      "Item number",
      "Quantity",
      "Unit of measure",
      "Internal part number",
      "Manufacturer",
      "Manufacturer part number",
      "Description",
      "Category",
      "Used by",
      "Approved alternates",
      "Notes"
    ],
    ...hir.bom.map((item, i) => [
      i + 1,
      item.quantity,
      item.unitOfMeasure,
      item.internalPartId,
      item.manufacturer,
      item.mpn,
      item.description,
      item.category,
      item.usedBy.join("; "),
      "",
      item.notes
    ])
  ])

export interface CutListOptions {
  /** Default length tolerance when a wire does not specify one (PRD §10.5). */
  readonly defaultWireTolerance?: number
}

/** Wire cut list CSV (PRD §20.2). */
export const cutListCsv = (hir: Hir, options: CutListOptions = {}): string =>
  toCsv([
    [
      "Wire ID",
      "Signal",
      "Gauge",
      "Color",
      "Stripe",
      "Cut length",
      "Finished length",
      "Tolerance",
      "From connector",
      "From pin",
      "To connector",
      "To pin",
      "Terminal A",
      "Terminal B",
      "Branch",
      "Notes"
    ],
    ...hir.wires.map((w) => [
      w.id,
      w.signal,
      w.gauge,
      w.color,
      w.stripe,
      w.length,
      w.length,
      w.lengthTolerance ?? options.defaultWireTolerance,
      w.from.connector,
      w.from.pin,
      w.to.connector,
      w.to.pin,
      "", // terminal assignment lands with process data (PRD §28)
      "",
      w.branch,
      w.notes
    ])
  ])

/** Label schedule CSV (PRD §20.3). */
export const labelScheduleCsv = (hir: Hir): string =>
  toCsv([
    [
      "Label ID",
      "Text",
      "Quantity",
      "Material",
      "Printer profile",
      "Target object",
      "Placement offset",
      "Orientation",
      "Notes"
    ],
    ...hir.labels.map((l) => [
      l.id,
      l.text,
      l.quantity ?? 1,
      l.material,
      "",
      l.attachTo,
      l.offsetFrom !== undefined && l.distance !== undefined
        ? `${l.distance} from ${l.offsetFrom}`
        : l.distance,
      "",
      ""
    ])
  ])

/** Test plan CSV (PRD §9.9: human-trackable form of the JSON plan). */
export const testPlanCsv = (plan: TestPlan): string =>
  toCsv([
    [
      "Test ID",
      "Type",
      "From connector",
      "From pin",
      "To connector",
      "To pin",
      "Expected",
      "Net",
      "Wire"
    ],
    ...plan.tests.map((t) => [
      t.id,
      t.type,
      t.from.connector,
      t.from.pin,
      t.to.connector,
      t.to.pin,
      t.expected,
      t.net,
      t.wire
    ])
  ])
