/**
 * Shop-floor machine adapters (PRD §31).
 *
 * Typed adapter boundary defined early, with deliberately simple first
 * implementations (CSV/JSON). The contract the PRD requires:
 *  - adapters compile from HIR (and its derived manufacturing IR), never
 *    from UI state,
 *  - output carries design revision + export metadata,
 *  - every machine row maps back to HIR objects,
 *  - failures are structured diagnostics, not throws.
 */
import {
  DiagnosticSeverity,
  HIR_SCHEMA_VERSION,
  isPinEndpoint,
  refs,
  type Diagnostic,
  type Hir
} from "@grayhaven/nerve"
import { toCsv } from "./csv.js"
import { generateTestPlan } from "./test-plan.js"

export type AdapterKind =
  | "wire-cut"
  | "wire-cut-strip"
  | "label-printer"
  | "continuity-tester"

export interface AdapterResult {
  /** File name → contents. */
  readonly files: ReadonlyMap<string, string>
  readonly diagnostics: ReadonlyArray<Diagnostic>
}

export interface MachineAdapter {
  readonly id: string
  readonly kind: AdapterKind
  readonly description: string
  /** HIR schema versions this adapter understands (PRD §40 plugin contract). */
  readonly hirSchemaVersions: ReadonlyArray<string>
  generate(hir: Hir): AdapterResult
}

const metadataHeader = (hir: Hir, adapter: MachineAdapter): string =>
  [
    `# adapter: ${adapter.id}`,
    `# harness: ${hir.harness.id}`,
    `# revision: ${hir.harness.revision}`,
    `# hir-schema: ${hir.schemaVersion}`
  ].join("\n") + "\n"

const checkSchema = (hir: Hir, adapter: MachineAdapter): Diagnostic | undefined =>
  adapter.hirSchemaVersions.includes(hir.schemaVersion)
    ? undefined
    : {
        code: "HK-ADAPT-001",
        severity: DiagnosticSeverity.Error,
        message: `Adapter ${adapter.id} supports HIR ${adapter.hirSchemaVersions.join(", ")}, got ${hir.schemaVersion}.`
      }

/** Wire cut/strip machine: one row per wire with cut length and strip allowances. */
export const genericCutStripCsv: MachineAdapter = {
  id: "generic-cut-strip-csv",
  kind: "wire-cut-strip",
  description: "Generic cut/strip machine CSV (one row per wire).",
  hirSchemaVersions: [HIR_SCHEMA_VERSION],
  generate(hir) {
    const diagnostics: Array<Diagnostic> = []
    const schemaIssue = checkSchema(hir, this)
    if (schemaIssue !== undefined) return { files: new Map(), diagnostics: [schemaIssue] }

    const rows: Array<ReadonlyArray<string | number>> = []
    for (const w of hir.wires) {
      if (w.length === undefined || w.gauge === undefined) {
        diagnostics.push({
          code: "HK-ADAPT-002",
          severity: DiagnosticSeverity.Warning,
          message: `Wire ${w.id} skipped: cut/strip machine rows need both length and gauge.`,
          target: refs.wire(w.id)
        })
        continue
      }
      rows.push([
        w.id,
        w.gauge,
        w.color ?? "",
        w.length,
        w.lengthTolerance ?? "",
        5, // strip A (mm) — process default until §28 carries per-end data
        5, // strip B (mm)
        1, // quantity
        refs.wire(w.id)
      ])
    }
    const csv =
      metadataHeader(hir, this) +
      toCsv([
        ["Wire ID", "Gauge", "Color", "Cut length", "Tolerance", "Strip A", "Strip B", "Qty", "HIR ref"],
        ...rows
      ])
    return { files: new Map([["cut-strip.machine.csv", csv]]), diagnostics }
  }
}

/** Label printer: one row per printed label. */
export const genericLabelPrinterCsv: MachineAdapter = {
  id: "generic-label-printer-csv",
  kind: "label-printer",
  description: "Generic label printer CSV (one row per label copy).",
  hirSchemaVersions: [HIR_SCHEMA_VERSION],
  generate(hir) {
    const schemaIssue = checkSchema(hir, this)
    if (schemaIssue !== undefined) return { files: new Map(), diagnostics: [schemaIssue] }
    const csv =
      metadataHeader(hir, this) +
      toCsv([
        ["Label ID", "Text", "Qty", "Material", "HIR ref"],
        ...hir.labels.map((l) => [
          l.id,
          l.text,
          l.quantity ?? 1,
          l.material ?? "",
          refs.label(l.id)
        ])
      ])
    return { files: new Map([["labels.machine.csv", csv]]), diagnostics: [] }
  }
}

/** Continuity tester: machine-readable program derived from the test plan. */
export const genericTesterJson: MachineAdapter = {
  id: "generic-tester-json",
  kind: "continuity-tester",
  description: "Generic continuity tester program (JSON, one step per test).",
  hirSchemaVersions: [HIR_SCHEMA_VERSION],
  generate(hir) {
    const schemaIssue = checkSchema(hir, this)
    if (schemaIssue !== undefined) return { files: new Map(), diagnostics: [schemaIssue] }
    const plan = generateTestPlan(hir)
    const program = {
      adapter: this.id,
      harness: hir.harness.id,
      revision: hir.harness.revision,
      hirSchema: hir.schemaVersion,
      steps: plan.tests.map((t) => ({
        id: t.id,
        mode: t.expected === "closed" ? "continuity" : "isolation",
        from: t.from,
        to: t.to,
        thresholdOhms: t.expected === "closed" ? 2 : 100000,
        hirRef: t.type === "continuity" ? refs.wire(t.wire) : t.type === "splice" ? refs.splice(t.splice) : null
      }))
    }
    return {
      files: new Map([["tester.program.json", JSON.stringify(program, null, 2) + "\n"]]),
      diagnostics: []
    }
  }
}

export const builtinAdapters: ReadonlyArray<MachineAdapter> = [
  genericCutStripCsv,
  genericLabelPrinterCsv,
  genericTesterJson
]

export const findAdapter = (id: string): MachineAdapter | undefined =>
  builtinAdapters.find((a) => a.id === id)
