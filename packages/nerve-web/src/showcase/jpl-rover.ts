/**
 * Thin typed loader over jpl-proofs.json, which is generated at build time by
 * scripts/gen-jpl-proofs.ts. Keeps the compiler, wireviz importer, and rules
 * out of the showcase chunk — the proofs are static content.
 */
import type { Diagnostic, Hir } from "@grayhaven/nerve"
import type { TableData, TestPlan } from "@grayhaven/nerve-exporters"
import proofs from "./jpl-proofs.json"

export const JPL_SOURCE = {
  repository: "https://github.com/nasa-jpl/open-source-rover",
  commit: "50dca639560b4b8cebf1852e6c7c2048ac770762",
  path: "electrical/wiring/wireviz",
  license: "Apache-2.0"
} as const

interface CorpusEntry {
  readonly slug: string
  readonly name: string
  readonly source: string
}

export interface JplHarnessProof extends CorpusEntry {
  readonly title: string
  readonly hir: Hir
  readonly schematic: string
  readonly fingerprint: string
  readonly importDiagnostics: ReadonlyArray<Diagnostic>
  readonly reviewDiagnostics: ReadonlyArray<Diagnostic>
  readonly bom: TableData
  readonly cutList: TableData
  readonly testPlan: TestPlan
  readonly releaseReady: boolean
}

/** Table cells are `string | number | undefined`; the JSON stores empty cells as null. */
interface StoredTable {
  readonly headers: ReadonlyArray<string>
  readonly rows: ReadonlyArray<ReadonlyArray<string | number | null>>
}

type StoredProof = Omit<JplHarnessProof, "bom" | "cutList"> & {
  readonly bom: StoredTable
  readonly cutList: StoredTable
}

const reviveTable = (table: StoredTable): TableData => ({
  headers: table.headers,
  rows: table.rows.map((row) => row.map((cell) => cell ?? undefined))
})

const stored = proofs.harnesses as unknown as ReadonlyArray<StoredProof>

export const JPL_HARNESSES: ReadonlyArray<JplHarnessProof> = stored.map((proof) => ({
  ...proof,
  bom: reviveTable(proof.bom),
  cutList: reviveTable(proof.cutList)
}))

export const JPL_SHOWCASE_SUMMARY = proofs.summary
