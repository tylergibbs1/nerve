import type { Diagnostic } from "@grayhaven/nerve"

export function DiagnosticsPanel({
  diagnostics
}: {
  diagnostics: ReadonlyArray<Diagnostic>
}) {
  return (
    <div className="diagnostics-panel">
      <h3>Diagnostics ({diagnostics.length})</h3>
      {diagnostics.length === 0 && <div className="diag">No issues found.</div>}
      {diagnostics.map((d, i) => (
        <div key={i} className={`diag ${d.severity}`}>
          <span className="code">{d.code}</span>
          <span className="target">{d.target ?? ""}</span>
          <span className="message">{d.message}</span>
        </div>
      ))}
    </div>
  )
}
