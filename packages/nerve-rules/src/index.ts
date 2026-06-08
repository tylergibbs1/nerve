export {
  branchMissingLabel,
  branchParentInvalid,
  breakoutTighterThanBendRadius,
  breakoutTighterThanBendRadiusWith,
  builtinRules,
  builtinRulesWith,
  bundleOverSleeveCapacity,
  bundleOverSleeveCapacityWith,
  cableConductorOverflow,
  cavityLayoutMismatch,
  connectorCurrentExceeded,
  connectorVoltageExceeded,
  contactCountExceedsPinCount,
  differentialPairNotTwisted,
  gaugeCurrentMismatchWith,
  gaugeCurrentMismatch,
  gaugeOutsideConnectorRange,
  missingGroundReturn,
  missingRevision,
  missingWireColor,
  missingWireGauge,
  missingSeal,
  missingWireLength,
  multipleWiresIntoPin,
  nonPositiveWireLength,
  orphanedDifferentialHalf,
  requireApprovedParts,
  reservedPinAssigned,
  sealIncompatible,
  shieldDrainUnconnected,
  spliceMissingNotes,
  terminalIncompatible,
  twistGroupGaugeMismatch,
  twistGroupTooSmall,
  unconnectedAssignedPin,
  unparseableGauge,
  voltageRatingBelowSignal,
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
