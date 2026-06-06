export {
  branchMissingLabel,
  builtinRules,
  differentialPairNotTwisted,
  gaugeCurrentMismatch,
  gaugeOutsideConnectorRange,
  missingGroundReturn,
  missingRevision,
  missingWireColor,
  missingWireGauge,
  missingSeal,
  missingWireLength,
  requireApprovedParts,
  sealIncompatible,
  shieldDrainUnconnected,
  spliceMissingNotes,
  terminalIncompatible,
  twistGroupTooSmall,
  unconnectedAssignedPin,
  wireSignalMismatch
} from "./rules.js"

export {
  AMPACITY_BY_AWG,
  differentialPartner,
  isGroundSignal,
  isPowerSignal,
  isShieldSignal,
  parseAwg,
  requiredAwgForCurrent
} from "./wire-data.js"
