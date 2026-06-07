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
        return (
          <div
            key={i}
            className={`diag ${d.severity}${sel !== undefined ? " selectable" : ""}`}
            // §11.3: clicking a diagnostic selects its object everywhere.
            {...(sel !== undefined
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
          </div>
        )
      })}
    </div>
  )
}
