/**
 * Nerve Build Record — as-built traceability (PRD §36).
 *
 * Captures evidence, not intent: which serial was built, by whom, with what
 * material lots and tools, and what the tester actually measured. Verdicts
 * are computed by replaying measured values against the release's generated
 * test plan, so a pass means "the physical harness matches the design
 * graph," traceable test-by-test.
 */
import type { Hir } from "@grayhaven/nerve"
import { generateTestPlan, type HarnessTest } from "./test-plan.js"
import type { Release } from "./release.js"

export interface Measurement {
  readonly id: string
  /** Measured resistance for the step, ohms. */
  readonly measuredOhms: number
}

export interface TestVerdict {
  readonly id: string
  readonly type: HarnessTest["type"]
  readonly expected: "closed" | "open"
  readonly measuredOhms?: number
  readonly verdict: "pass" | "fail" | "not-run"
}

export interface BuildRecord {
  readonly recordVersion: "0.1.0"
  readonly release: string
  readonly hirFingerprint: string
  readonly serial: string
  readonly lot?: string
  readonly operator: string
  readonly workstation?: string
  readonly buildDate: string
  readonly materialLots?: Readonly<Record<string, string>>
  readonly tools?: Readonly<Record<string, string>>
  readonly testProgramVersion: string
  readonly results: ReadonlyArray<TestVerdict>
  readonly summary: {
    readonly pass: number
    readonly fail: number
    readonly notRun: number
    readonly status: "pass" | "fail" | "incomplete"
  }
  readonly rework?: ReadonlyArray<string>
  readonly deviations?: ReadonlyArray<string>
}

/** Continuity passes below this, isolation passes above (ohms). */
const CONTINUITY_MAX_OHMS = 2
const ISOLATION_MIN_OHMS = 100_000

export interface BuildRecordOptions {
  readonly serial: string
  readonly operator: string
  readonly buildDate: string
  readonly lot?: string
  readonly workstation?: string
  readonly materialLots?: Readonly<Record<string, string>>
  readonly tools?: Readonly<Record<string, string>>
  readonly rework?: ReadonlyArray<string>
  readonly deviations?: ReadonlyArray<string>
}

export const createBuildRecord = (
  hir: Hir,
  release: Release,
  measurements: ReadonlyArray<Measurement>,
  options: BuildRecordOptions
): BuildRecord => {
  const measured = new Map(measurements.map((m) => [m.id, m.measuredOhms]))
  const plan = generateTestPlan(hir)
  const results: Array<TestVerdict> = plan.tests.map((t) => {
    const ohms = measured.get(t.id)
    if (ohms === undefined) {
      return { id: t.id, type: t.type, expected: t.expected, verdict: "not-run" }
    }
    const pass =
      t.expected === "closed" ? ohms <= CONTINUITY_MAX_OHMS : ohms >= ISOLATION_MIN_OHMS
    return {
      id: t.id,
      type: t.type,
      expected: t.expected,
      measuredOhms: ohms,
      verdict: pass ? "pass" : "fail"
    }
  })
  const pass = results.filter((r) => r.verdict === "pass").length
  const fail = results.filter((r) => r.verdict === "fail").length
  const notRun = results.filter((r) => r.verdict === "not-run").length
  return {
    recordVersion: "0.1.0",
    release: release.releaseId,
    hirFingerprint: release.hirFingerprint,
    serial: options.serial,
    ...(options.lot !== undefined ? { lot: options.lot } : {}),
    operator: options.operator,
    ...(options.workstation !== undefined ? { workstation: options.workstation } : {}),
    buildDate: options.buildDate,
    ...(options.materialLots !== undefined ? { materialLots: options.materialLots } : {}),
    ...(options.tools !== undefined ? { tools: options.tools } : {}),
    testProgramVersion: `${release.releaseId}#${plan.tests.length}`,
    results,
    summary: {
      pass,
      fail,
      notRun,
      status: fail > 0 ? "fail" : notRun > 0 ? "incomplete" : "pass"
    },
    ...(options.rework !== undefined ? { rework: options.rework } : {}),
    ...(options.deviations !== undefined ? { deviations: options.deviations } : {})
  }
}

export const buildRecordJson = (record: BuildRecord): string =>
  JSON.stringify(record, null, 2) + "\n"
