/** One-line summaries keyed by rule name. The rule LIST renders from the
 * live builtinRules array (in the app and in the generated llms files), so
 * the reference cannot drift from the shipped rule set. */
export const RULE_SUMMARIES: Record<string, string> = {
  missingRevision: "Harness must declare a revision; releases fail closed without one.",
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
