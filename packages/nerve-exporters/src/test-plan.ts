/**
 * Continuity-test plan generation (PRD §9.9).
 *
 * Generated from the HIR graph:
 *  - one point-to-point continuity test per wire ("closed"),
 *  - one no-short isolation test per pair of distinct nets that share a
 *    connector ("open") — the cheapest place a short is actually probed.
 *
 * IDs are sequential over a canonical ordering, so the same HIR always
 * yields the same plan.
 */
import type { Hir } from "@grayhaven/nerve"

export interface TestPoint {
  readonly connector: string
  readonly pin: string
}

export interface ContinuityTest {
  readonly id: string
  readonly type: "continuity"
  readonly from: TestPoint
  readonly to: TestPoint
  readonly expected: "closed"
  readonly net?: string
  readonly wire: string
}

export interface IsolationTest {
  readonly id: string
  readonly type: "no-short"
  readonly from: TestPoint
  readonly to: TestPoint
  readonly expected: "open"
  readonly net: string
  readonly wire?: undefined
}

export type HarnessTest = ContinuityTest | IsolationTest

export interface TestPlan {
  readonly harness: { readonly id: string; readonly revision: string }
  readonly tests: ReadonlyArray<HarnessTest>
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export const generateTestPlan = (hir: Hir): TestPlan => {
  const tests: Array<HarnessTest> = []
  let n = 0
  const nextId = () => `T-${String(++n).padStart(3, "0")}`

  // Continuity: one per wire, in canonical wire order.
  for (const w of hir.wires) {
    tests.push({
      id: nextId(),
      type: "continuity",
      from: { connector: w.from.connector, pin: w.from.pin },
      to: { connector: w.to.connector, pin: w.to.pin },
      expected: "closed",
      ...(w.signal !== undefined ? { net: w.signal } : {}),
      wire: w.id
    })
  }

  // No-short: for each connector, between the first wired pin of each
  // distinct net present on that connector.
  const netToPin = new Map<string, Map<string, string>>() // connector -> net -> probe pin
  for (const w of hir.wires) {
    const net = w.signal ?? `wire:${w.id}`
    for (const end of [w.from, w.to]) {
      const pins = netToPin.get(end.connector) ?? new Map<string, string>()
      if (!pins.has(net)) pins.set(net, end.pin)
      netToPin.set(end.connector, pins)
    }
  }
  for (const connector of [...netToPin.keys()].sort(cmp)) {
    const pins = netToPin.get(connector)!
    const nets = [...pins.keys()].sort(cmp)
    for (let i = 0; i < nets.length; i++) {
      for (let j = i + 1; j < nets.length; j++) {
        const netA = nets[i]!
        const netB = nets[j]!
        tests.push({
          id: nextId(),
          type: "no-short",
          from: { connector, pin: pins.get(netA)! },
          to: { connector, pin: pins.get(netB)! },
          expected: "open",
          net: `${netA} <-> ${netB}`
        })
      }
    }
  }

  return {
    harness: { id: hir.harness.id, revision: hir.harness.revision },
    tests
  }
}

/** Serialized `test-plan.json` (PRD §9.3 required HIR outputs). */
export const testPlanJson = (hir: Hir): string =>
  JSON.stringify(generateTestPlan(hir), null, 2) + "\n"

/** Every wired net has at least one continuity test (PRD §9.9 acceptance). */
export const coverage = (
  hir: Hir,
  plan: TestPlan
): { readonly nets: number; readonly covered: number } => {
  const nets = new Set(
    hir.wires.map((w) => w.signal ?? `wire:${w.id}`)
  )
  const covered = new Set(
    plan.tests
      .filter((t): t is ContinuityTest => t.type === "continuity")
      .map((t) => t.net ?? `wire:${t.wire}`)
  )
  return { nets: nets.size, covered: [...nets].filter((n) => covered.has(n)).length }
}
