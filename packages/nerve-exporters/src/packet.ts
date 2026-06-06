/**
 * Manufacturing packet (PRD §9.8).
 *
 * A zip archive containing every exported artifact plus the machine-readable
 * HIR. Deterministic: fixed file order, zeroed timestamps, no compression
 * nondeterminism (level is pinned), and a content-derived cover sheet
 * instead of a generation timestamp. PDF rendering is deferred (GOAL.md);
 * the cover is plain text until then.
 */
import { zipSync, strToU8 } from "fflate"
import { hasErrors, type Hir } from "@grayhaven/nerve"
import { bomCsv, cutListCsv, labelScheduleCsv, testPlanCsv, type CutListOptions } from "./csv.js"
import { generateTestPlan, testPlanJson } from "./test-plan.js"
import { schematicSvg } from "./svg.js"

export interface PacketOptions extends CutListOptions {}

export interface Packet {
  /** File name → contents, in archive order. */
  readonly files: ReadonlyMap<string, string>
  readonly zip: Uint8Array
}

const coverSheet = (hir: Hir): string => {
  const errors = hir.diagnostics.filter((d) => d.severity === "error").length
  const warnings = hir.diagnostics.filter((d) => d.severity === "warning").length
  return [
    "GRAYHAVEN NERVE — MANUFACTURING PACKET",
    "",
    `Harness:      ${hir.harness.id}`,
    `Revision:     ${hir.harness.revision}`,
    `Units:        ${hir.harness.units}`,
    `HIR schema:   ${hir.schemaVersion}`,
    `Connectors:   ${hir.connectors.length}`,
    `Wires:        ${hir.wires.length}`,
    `Validation:   ${errors} error(s), ${warnings} warning(s)`,
    "",
    "Contents:",
    "  harness.json     machine-readable HIR",
    "  schematic.svg    wiring diagram",
    "  bom.csv          bill of materials",
    "  cut-list.csv     wire cut list",
    "  labels.csv       label schedule",
    "  tests.csv        continuity-test procedure",
    "  test-plan.json   machine-readable test plan",
    ""
  ].join("\n")
}

export const buildPacket = (hir: Hir, options: PacketOptions = {}): Packet => {
  const plan = generateTestPlan(hir)
  const files = new Map<string, string>([
    ["COVER.txt", coverSheet(hir)],
    ["harness.json", JSON.stringify(hir, null, 2) + "\n"],
    ["schematic.svg", schematicSvg(hir)],
    ["bom.csv", bomCsv(hir)],
    ["cut-list.csv", cutListCsv(hir, options)],
    ["labels.csv", labelScheduleCsv(hir)],
    ["tests.csv", testPlanCsv(plan)],
    ["test-plan.json", testPlanJson(hir)]
  ])
  // Zip's DOS timestamp floor is 1980-01-01 (interpreted in local time by
  // fflate); pin every entry well clear of the floor so the archive is
  // byte-identical for identical inputs in any timezone.
  const ZIP_EPOCH = new Date(1980, 5, 1)
  const zipInput: Record<string, [Uint8Array, { level: 6; mtime: Date }]> = {}
  for (const [name, contents] of files) {
    zipInput[name] = [strToU8(contents), { level: 6, mtime: ZIP_EPOCH }]
  }
  return { files, zip: zipSync(zipInput) }
}

/** Release exports must fail closed on validation errors (PRD §15). */
export const canRelease = (hir: Hir): boolean => !hasErrors(hir.diagnostics)
