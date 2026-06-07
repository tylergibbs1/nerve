import type { Diagnostic } from "@grayhaven/nerve"
import { selectionFromTarget, setSelection } from "../lib/selection.js"

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
      aria-label="Diagnostics"
    >
      <h3>Diagnostics ({diagnostics.length})</h3>
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
                    if (e.key === "Enter") setSelection(sel)
                  }
                }
              : {})}
          >
            <span className="code">{d.code}</span>
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
