/**
 * Harness Intermediate Representation (HIR) schema (PRD §9.3, §19).
 *
 * The HIR is the deterministic, serializable contract between the compiler
 * and everything downstream: validation, layout, rendering, exporting, and
 * test-plan generation. It must be decodable without executing user code.
 *
 * Defined with Effect Schema so every boundary (worker messages, cached
 * artifacts, CLI `inspect`) decodes through the same versioned codec.
 */
import { JSONSchema, Schema } from "effect"

import { HIR_SCHEMA_VERSION } from "./core.js"

export const HirUnits = Schema.Literal("mm", "in")

export const HirPinRef = Schema.Struct({
  connector: Schema.String,
  pin: Schema.String
})

export const HirSpliceRef = Schema.Struct({
  splice: Schema.String
})

/** A wire endpoint: a connector pin or a splice node. */
export const HirEndpoint = Schema.Union(HirPinRef, HirSpliceRef)

export const HirPin = Schema.Struct({
  pin: Schema.String,
  signal: Schema.optional(Schema.String),
  terminal: Schema.optional(Schema.String),
  seal: Schema.optional(Schema.String)
})

export const HirProvenance = Schema.Struct({
  source: Schema.optional(Schema.String),
  datasheet: Schema.optional(Schema.String),
  verification: Schema.Literal("unverified", "inspired-by", "verified"),
  lastVerified: Schema.optional(Schema.String)
})

export const HirConnector = Schema.Struct({
  ref: Schema.String,
  mpn: Schema.String,
  manufacturer: Schema.optional(Schema.String),
  family: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  gender: Schema.optional(Schema.Literal("plug", "receptacle", "hermaphroditic")),
  pinCount: Schema.Number,
  wireGaugeRange: Schema.optional(
    Schema.Struct({ min: Schema.String, max: Schema.String })
  ),
  cavityLayout: Schema.optional(Schema.Struct({ rows: Schema.Number, columns: Schema.Number })),
  matingMpn: Schema.optional(Schema.String),
  reservedPins: Schema.optional(Schema.Array(Schema.String)),
  sealed: Schema.optional(Schema.Boolean),
  compatibleTerminals: Schema.optional(Schema.Array(Schema.String)),
  compatibleSeals: Schema.optional(Schema.Array(Schema.String)),
  /** Per-contact electrical limits from the part datasheet (HK-CONN-016/017). */
  currentLimitA: Schema.optional(Schema.Number),
  voltageLimitV: Schema.optional(Schema.Number),
  crimpTool: Schema.optional(Schema.String),
  provenance: Schema.optional(HirProvenance),
  pins: Schema.Array(HirPin)
})

export const HirWire = Schema.Struct({
  id: Schema.String,
  from: HirEndpoint,
  to: HirEndpoint,
  gauge: Schema.optional(Schema.String),
  color: Schema.optional(Schema.String),
  stripe: Schema.optional(Schema.String),
  length: Schema.optional(Schema.Number),
  lengthTolerance: Schema.optional(Schema.Number),
  signal: Schema.optional(Schema.String),
  insulation: Schema.optional(Schema.String),
  voltageRating: Schema.optional(Schema.Number),
  temperatureRating: Schema.optional(Schema.Number),
  currentEstimate: Schema.optional(Schema.Number),
  /** Crosstalk role for EMC segregation (HK-ELEC-008): noisy source,
   * sensitive sink, or neutral. */
  emcClass: Schema.optional(Schema.Literal("aggressor", "victim", "neutral")),
  twistGroup: Schema.optional(Schema.String),
  shieldGroup: Schema.optional(Schema.String),
  cable: Schema.optional(Schema.String),
  conductor: Schema.optional(Schema.String),
  branch: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String)
})

export const HirSplice = Schema.Struct({
  id: Schema.String,
  type: Schema.optional(Schema.String),
  part: Schema.optional(Schema.String),
  branch: Schema.optional(Schema.String),
  location: Schema.optional(Schema.Number),
  notes: Schema.optional(Schema.String),
  /** Wire IDs attached to this splice (computed by the compiler). */
  wires: Schema.Array(Schema.String)
})

export const HirCable = Schema.Struct({
  id: Schema.String,
  type: Schema.optional(Schema.String),
  conductors: Schema.optional(Schema.Number),
  shield: Schema.optional(Schema.String),
  jacket: Schema.optional(Schema.String),
  outerDiameter: Schema.optional(Schema.Number),
  /** Longest member wire — the cable cut length (computed). */
  cutLength: Schema.optional(Schema.Number),
  notes: Schema.optional(Schema.String),
  /** Member wire IDs (computed by the compiler). */
  wires: Schema.Array(Schema.String)
})

export const HirBranch = Schema.Struct({
  id: Schema.String,
  path: Schema.Array(Schema.String),
  parent: Schema.optional(Schema.String),
  sleeve: Schema.optional(Schema.String),
  nominalLength: Schema.optional(Schema.Number),
  breakoutDistance: Schema.optional(Schema.Number),
  minBendRadius: Schema.optional(Schema.Number),
  /** Ambient the bundle runs in (°C); wires in it need a temperature rating
   * at or above this (HK-ELEC-009). */
  ambientTemperatureC: Schema.optional(Schema.Number)
})

/** An overcurrent protection device (fuse/breaker) and the wires it guards.
 * The link is explicit (`protects`) so the rule never has to infer current
 * flow direction from the undirected wire graph. */
export const HirProtection = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literal("fuse", "breaker"),
  ratingA: Schema.Number,
  /** Wire IDs this device protects. */
  protects: Schema.Array(Schema.String),
  notes: Schema.optional(Schema.String)
})

export const HirLabel = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  attachTo: Schema.String,
  offsetFrom: Schema.optional(Schema.String),
  distance: Schema.optional(Schema.Number),
  material: Schema.optional(Schema.String),
  quantity: Schema.optional(Schema.Number)
})

export const HirBomItem = Schema.Struct({
  internalPartId: Schema.optional(Schema.String),
  mpn: Schema.String,
  manufacturer: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  quantity: Schema.Number,
  unitOfMeasure: Schema.String,
  usedBy: Schema.Array(Schema.String),
  notes: Schema.optional(Schema.String)
})

export const HirDiagnostic = Schema.Struct({
  code: Schema.String,
  severity: Schema.Literal("error", "warning", "info"),
  message: Schema.String,
  target: Schema.optional(Schema.String),
  /** Additional involved refs (PRD §19 grammar) — multi-entity findings. */
  targets: Schema.optional(Schema.Array(Schema.String)),
  /** Structured values behind the message (measured vs. limit, counts). */
  data: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Union(Schema.String, Schema.Number) })
  )
})

export const Hir = Schema.Struct({
  schemaVersion: Schema.Literal(HIR_SCHEMA_VERSION),
  harness: Schema.Struct({
    id: Schema.String,
    revision: Schema.String,
    units: HirUnits,
    metadata: Schema.Record({ key: Schema.String, value: Schema.String })
  }),
  connectors: Schema.Array(HirConnector),
  wires: Schema.Array(HirWire),
  cables: Schema.Array(HirCable),
  branches: Schema.Array(HirBranch),
  splices: Schema.Array(HirSplice),
  labels: Schema.Array(HirLabel),
  bom: Schema.Array(HirBomItem),
  /** Overcurrent protection devices (optional; omitted when none declared). */
  protections: Schema.optional(Schema.Array(HirProtection)),
  diagnostics: Schema.Array(HirDiagnostic),
  layoutHints: Schema.Array(Schema.Unknown),
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

export type Hir = Schema.Schema.Type<typeof Hir>
export type HirConnector = Schema.Schema.Type<typeof HirConnector>
export type HirWire = Schema.Schema.Type<typeof HirWire>
export type HirBranch = Schema.Schema.Type<typeof HirBranch>
export type HirLabel = Schema.Schema.Type<typeof HirLabel>
export type HirBomItem = Schema.Schema.Type<typeof HirBomItem>
export type HirPinRef = Schema.Schema.Type<typeof HirPinRef>
export type HirSpliceRef = Schema.Schema.Type<typeof HirSpliceRef>
export type HirEndpoint = Schema.Schema.Type<typeof HirEndpoint>
export type HirSplice = Schema.Schema.Type<typeof HirSplice>
export type HirCable = Schema.Schema.Type<typeof HirCable>
export type HirProtection = Schema.Schema.Type<typeof HirProtection>

/** Decode an untrusted value (e.g. a cached `harness.json`) into HIR. Throws `ParseError`. */
export const decodeHir = Schema.decodeUnknownSync(Hir)

/** Decode as an Effect, for use inside services. */
export const decodeHirEffect = Schema.decodeUnknown(Hir)

/** Encode HIR back to its JSON-ready form. */
export const encodeHir = Schema.encodeSync(Hir)

/**
 * The HIR contract as draft-07 JSON Schema. Powers the shape-snapshot
 * guard (tests/hir-shape.test.ts) and generated schema docs; useful to
 * external validators too.
 */
export const hirJsonSchema = (): unknown =>
  JSON.parse(JSON.stringify(JSONSchema.make(Hir)))


