/**
 * Core domain model for Grayhaven Nerve.
 *
 * These are the user-facing design types produced by the DSL builders.
 * The compiler normalizes a `HarnessDesign` into the HIR (see ./hir/schema.ts),
 * which is what renderers, validators, and exporters consume.
 */

export type Units = "mm" | "in"

export type ConnectorGender = "plug" | "receptacle" | "hermaphroditic"

/**
 * Component master data for a connector housing (PRD §9.2, §30).
 * Instances reference a part; parts live in libraries such as
 * `@grayhaven/nerve-connectors`.
 */
export interface ConnectorPart {
  readonly mpn: string
  readonly manufacturer?: string
  readonly family?: string
  readonly description?: string
  readonly gender?: ConnectorGender
  readonly pinCount: number
  readonly pinNumbering?: string
  readonly cavityLayout?: { readonly rows: number; readonly columns: number }
  readonly matingMpn?: string
  readonly compatibleTerminals?: ReadonlyArray<string>
  readonly compatibleSeals?: ReadonlyArray<string>
  readonly wireGaugeRange?: { readonly min: string; readonly max: string }
}

/** A reference to a specific pin/cavity on a connector instance. */
export interface PinRef {
  readonly kind: "pin-ref"
  readonly connector: string
  readonly pin: string
}

/** Map of pin number/name to assigned signal name. */
export type PinAssignments = Readonly<Record<string | number, string>>

/** A connector instance placed in a harness, e.g. `connector("J1", part, {...})`. */
export interface ConnectorInstance {
  readonly kind: "connector"
  readonly ref: string
  readonly part: ConnectorPart
  readonly pins: Readonly<Record<string, string>>
  /** Build a `PinRef` for a pin on this connector. */
  pin(pin: string | number): PinRef
}

export interface WireProps {
  readonly gauge?: string
  readonly color?: string
  readonly stripe?: string
  readonly length?: number
  readonly lengthTolerance?: number
  readonly signal?: string
  readonly insulation?: string
  readonly voltageRating?: number
  readonly temperatureRating?: number
  readonly currentEstimate?: number
  readonly twistGroup?: string
  readonly shieldGroup?: string
  readonly notes?: string
}

export interface WireDef extends WireProps {
  readonly kind: "wire"
  readonly id: string
  readonly from: PinRef
  readonly to: PinRef
}

export interface BranchProps {
  readonly path: ReadonlyArray<ConnectorInstance | string>
  readonly parent?: string
  readonly sleeve?: string
  readonly nominalLength?: number
  readonly breakoutDistance?: number
}

export interface BranchDef {
  readonly kind: "branch"
  readonly id: string
  readonly path: ReadonlyArray<string>
  readonly parent?: string
  readonly sleeve?: string
  readonly nominalLength?: number
  readonly breakoutDistance?: number
}

export interface LabelProps {
  readonly text: string
  readonly attachTo: ConnectorInstance | string
  readonly offsetFrom?: ConnectorInstance | string
  readonly distance?: number
  readonly material?: string
  readonly quantity?: number
}

export interface LabelDef {
  readonly kind: "label"
  readonly id: string
  readonly text: string
  readonly attachTo: string
  readonly offsetFrom?: string
  readonly distance?: number
  readonly material?: string
  readonly quantity?: number
}

export interface HarnessProps {
  readonly revision: string
  readonly units: Units
  readonly metadata?: Readonly<Record<string, string>>
  readonly connectors: ReadonlyArray<ConnectorInstance>
  readonly wires: ReadonlyArray<WireDef>
  readonly branches?: ReadonlyArray<BranchDef>
  readonly labels?: ReadonlyArray<LabelDef>
}

/** The root design object returned by `harness(...)` — the unit of compilation. */
export interface HarnessDesign {
  readonly kind: "harness"
  readonly id: string
  readonly revision: string
  readonly units: Units
  readonly metadata: Readonly<Record<string, string>>
  readonly connectors: ReadonlyArray<ConnectorInstance>
  readonly wires: ReadonlyArray<WireDef>
  readonly branches: ReadonlyArray<BranchDef>
  readonly labels: ReadonlyArray<LabelDef>
}
