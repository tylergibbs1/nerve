/**
 * Map HK-* diagnostics (which carry HIR refs, not source positions) onto
 * editor ranges by locating the referenced id in the source text:
 *   wire:W2              -> first "W2" string literal
 *   connector:P1.pin:1   -> first "P1" string literal
 *   splice:S1 / branch:B1 -> likewise
 * Heuristic by design — ids are quoted exactly once at their definition in
 * idiomatic harness source, and a wrong-but-nearby anchor still beats the
 * bottom panel alone. Falls back to the file start.
 */
import type { Diagnostic as CmDiagnostic } from "@codemirror/lint"

export interface HkDiagnostic {
  readonly code: string
  readonly severity: string
  readonly message: string
  readonly target?: string | undefined
}

const idFromTarget = (target: string): string | undefined => {
  const m = /^(?:wire|connector|splice|branch|label|bom):([^.]+)/.exec(target)
  return m?.[1]
}

export const toEditorDiagnostics = (
  source: string,
  diagnostics: ReadonlyArray<HkDiagnostic>
): CmDiagnostic[] =>
  diagnostics.map((d) => {
    let from = 0
    let to = 0
    const id = d.target !== undefined ? idFromTarget(d.target) : undefined
    if (id !== undefined) {
      const needle = `"${id}"`
      const idx = source.indexOf(needle)
      if (idx !== -1) {
        from = idx
        to = idx + needle.length
      }
    }
    return {
      from,
      to,
      severity: d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "info",
      message: `${d.code}: ${d.message}`,
      source: "nerve"
    }
  })
