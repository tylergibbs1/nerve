import type { Diagnostic } from "@grayhaven/nerve"
import { Link } from "@tanstack/react-router"
import rulesMeta from "../docs/rules-meta.json"
import { RULE_SUMMARIES } from "../docs/rule-summaries.js"
import { jumpToSource } from "../lib/editor-registry.js"
import { selectionFromTarget, setSelection } from "../lib/selection.js"

// Inline remedy per HK code: the JSON carries code -> rule name, the
// one-line summaries are keyed by name (same join as the rules reference).
const ruleSummaries = new Map(rulesMeta.map((r) => [r.code, RULE_SUMMARIES[r.name] ?? r.name]))

export function DiagnosticsPanel({
  diagnostics
}: {
  diagnostics: ReadonlyArray<Diagnostic>
}) {
  return (
    <div
      className="diagnostics-panel"
      // axe scrollable-region-focusable: keyboard users scroll the list.
      tabIndex={0}
      role="region"
      aria-label="Issues"
    >
      <h3>Issues ({diagnostics.length})</h3>
      {diagnostics.length === 0 && <div className="diag">No issues found.</div>}
      {diagnostics.map((d, i) => {
        const sel = d.target !== undefined ? selectionFromTarget(d.target) : undefined
        // Multi-entity findings get per-ref chips; rows with chips must NOT
        // be buttons themselves (axe: no focusable descendants inside
        // role="button"), so the primary target becomes the first chip.
        const refChips =
          d.targets !== undefined
            ? [...new Set([d.target, ...d.targets])].filter((t): t is string => t !== undefined)
            : []
        const rowClickable = sel !== undefined && refChips.length === 0
        return (
          <div
            key={i}
            className={`diag ${d.severity}${rowClickable ? " selectable" : ""}`}
            // §11.3: clicking a diagnostic selects its object everywhere.
            {...(rowClickable
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  onClick: () => setSelection(sel),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelection(sel)
                    }
                  }
                }
              : {})}
          >
            <Link
              to="/docs/rules"
              className="code"
              title={ruleSummaries.get(d.code)}
              onClick={(e) => e.stopPropagation()}
            >
              {d.code}
            </Link>
            <span className="target">{d.target ?? ""}</span>
            <span className="message">{d.message}</span>
            {(refChips.length > 0 || d.data !== undefined) && (
              <span className="diag-detail">
                {/* Every involved ref is selectable. */}
                {refChips.map((t) => {
                  const tSel = selectionFromTarget(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      className="diag-chip ref"
                      disabled={tSel === undefined}
                      onClick={() => {
                        if (tSel !== undefined) setSelection(tSel)
                        jumpToSource(t)
                      }}
                    >
                      {t}
                    </button>
                  )
                })}
                {/* Structured values behind the message (measured vs limit). */}
                {d.data !== undefined &&
                  Object.entries(d.data).map(([k, v]) => (
                    <span key={k} className="diag-chip">
                      {k}={String(v)}
                    </span>
                  ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
