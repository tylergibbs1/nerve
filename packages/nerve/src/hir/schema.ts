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
import { Schema } from "effect"

export const HIR_SCHEMA_VERSION = "0.1.0" as const

export const HirUnits = Schema.Literal("mm", "in")

export const HirPinRef = Schema.Struct({
  connector: Schema.String,
  pin: Schema.String
})

export const HirPin = Schema.Struct({
  pin: Schema.String,
  signal: Schema.optional(Schema.String)
})

export const HirConnector = Schema.Struct({
  ref: Schema.String,
  mpn: Schema.String,
  manufacturer: Schema.optional(Schema.String),
  family: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  gender: Schema.optional(Schema.Literal("plug", "receptacle", "hermaphroditic")),
  pinCount: Schema.Number,
  pins: Schema.Array(HirPin)
})

export const HirWire = Schema.Struct({
  id: Schema.String,
  from: HirPinRef,
  to: HirPinRef,
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
  twistGroup: Schema.optional(Schema.String),
  shieldGroup: Schema.optional(Schema.String),
  branch: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String)
})

export const HirBranch = Schema.Struct({
  id: Schema.String,
  path: Schema.Array(Schema.String),
  parent: Schema.optional(Schema.String),
  sleeve: Schema.optional(Schema.String),
  nominalLength: Schema.optional(Schema.Number),
  breakoutDistance: Schema.optional(Schema.Number)
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
  target: Schema.optional(Schema.String)
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
  cables: Schema.Array(Schema.Unknown),
  branches: Schema.Array(HirBranch),
  splices: Schema.Array(Schema.Unknown),
  labels: Schema.Array(HirLabel),
  bom: Schema.Array(HirBomItem),
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

/** Decode an untrusted value (e.g. a cached `harness.json`) into HIR. Throws `ParseError`. */
export const decodeHir = Schema.decodeUnknownSync(Hir)

/** Decode as an Effect, for use inside services. */
export const decodeHirEffect = Schema.decodeUnknown(Hir)

/** Encode HIR back to its JSON-ready form. */
export const encodeHir = Schema.encodeSync(Hir)

/** Stable object references (PRD §19), e.g. `connector:J1.pin:1`. */
export const refs = {
  connector: (ref: string) => `connector:${ref}`,
  pin: (connector: string, pin: string) => `connector:${connector}.pin:${pin}`,
  wire: (id: string) => `wire:${id}`,
  branch: (id: string) => `branch:${id}`,
  splice: (id: string) => `splice:${id}`,
  label: (id: string) => `label:${id}`,
  bom: (mpn: string) => `bom:${mpn}`
} as const
