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
  wireSignalMismatch: "A wire's endpoints must agree on the signal it carries.",
  unparseableGauge: "Flags gauges that aren't AWG, so the gauge-based checks can't verify them (metric is Info, not a warning).",
  connectorCurrentExceeded: "Wire current estimate must stay within the connector contact's rated amps.",
  connectorVoltageExceeded: "A rail's nominal voltage (from its name) must stay within the connector's rated volts.",
  voltageRatingBelowSignal: "A wire's voltage rating must meet the nominal volts its signal carries.",
  reservedPinAssigned: "Reserved/keyed pins must stay unassigned.",
  breakoutTighterThanBendRadius: "A branch breakout must clear the bundle's minimum bend radius.",
  bundleOverSleeveCapacity: "A branch bundle must fit inside its sleeve's capacity."
}
