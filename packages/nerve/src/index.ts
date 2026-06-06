/**
 * @grayhaven/nerve — Harnesses as code.
 *
 * Domain model, DSL builders, HIR types/schema, compiler interface, and
 * validation primitives (PRD §10.1).
 */
export type {
  BranchDef,
  BranchProps,
  ConnectorGender,
  ConnectorInstance,
  ConnectorPart,
  HarnessDesign,
  HarnessProps,
  LabelDef,
  LabelProps,
  PinAssignments,
  PinRef,
  Units,
  WireDef,
  WireProps
} from "./domain.js"

export { branch, connector, harness, label, wire } from "./dsl.js"

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
  Hir,
  HIR_SCHEMA_VERSION,
  HirBomItem,
  HirBranch,
  HirConnector,
  HirLabel,
  HirPinRef,
  HirWire,
  refs
} from "./hir/schema.js"

export { compileDesign, type CompileResult } from "./compile.js"

export { defineConfig, type NerveConfig } from "./config.js"

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
