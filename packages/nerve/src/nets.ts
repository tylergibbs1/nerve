/**
 * Net computation (PRD §9.4, §9.9): the splice-transitive union-find that
 * answers "which endpoints are electrically common". Lives in core because
 * three consumers need the SAME answer — the continuity test plan, the
 * graph.json satellite, and custom rules (RuleContext.nets) — and two of
 * them used to carry duplicated copies that could drift.
 */
import type { HirEndpoint } from "./hir/schema.js"
import { isPinEndpoint, refs } from "./hir/core.js"

/** Minimal slice of HIR the net computation needs (full Hir satisfies it). */
export interface NetSource {
  readonly wires: ReadonlyArray<{
    readonly from: HirEndpoint
    readonly to: HirEndpoint
    readonly signal?: string | undefined
  }>
}

export interface HarnessNets {
  /** Endpoint key in the same format passed to computeNets' keyOf. */
  readonly keyOf: (e: HirEndpoint) => string
  /** Union-find root key for an endpoint (stable, smallest member key). */
  readonly rootOf: (e: HirEndpoint) => string
  /**
   * Canonical net NAME for an endpoint: the first sorted signal carried by
   * any wire on the net, else the root key. Undefined when the endpoint is
   * on no wire at all. What test plans print.
   */
  readonly nameOf: (e: HirEndpoint) => string | undefined
  /** Deterministic groups: members sorted, groups sorted by first member. */
  readonly groups: ReadonlyArray<ReadonlyArray<string>>
}

/** Default endpoint key: the PRD §19 refs grammar. */
export const endpointRefKey = (e: HirEndpoint): string =>
  isPinEndpoint(e) ? refs.pin(e.connector, e.pin) : refs.splice(e.splice)

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Compute electrical nets over wires (splices merge nets because both wire
 * ends land on the same splice key). `keyOf` lets consumers keep their
 * serialized key format (graph.json node ids, test-point ids) while
 * sharing one connectivity computation.
 */
export const computeNets = (
  hir: NetSource,
  keyOf: (e: HirEndpoint) => string = endpointRefKey
): HarnessNets => {
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let root = parent.get(k) ?? k
    if (root !== k) {
      root = find(root)
      parent.set(k, root)
    }
    return root
  }
  // Smallest key wins as root — deterministic regardless of wire order.
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb)
  }
  for (const w of hir.wires) union(keyOf(w.from), keyOf(w.to))

  const signalsByRoot = new Map<string, Array<string>>()
  const membersByRoot = new Map<string, Array<string>>()
  for (const w of hir.wires) {
    const root = find(keyOf(w.from))
    if (w.signal !== undefined) {
      const list = signalsByRoot.get(root) ?? []
      list.push(w.signal)
      signalsByRoot.set(root, list)
    }
    for (const e of [w.from, w.to]) {
      const key = keyOf(e)
      const members = membersByRoot.get(root) ?? []
      if (!members.includes(key)) members.push(key)
      membersByRoot.set(root, members)
    }
  }

  const groups = [...membersByRoot.values()]
    .map((m) => [...m].sort(cmp))
    .sort((a, b) => cmp(a[0]!, b[0]!))

  const rootOf = (e: HirEndpoint): string => find(keyOf(e))
  return {
    keyOf,
    rootOf,
    nameOf: (e) => {
      const root = rootOf(e)
      if (!membersByRoot.has(root)) return undefined
      const signals = signalsByRoot.get(root)
      return signals !== undefined ? [...signals].sort(cmp)[0]! : root
    },
    groups
  }
}
