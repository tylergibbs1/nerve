/**
 * Validation rule primitives (PRD §9.4).
 *
 * Rules are plain TypeScript functions that run against HIR — never against
 * user source. Built-in rules live in `@grayhaven/nerve-rules`; users define
 * custom rules with `rule()` and package them like any other TypeScript.
 */
import type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js"
import type { Hir } from "./hir/schema.js"

export interface RuleReport {
  readonly severity: DiagnosticSeverity
  readonly message: string
  readonly target?: string
  /** Additional involved refs (PRD §19 grammar) — multi-entity findings. */
  readonly targets?: ReadonlyArray<string>
  /** Structured values behind the message (measured vs. limit, counts). */
  readonly data?: Readonly<Record<string, string | number>>
  /** Override the rule's stable code for this report. Rarely needed. */
  readonly code?: string
}

export interface RuleContext {
  readonly hir: Hir
  report(report: RuleReport): void
}

export interface Rule {
  readonly name: string
  /** Stable diagnostic code attached to this rule's reports. */
  readonly code: string
  run(ctx: RuleContext): void
}

export interface RuleOptions {
  readonly code?: string
}

/** Define a validation rule: `rule("require-can-pairs-twisted", (ctx) => {...})`. */
export const rule = (
  name: string,
  run: (ctx: RuleContext) => void,
  options: RuleOptions = {}
): Rule => ({
  name,
  code: options.code ?? `HK-RULE-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
  run
})

/**
 * Per-rule severity configuration (PRD §10.5 config example):
 * `{ missingWireColor: "error", missingLabel: "warning", noisyRule: "off" }`.
 */
export type RuleConfig = Readonly<Record<string, DiagnosticSeverity | "off">>

/**
 * Run rules against HIR, producing canonically ordered diagnostics.
 * Deterministic: output depends only on (hir, rules, config).
 */
export const runRules = (
  hir: Hir,
  rules: ReadonlyArray<Rule>,
  config: RuleConfig = {}
): ReadonlyArray<Diagnostic> => {
  const diagnostics: Array<Diagnostic> = []
  for (const r of rules) {
    const override = config[r.name]
    if (override === "off") continue
    r.run({
      hir,
      report: ({ severity, message, target, targets, data, code }) => {
        diagnostics.push({
          code: code ?? r.code,
          severity: override ?? severity,
          message,
          ...(target !== undefined ? { target } : {}),
          ...(targets !== undefined && targets.length > 0 ? { targets } : {}),
          ...(data !== undefined && Object.keys(data).length > 0 ? { data } : {})
        })
      }
    })
  }
  diagnostics.sort(
    (a, b) =>
      cmp(a.target ?? "", b.target ?? "") ||
      cmp(a.code, b.code) ||
      cmp(a.message, b.message)
  )
  return diagnostics
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
