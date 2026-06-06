/**
 * Diagnostics primitives (PRD §11.2).
 *
 * Every diagnostic carries a stable code so CI gates, docs, and suppression
 * config can rely on it across releases.
 */

export const DiagnosticSeverity = {
  Error: "error",
  Warning: "warning",
  Info: "info"
} as const

export type DiagnosticSeverity =
  (typeof DiagnosticSeverity)[keyof typeof DiagnosticSeverity]

export interface Diagnostic {
  /** Stable code, e.g. `HK-WIRE-001`. */
  readonly code: string
  readonly severity: DiagnosticSeverity
  readonly message: string
  /** Stable HIR object reference, e.g. `wire:W12` or `connector:J1.pin:3`. */
  readonly target?: string
}

/** Structural diagnostic codes emitted by the core compiler. */
export const Codes = {
  DuplicateConnectorRef: "HK-CONN-001",
  UndefinedConnectorRef: "HK-CONN-002",
  UndefinedPinRef: "HK-CONN-003",
  DuplicateWireId: "HK-WIRE-001",
  WireEndpointsIdentical: "HK-WIRE-002",
  DuplicateBranchId: "HK-BRANCH-001",
  BranchUndefinedEndpoint: "HK-BRANCH-002",
  DuplicateLabelId: "HK-LABEL-001",
  LabelUndefinedTarget: "HK-LABEL-002"
} as const

export const hasErrors = (diagnostics: ReadonlyArray<Diagnostic>): boolean =>
  diagnostics.some((d) => d.severity === DiagnosticSeverity.Error)
