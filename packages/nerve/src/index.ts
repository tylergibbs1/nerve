/**
 * @grayhaven/nerve — Harnesses as code.
 *
 * Domain model, DSL builders, HIR types/schema, compiler interface, and
 * validation primitives (PRD §10.1).
 */
export type {
  BranchDef,
  BranchProps,
  CableDef,
  CableProps,
  ConnectorGender,
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
  SpliceRef,
  Units,
  WireDef,
  WireEndpoint,
  WireProps
} from "./domain.js"

export {
  branch,
  cable,
  connector,
  harness,
  label,
  splice,
  wire,
  type EndpointInput
} from "./dsl.js"

export {
  Codes,
  DiagnosticSeverity,
  hasErrors,
  type Diagnostic
} from "./diagnostics.js"

export {
  decodeHir,
  decodeHirEffect,
  encodeHir,
  endpointLabel,
  Hir,
  HIR_SCHEMA_VERSION,
  HirBomItem,
  HirBranch,
  HirCable,
  HirConnector,
  HirEndpoint,
  HirLabel,
  HirPinRef,
  HirSplice,
  HirSpliceRef,
  HirWire,
  isPinEndpoint,
  refs
} from "./hir/schema.js"

export { compileDesign, type CompileResult } from "./compile.js"

export {
  defineConfig,
  type CostModel,
  type NerveConfig,
  type PartCost,
  type PartLifecycle
} from "./config.js"

export { variant, type VariantOptions } from "./variant.js"

export {
  diffHir,
  formatDiff,
  isEmptyDiff,
  type EntityChange,
  type FieldChange,
  type HirDiff,
  type PinoutChange,
  type SectionDiff
} from "./diff.js"

export {
  rule,
  runRules,
  type Rule,
  type RuleConfig,
  type RuleContext,
  type RuleOptions,
  type RuleReport
} from "./rules.js"
