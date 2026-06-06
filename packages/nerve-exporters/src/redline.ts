/**
 * Technician redline workflow (PRD §39).
 *
 * Manufacturing feedback flows back into source control instead of living
 * in PDF markups: every redline maps to an HIR object, engineers accept or
 * reject with a recorded reason, and accepted redlines yield a structured
 * patch (the same shape `variant()` consumes) so the fix is a reviewable
 * code change, not a verbal agreement.
 */
import { DiagnosticSeverity, type Diagnostic, type Hir, type VariantOptions } from "@grayhaven/nerve"

export type RedlineType =
  | "ambiguity"
  | "incorrect-length"
  | "incorrect-label"
  | "orientation"
  | "process"
  | "other"

export interface Redline {
  readonly id: string
  /** HIR object reference, e.g. `wire:W7` or `label:L2`. */
  readonly target: string
  readonly type: RedlineType
  readonly description: string
  /** Proposed corrected value (length in harness units, label text, ...). */
  readonly proposedValue?: string
  readonly release: string
  readonly serial?: string
  readonly reportedBy?: string
  readonly status: "open" | "accepted" | "rejected"
  readonly resolution?: {
    readonly by?: string
    readonly reason: string
    readonly resolvedAt: string
  }
}

/** Validate that a redline's target exists in the HIR. */
export const validateRedlineTarget = (hir: Hir, target: string): Diagnostic | undefined => {
  const [kind, id] = target.split(":")
  const exists =
    (kind === "wire" && hir.wires.some((w) => w.id === id)) ||
    (kind === "label" && hir.labels.some((l) => l.id === id)) ||
    (kind === "branch" && hir.branches.some((b) => b.id === id)) ||
    (kind === "splice" && hir.splices.some((s) => s.id === id)) ||
    (kind === "connector" && hir.connectors.some((c) => c.ref === (id ?? "").split(".")[0]))
  return exists
    ? undefined
    : {
        code: "HK-RED-001",
        severity: DiagnosticSeverity.Error,
        message: `Redline target ${target} does not exist in this harness.`,
        target
      }
}

export const createRedline = (
  opts: Omit<Redline, "status" | "resolution">
): Redline => ({ ...opts, status: "open" })

/** Accept or reject. Rejected redlines are retained with their reason (PRD §39). */
export const resolveRedline = (
  redline: Redline,
  resolution: {
    readonly accept: boolean
    readonly reason: string
    readonly by?: string
    readonly resolvedAt: string
  }
): Redline => ({
  ...redline,
  status: resolution.accept ? "accepted" : "rejected",
  resolution: {
    ...(resolution.by !== undefined ? { by: resolution.by } : {}),
    reason: resolution.reason,
    resolvedAt: resolution.resolvedAt
  }
})

/**
 * Structured patch for an accepted redline — `VariantOptions`-shaped so it
 * can be applied with `variant()` or hand-translated into the source edit.
 */
export const suggestPatch = (
  redline: Redline
): Partial<VariantOptions> | undefined => {
  const [kind, id] = redline.target.split(":")
  if (id === undefined || redline.proposedValue === undefined) return undefined
  if (kind === "wire" && redline.type === "incorrect-length") {
    const length = Number(redline.proposedValue)
    if (!Number.isFinite(length)) return undefined
    return { wires: { override: { [id]: { length } } } }
  }
  if (kind === "label" && redline.type === "incorrect-label") {
    return { labels: { override: { [id]: { text: redline.proposedValue } } } }
  }
  if (kind === "branch" && redline.type === "incorrect-length") {
    const nominalLength = Number(redline.proposedValue)
    if (!Number.isFinite(nominalLength)) return undefined
    return { branches: { override: { [id]: { nominalLength } } } }
  }
  return undefined
}
