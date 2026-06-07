/**
 * Continuity-test plan generation (PRD §9.9).
 *
 * Generated from the HIR graph:
 *  - one point-to-point continuity test per pin-to-pin wire ("closed"),
 *  - splice verification: for each splice, continuity from a hub pin to every
 *    other pin reachable through that splice ("closed"),
 *  - one no-short isolation test per pair of distinct nets that share a
 *    connector ("open").
 *
 * Nets are computed over the full connectivity graph (wires + splices), so a
 * spliced power feed is one net. IDs are sequential over a canonical
 * ordering: the same HIR always yields the same plan.
 */
import { computeNets, isPinEndpoint, type Hir, type HirEndpoint } from "@grayhaven/nerve"

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
  readonly splice?: undefined
}

export interface SpliceTest {
  readonly id: string
  readonly type: "splice"
  readonly from: TestPoint
  readonly to: TestPoint
  readonly expected: "closed"
  readonly net?: string
  readonly wire?: undefined
  readonly splice: string
}

export interface IsolationTest {
  readonly id: string
  readonly type: "no-short"
  readonly from: TestPoint
  readonly to: TestPoint
  readonly expected: "open"
  readonly net: string
  readonly wire?: undefined
  readonly splice?: undefined
}

export type HarnessTest = ContinuityTest | SpliceTest | IsolationTest

export interface TestPlan {
  readonly harness: { readonly id: string; readonly revision: string }
  readonly tests: ReadonlyArray<HarnessTest>
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

// Same key format the serialized test points have always used.
const endpointKey = (e: HirEndpoint): string =>
  isPinEndpoint(e) ? `pin:${e.connector}:${e.pin}` : `splice:${e.splice}`

export const generateTestPlan = (hir: Hir): TestPlan => {
  // Shared union-find from core: graph.json and rule authors see the
  // exact same connectivity (it used to be duplicated here).
  const nets = computeNets(hir, endpointKey)
  const tests: Array<HarnessTest> = []
  let n = 0
  const nextId = () => `T-${String(++n).padStart(3, "0")}`

  // Continuity: one per pin-to-pin wire, in canonical wire order.
  for (const w of hir.wires) {
    if (!isPinEndpoint(w.from) || !isPinEndpoint(w.to)) continue
    const net = nets.nameOf(w.from)
    tests.push({
      id: nextId(),
      type: "continuity",
      from: { connector: w.from.connector, pin: w.from.pin },
      to: { connector: w.to.connector, pin: w.to.pin },
      expected: "closed",
      ...(net !== undefined ? { net } : {}),
      wire: w.id
    })
  }

  // Splice verification: hub pin ↔ every other pin attached through the splice.
  for (const s of hir.splices) {
    const pins: Array<TestPoint> = []
    for (const wireId of s.wires) {
      const w = hir.wires.find((x) => x.id === wireId)
      if (w === undefined) continue
      for (const e of [w.from, w.to]) {
        if (isPinEndpoint(e)) pins.push({ connector: e.connector, pin: e.pin })
      }
    }
    pins.sort((a, b) => cmp(a.connector, b.connector) || cmp(a.pin, b.pin))
    const hub = pins[0]
    if (hub === undefined) continue
    const net = nets.nameOf({ splice: s.id })
    for (const p of pins.slice(1)) {
      tests.push({
        id: nextId(),
        type: "splice",
        from: hub,
        to: p,
        expected: "closed",
        ...(net !== undefined ? { net } : {}),
        splice: s.id
      })
    }
  }

  // No-short: for each connector, between the first wired pin of each
  // distinct net present on that connector.
  const netToPin = new Map<string, Map<string, string>>() // connector -> net -> probe pin
  for (const w of hir.wires) {
    for (const end of [w.from, w.to]) {
      if (!isPinEndpoint(end)) continue
      const net = nets.nameOf(end) ?? `wire:${w.id}`
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

/** Every wired net has at least one closed-circuit test (PRD §9.9 acceptance). */
export const coverage = (
  hir: Hir,
  plan: TestPlan
): { readonly nets: number; readonly covered: number } => {
  const netOf = computeNets(hir, endpointKey)
  const nets = new Set(
    hir.wires.map((w) => netOf.nameOf(w.from) ?? `wire:${w.id}`)
  )
  const covered = new Set(
    plan.tests
      .filter((t) => t.expected === "closed")
      .map((t) => t.net ?? (t.type === "continuity" ? `wire:${t.wire}` : ""))
  )
  return {
    nets: nets.size,
    covered: [...nets].filter((n) => covered.has(n)).length
  }
}
