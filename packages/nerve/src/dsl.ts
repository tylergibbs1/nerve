/**
 * TypeScript authoring DSL (PRD §9.1).
 *
 * Builders are cheap and permissive: they capture intent as plain data.
 * Correctness lives in the compiler/validator, which reports precise
 * diagnostics instead of throwing mid-definition.
 */
import type {
  BranchDef,
  BranchProps,
  CableDef,
  CableProps,
  ConnectorInstance,
  ConnectorPart,
  HarnessDesign,
  HarnessProps,
  LabelDef,
  LabelProps,
  PinAssignments,
  PinRef,
  SpliceDef,
  SpliceProps,
  WireDef,
  WireEndpoint,
  WireProps
} from "./domain.js"

const toRef = (target: ConnectorInstance | string): string =>
  typeof target === "string" ? target : target.ref

/**
 * Per-pin part assignment: a map of pin → MPN, or a single MPN applied to
 * every assigned pin (the common case — one terminal type per housing).
 */
export type PinPartAssignment = string | Readonly<Record<string | number, string>>

const expandPinParts = (
  assignment: PinPartAssignment | undefined,
  pins: Readonly<Record<string, string>>
): Record<string, string> => {
  if (assignment === undefined) return {}
  if (typeof assignment === "string") {
    return Object.fromEntries(Object.keys(pins).map((pin) => [pin, assignment]))
  }
  return Object.fromEntries(
    Object.entries(assignment).map(([pin, mpn]) => [String(pin), mpn])
  )
}

/** Place a connector in the harness: `connector("J1", MolexMicroFit["43025-0800"], { pins: {...}, terminals: "43030-0007" })`. */
export const connector = (
  ref: string,
  part: ConnectorPart,
  opts: {
    readonly pins: PinAssignments
    readonly terminals?: PinPartAssignment
    readonly seals?: PinPartAssignment
  }
): ConnectorInstance => {
  const pins: Record<string, string> = {}
  for (const [pin, signal] of Object.entries(opts.pins)) {
    pins[String(pin)] = signal
  }
  return {
    kind: "connector",
    ref,
    part,
    pins,
    terminals: expandPinParts(opts.terminals, pins),
    seals: expandPinParts(opts.seals, pins),
    pin: (pin: string | number): PinRef => ({
      kind: "pin-ref",
      connector: ref,
      pin: String(pin)
    })
  }
}

/** Anything a wire can terminate on: a pin ref, a splice (def or ref). */
export type EndpointInput = PinRef | SpliceDef | { kind: "splice-ref"; splice: string }

const toEndpoint = (input: EndpointInput): WireEndpoint =>
  input.kind === "splice"
    ? { kind: "splice-ref", splice: input.id }
    : input

/**
 * Define a wire between two endpoints:
 * `wire("W1", j1.pin(1), m1.pin(1), { gauge: "18AWG", ... })` or
 * `wire("W5", j1.pin(2), s1, {...})` where `s1` is a splice.
 */
export const wire = (
  id: string,
  from: EndpointInput,
  to: EndpointInput,
  props: WireProps = {}
): WireDef => ({
  kind: "wire",
  id,
  from: toEndpoint(from),
  to: toEndpoint(to),
  ...props
})

/** Define a splice node: `splice("S1", { type: "crimp", branch: "main", location: 120 })`. */
export const splice = (id: string, props: SpliceProps = {}): SpliceDef => ({
  kind: "splice",
  id,
  ...props
})

/** Define a multi-conductor cable that wires can belong to via `cable`/`conductor` props. */
export const cable = (id: string, props: CableProps = {}): CableDef => ({
  kind: "cable",
  id,
  ...props
})

/** Define a physical branch through the harness: `branch("main", { path: [j1, m1], ... })`. */
export const branch = (id: string, props: BranchProps): BranchDef => {
  const { path, ...rest } = props
  return {
    kind: "branch",
    id,
    path: path.map(toRef),
    ...rest
  }
}

/** Define a label: `label("L1", { text: "MOTOR CTRL A", attachTo: "main", ... })`. */
export const label = (id: string, props: LabelProps): LabelDef => {
  const { attachTo, offsetFrom, ...rest } = props
  return {
    kind: "label",
    id,
    attachTo: toRef(attachTo),
    ...(offsetFrom !== undefined ? { offsetFrom: toRef(offsetFrom) } : {}),
    ...rest
  }
}

/** Define a harness — the root design object and default export of a `.harness.ts` file. */
export const harness = (id: string, props: HarnessProps): HarnessDesign => ({
  kind: "harness",
  id,
  revision: props.revision,
  units: props.units,
  metadata: props.metadata ?? {},
  connectors: props.connectors,
  wires: props.wires,
  branches: props.branches ?? [],
  labels: props.labels ?? [],
  splices: props.splices ?? [],
  cables: props.cables ?? []
})
