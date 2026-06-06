/**
 * Bill of Process — Manufacturing Operations IR (PRD §28).
 *
 * "BOM is not enough." The BOP is a first-class artifact derived from HIR:
 * an ordered operation sequence with workstations, tools, labor-time
 * estimates, and — critically — every step linking back to the HIR objects
 * it manufactures (PRD §28 acceptance). Deterministic: canonical HIR order
 * in, identical BOP out.
 *
 * Crimp heights, pull forces, and applicator data arrive with verified
 * component process data (PRD §30); estimates here are planning-grade.
 */
import { isPinEndpoint, refs, type Hir } from "@grayhaven/nerve"
import { generateTestPlan } from "./test-plan.js"
import { toCsv, type TableData } from "./csv.js"

export type Workstation = "wire-prep" | "assembly" | "finishing" | "qa"

export interface Operation {
  /** Sequence number (steps of 10, classic router style). */
  readonly seq: number
  readonly op:
    | "cut-strip"
    | "twist"
    | "crimp"
    | "populate"
    | "splice"
    | "sleeve"
    | "label"
    | "inspect"
    | "test"
  readonly workstation: Workstation
  readonly description: string
  /** Stable HIR refs this step manufactures (PRD §28: links to HIR objects). */
  readonly targets: ReadonlyArray<string>
  readonly tools: ReadonlyArray<string>
  readonly estimatedSeconds: number
}

export interface BillOfProcess {
  readonly harness: { readonly id: string; readonly revision: string }
  readonly operations: ReadonlyArray<Operation>
  readonly totalEstimatedSeconds: number
  readonly estimatedLaborMinutes: number
}

// Planning-grade time standards (seconds).
const T = {
  cutStripPerWire: 25,
  twistPerGroup: 40,
  crimpPerTermination: 30,
  populatePerCavity: 8,
  splice: 90,
  sleeveBase: 30,
  sleevePerMm: 0.05,
  labelEach: 20,
  inspectPerConnector: 15,
  testPerStep: 8
} as const

export const generateBop = (hir: Hir): BillOfProcess => {
  const operations: Array<Operation> = []
  let seq = 0
  const add = (op: Omit<Operation, "seq">): void => {
    seq += 10
    operations.push({ seq, ...op })
  }

  // --- Wire prep -------------------------------------------------------------
  for (const w of hir.wires) {
    const spec = [w.gauge, w.color].filter((s) => s !== undefined).join(" ")
    add({
      op: "cut-strip",
      workstation: "wire-prep",
      description: `Cut and strip ${w.id} (${spec || "wire"}${w.length !== undefined ? `, ${w.length} ${hir.harness.units}` : ""}).`,
      targets: [refs.wire(w.id)],
      tools: ["wire cutter", "wire stripper"],
      estimatedSeconds: T.cutStripPerWire
    })
  }

  const twistGroups = new Map<string, Array<string>>()
  for (const w of hir.wires) {
    if (w.twistGroup === undefined) continue
    const list = twistGroups.get(w.twistGroup) ?? []
    list.push(w.id)
    twistGroups.set(w.twistGroup, list)
  }
  for (const [group, wires] of [...twistGroups.entries()].sort()) {
    add({
      op: "twist",
      workstation: "wire-prep",
      description: `Twist ${wires.join(" + ")} (${group}).`,
      targets: wires.map(refs.wire),
      tools: ["twisting fixture"],
      estimatedSeconds: T.twistPerGroup
    })
  }

  // --- Terminations ------------------------------------------------------------
  const byRef = new Map(hir.connectors.map((c) => [c.ref, c]))
  for (const c of hir.connectors) {
    const terminations = hir.wires.flatMap((w) =>
      [w.from, w.to].filter((e) => isPinEndpoint(e) && e.connector === c.ref)
    )
    if (terminations.length === 0) continue
    add({
      op: "crimp",
      workstation: "assembly",
      description: `Crimp ${terminations.length} termination(s) for ${c.ref} (${c.mpn}).`,
      targets: [refs.connector(c.ref)],
      tools: ["crimp tool" + (byRef.get(c.ref)?.family !== undefined ? ` (${byRef.get(c.ref)!.family})` : "")],
      estimatedSeconds: terminations.length * T.crimpPerTermination
    })
    add({
      op: "populate",
      workstation: "assembly",
      description: `Populate ${c.ref}: seat ${terminations.length} terminal(s), verify lock engagement.`,
      targets: [refs.connector(c.ref)],
      tools: ["insertion tool"],
      estimatedSeconds: terminations.length * T.populatePerCavity
    })
  }

  // --- Splices -------------------------------------------------------------------
  for (const s of hir.splices) {
    add({
      op: "splice",
      workstation: "assembly",
      description: `Splice ${s.id}: join ${s.wires.join(" + ")}${s.type !== undefined ? ` (${s.type}${s.part !== undefined ? `, ${s.part}` : ""})` : ""}.${s.notes !== undefined ? ` ${s.notes}` : ""}`,
      targets: [refs.splice(s.id), ...s.wires.map(refs.wire)],
      tools: s.type === "solder-sleeve" ? ["heat gun"] : ["splice crimp tool", "heat gun"],
      estimatedSeconds: T.splice
    })
  }

  // --- Finishing --------------------------------------------------------------------
  for (const b of hir.branches) {
    if (b.sleeve === undefined) continue
    add({
      op: "sleeve",
      workstation: "finishing",
      description: `Sleeve branch ${b.id} with ${b.sleeve}${b.nominalLength !== undefined ? ` (${b.nominalLength} ${hir.harness.units})` : ""}.`,
      targets: [refs.branch(b.id)],
      tools: ["sleeving tool", "heat gun"],
      estimatedSeconds: Math.round(T.sleeveBase + (b.nominalLength ?? 0) * T.sleevePerMm)
    })
  }
  for (const l of hir.labels) {
    add({
      op: "label",
      workstation: "finishing",
      description: `Print and apply ${l.id} "${l.text}" on ${l.attachTo}${l.offsetFrom !== undefined && l.distance !== undefined ? ` ${l.distance} ${hir.harness.units} from ${l.offsetFrom}` : ""}.`,
      targets: [refs.label(l.id)],
      tools: ["label printer"],
      estimatedSeconds: T.labelEach
    })
  }

  // --- QA --------------------------------------------------------------------------
  add({
    op: "inspect",
    workstation: "qa",
    description: `Visual inspection: ${hir.connectors.length} connector(s) against pinout tables, labels against schedule, sleeve coverage against board drawing.`,
    targets: hir.connectors.map((c) => refs.connector(c.ref)),
    tools: ["inspection checklist"],
    estimatedSeconds: hir.connectors.length * T.inspectPerConnector
  })
  const testCount = generateTestPlan(hir).tests.length
  add({
    op: "test",
    workstation: "qa",
    description: `Run continuity-test procedure: ${testCount} step(s); record results per test ID.`,
    targets: ["test-plan"],
    tools: ["continuity tester"],
    estimatedSeconds: testCount * T.testPerStep
  })

  const total = operations.reduce((sum, op) => sum + op.estimatedSeconds, 0)
  return {
    harness: { id: hir.harness.id, revision: hir.harness.revision },
    operations,
    totalEstimatedSeconds: total,
    estimatedLaborMinutes: Math.round((total / 60) * 10) / 10
  }
}

/** Bill of Process table (shared by CSV and PDF). */
export const bopTable = (bop: BillOfProcess): TableData => ({
  headers: ["Seq", "Operation", "Workstation", "Description", "Targets", "Tools", "Est. sec"],
  rows: bop.operations.map((op) => [
    op.seq,
    op.op,
    op.workstation,
    op.description,
    op.targets.join("; "),
    op.tools.join("; "),
    op.estimatedSeconds
  ])
})

export const bopCsv = (hir: Hir): string => {
  const bop = generateBop(hir)
  const table = bopTable(bop)
  return toCsv([
    table.headers,
    ...table.rows,
    ["", "", "", `TOTAL — estimated labor ${bop.estimatedLaborMinutes} min`, "", "", bop.totalEstimatedSeconds]
  ])
}

export const bopJson = (hir: Hir): string =>
  JSON.stringify(generateBop(hir), null, 2) + "\n"
