import { createFileRoute } from "@tanstack/react-router"
import { builtinRules } from "@grayhaven/nerve-rules"

export const Route = createFileRoute("/docs/rules")({
  component: RulesReference
})

/** One-line summaries keyed by rule name; the list itself renders from the
 * live builtinRules array so docs can't drift from the shipped rule set. */
const SUMMARIES: Record<string, string> = {
  missingRevision: "Harness must declare a revision — releases fail closed without one.",
  missingWireColor: "Every wire should declare a color for the cut list and loom work.",
  missingWireLength: "Every wire should declare a length; cut lists need real numbers.",
  branchMissingLabel: "Bundle branches should carry a printed label.",
  missingWireGauge: "Every wire must declare a gauge.",
  missingSeal: "Sealed connector families require a seal part on each wired cavity.",
  sealIncompatible: "Seal part must match the wire gauge it seals.",
  terminalIncompatible: "Terminal part must accept the wire gauge crimped into it.",
  requireApprovedParts: "Parts must come from the approved library (provenance ≠ unverified).",
  gaugeCurrentMismatch: "Wire gauge must carry the declared or estimated current (ampacity table).",
  gaugeOutsideConnectorRange: "Wire gauge must sit inside the connector part's wireGaugeRange.",
  differentialPairNotTwisted: "Differential pairs (CAN_H/CAN_L…) must share a twist group.",
  twistGroupTooSmall: "A twist group needs at least two wires.",
  missingGroundReturn: "Power signals need a ground return path in the same harness.",
  shieldDrainUnconnected: "Cable shields must land their drain on a pin.",
  spliceMissingNotes: "Splices should document their joint (type/notes) for the build book.",
  unconnectedAssignedPin: "A pin assigned a signal must be touched by at least one wire.",
  wireSignalMismatch: "A wire's endpoints must agree on the signal it carries."
}

function RulesReference() {
  return (
    <>
      <span className="spec-tag">Validation Rules</span>
      <h1>{builtinRules.length} built-in rules.</h1>
      <p>
        Stable <code>HK-*</code> codes, suitable for CI gating and waivers. This table renders
        from the shipped <code>builtinRules</code> array — it cannot drift from the code.
        Custom rules use the same <code>rule()</code> API and get their own codes.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Code</th>
            <th>Rule</th>
            <th>Checks</th>
          </tr>
        </thead>
        <tbody>
          {builtinRules.map((r) => (
            <tr key={r.code}>
              <td className="cell-code">{r.code}</td>
              <td className="cell-code">{r.name}</td>
              <td className="cell-text">{SUMMARIES[r.name] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
