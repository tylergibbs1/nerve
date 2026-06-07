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

export {
  codesToNumbers,
  RULE_CATEGORY_BANDS,
  ruleCategory,
  ruleCodeFromNumber,
  ruleCodeNumber,
  type RuleCategory
} from "./code-numbers.js"
