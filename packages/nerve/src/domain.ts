/**
 * Core domain model for Grayhaven Nerve.
 *
 * These are the user-facing design types produced by the DSL builders.
 * The compiler normalizes a `HarnessDesign` into the HIR (see ./hir/schema.ts),
 * which is what renderers, validators, and exporters consume.
 */

export type Units = "mm" | "in"

export type ConnectorGender = "plug" | "receptacle" | "hermaphroditic"

/** Datasheet/source provenance and verification state (PRD §30, §38). */
export interface PartProvenance {
  readonly source?: string
  readonly datasheet?: string
  /** "verified" requires a review pass; library seed data is "inspired-by". */
  readonly verification: "unverified" | "inspired-by" | "verified"
  /** ISO date of last verification. */
  readonly lastVerified?: string
}

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
  /** Pins that must stay unassigned (keying, future use, no-connects). */
  readonly reservedPins?: ReadonlyArray<number | string>
  readonly matingMpn?: string
  readonly compatibleTerminals?: ReadonlyArray<string>
  readonly compatibleSeals?: ReadonlyArray<string>
  readonly compatibleBackshells?: ReadonlyArray<string>
  readonly wireGaugeRange?: { readonly min: string; readonly max: string }
  /** Environmentally sealed housing: every populated cavity needs a seal. */
  readonly sealed?: boolean
  readonly currentLimitA?: number
  readonly voltageLimitV?: number
  readonly crimpTool?: string
  readonly insertionTool?: string
  readonly extractionTool?: string
  readonly provenance?: PartProvenance
}

/** A reference to a specific pin/cavity on a connector instance. */
export interface PinRef {
  readonly kind: "pin-ref"
  readonly connector: string
  readonly pin: string
}

/** A reference to a splice node. */
export interface SpliceRef {
  readonly kind: "splice-ref"
  readonly splice: string
}

/** Where a wire terminates: a connector pin or a splice. */
export type WireEndpoint = PinRef | SpliceRef

/** Map of pin number/name to assigned signal name. */
export type PinAssignments = Readonly<Record<string | number, string>>

/** A connector instance placed in a harness, e.g. `connector("J1", part, {...})`. */
export interface ConnectorInstance {
  readonly kind: "connector"
  readonly ref: string
  readonly part: ConnectorPart
  readonly pins: Readonly<Record<string, string>>
  /** Terminal MPN per pin (PRD §30). */
  readonly terminals: Readonly<Record<string, string>>
  /** Seal MPN per pin. */
  readonly seals: Readonly<Record<string, string>>
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
  /** Cable this wire is a conductor of (see `cable()`). */
  readonly cable?: string
  /** Conductor number/name within the cable. */
  readonly conductor?: string | number
  readonly notes?: string
}

export interface WireDef extends WireProps {
  readonly kind: "wire"
  readonly id: string
  readonly from: WireEndpoint
  readonly to: WireEndpoint
}

export interface SpliceProps {
  /** crimp, solder-sleeve, ultrasonic-weld, ... */
  readonly type?: string
  /** Crimp or solder-sleeve part number. */
  readonly part?: string
  /** Branch the splice sits on. */
  readonly branch?: string
  /** Distance along the branch from its start, in harness units. */
  readonly location?: number
  /** Seal / heat-shrink / inspection notes (PRD §9.2). */
  readonly notes?: string
}

export interface SpliceDef extends SpliceProps {
  readonly kind: "splice"
  readonly id: string
}

export interface CableProps {
  /** Catalog type, e.g. "2x24AWG twisted shielded". */
  readonly type?: string
  readonly conductors?: number
  readonly shield?: string
  readonly jacket?: string
  readonly outerDiameter?: number
  readonly notes?: string
}

export interface CableDef extends CableProps {
  readonly kind: "cable"
  readonly id: string
}

export interface BranchProps {
  readonly path: ReadonlyArray<ConnectorInstance | string>
  readonly parent?: string
  readonly sleeve?: string
  readonly nominalLength?: number
  readonly breakoutDistance?: number
  /** Tightest bend the bundle tolerates (mm) — breakouts must clear it. */
  readonly minBendRadius?: number
}

export interface BranchDef {
  readonly kind: "branch"
  readonly id: string
  readonly path: ReadonlyArray<string>
  readonly parent?: string
  readonly sleeve?: string
  readonly nominalLength?: number
  readonly breakoutDistance?: number
  readonly minBendRadius?: number
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
  readonly splices?: ReadonlyArray<SpliceDef>
  readonly cables?: ReadonlyArray<CableDef>
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
  readonly splices: ReadonlyArray<SpliceDef>
  readonly cables: ReadonlyArray<CableDef>
}
