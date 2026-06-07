/**
 * Built-in validation rules (PRD §9.4).
 *
 * All rules run against HIR only. Codes are stable; severities are defaults
 * that projects can override per-rule via `RuleConfig`
 * (e.g. `{ missingWireLength: "error" }`).
 */
import {
  DiagnosticSeverity,
  isPinEndpoint,
  refs,
  rule,
  type Hir,
  type HirEndpoint,
  type Rule
} from "@grayhaven/nerve"
import {
  AMPACITY_BY_AWG,
  differentialPartner,
  isGroundSignal,
  isPowerSignal,
  isShieldSignal,
  parseAwg,
  requiredAwgForCurrent,
  estimateBundleDiameterMm,
  INSULATED_OD_MM_BY_AWG,
  signalNominalVolts,
  sleeveCapacityMm
} from "./wire-data.js"

const { Error: Err, Warning: Warn } = DiagnosticSeverity

const endpointKey = (e: HirEndpoint): string =>
  isPinEndpoint(e) ? `${e.connector}:${e.pin}` : `splice:${e.splice}`

/** Pins touched by at least one wire endpoint. */
const wiredPins = (hir: Hir): ReadonlySet<string> => {
  const set = new Set<string>()
  for (const w of hir.wires) {
    set.add(endpointKey(w.from))
    set.add(endpointKey(w.to))
  }
  return set
}

// --- Documentation ----------------------------------------------------------

export const missingRevision: Rule = rule(
  "missingRevision",
  (ctx) => {
    if (ctx.hir.harness.revision.trim() === "") {
      ctx.report({
        severity: Err,
        message: `Harness ${ctx.hir.harness.id} has no revision.`
      })
    }
  },
  { code: "HK-DOC-001" }
)

export const branchMissingLabel: Rule = rule(
  "branchMissingLabel",
  (ctx) => {
    const labeled = new Set(ctx.hir.labels.map((l) => l.attachTo))
    for (const b of ctx.hir.branches) {
      if (!labeled.has(b.id)) {
        ctx.report({
          severity: Warn,
          message: `Branch ${b.id} has no label attached.`,
          target: refs.branch(b.id)
        })
      }
    }
  },
  { code: "HK-DOC-002" }
)

export const spliceMissingNotes: Rule = rule(
  "spliceMissingNotes",
  (ctx) => {
    for (const s of ctx.hir.splices) {
      if (s.notes === undefined && s.type === undefined && s.part === undefined) {
        ctx.report({
          severity: Warn,
          message: `Splice ${s.id} has no type, part, or manufacturing notes.`,
          target: refs.splice(s.id)
        })
      }
    }
  },
  { code: "HK-DOC-003" }
)

// --- Manufacturing ----------------------------------------------------------

export const missingWireLength: Rule = rule(
  "missingWireLength",
  (ctx) => {
    for (const w of ctx.hir.wires) {
      if (w.length === undefined) {
        ctx.report({
          severity: Warn,
          message: `Wire ${w.id} has no length; the cut list cannot include it.`,
          target: refs.wire(w.id)
        })
      }
    }
  },
  { code: "HK-MFG-001" }
)

export const missingWireColor: Rule = rule(
  "missingWireColor",
  (ctx) => {
    for (const w of ctx.hir.wires) {
      if (w.color === undefined) {
        ctx.report({
          severity: Err,
          message: `Wire ${w.id} has no color.`,
          target: refs.wire(w.id)
        })
      }
    }
  },
  { code: "HK-MFG-002" }
)

export const missingWireGauge: Rule = rule(
  "missingWireGauge",
  (ctx) => {
    for (const w of ctx.hir.wires) {
      if (w.gauge === undefined) {
        ctx.report({
          severity: Err,
          message: `Wire ${w.id} has no gauge.`,
          target: refs.wire(w.id)
        })
      }
    }
  },
  { code: "HK-MFG-003" }
)

export const gaugeOutsideConnectorRange: Rule = rule(
  "gaugeOutsideConnectorRange",
  (ctx) => {
    const byRef = new Map(ctx.hir.connectors.map((c) => [c.ref, c]))
    for (const w of ctx.hir.wires) {
      const awg = w.gauge !== undefined ? parseAwg(w.gauge) : undefined
      if (awg === undefined) continue
      for (const end of [w.from, w.to]) {
        if (!isPinEndpoint(end)) continue
        const range = byRef.get(end.connector)?.wireGaugeRange
        if (range === undefined) continue
        const thinnest = parseAwg(range.min)
        const thickest = parseAwg(range.max)
        if (thinnest === undefined || thickest === undefined) continue
        // Larger AWG number = thinner wire.
        if (awg > thinnest || awg < thickest) {
          ctx.report({
            severity: Err,
            message: `Wire ${w.id} uses ${w.gauge} but connector ${end.connector} accepts ${range.max} to ${range.min}.`,
            target: refs.pin(end.connector, end.pin)
          })
        }
      }
    }
  },
  { code: "HK-MFG-004" }
)

// --- Electrical sanity ------------------------------------------------------

export const gaugeCurrentMismatch: Rule = rule(
  "gaugeCurrentMismatch",
  (ctx) => {
    for (const w of ctx.hir.wires) {
      if (w.currentEstimate === undefined || w.gauge === undefined) continue
      const awg = parseAwg(w.gauge)
      if (awg === undefined) continue
      const ampacity = AMPACITY_BY_AWG[awg]
      if (ampacity === undefined) continue
      if (w.currentEstimate > ampacity) {
        const required = requiredAwgForCurrent(w.currentEstimate)
        const suffix =
          required !== undefined
            ? ` requires at least ${required}AWG`
            : ` exceeds the ampacity table`
        ctx.report({
          severity: Err,
          message: `Wire ${w.id} uses ${w.gauge} but its ${w.currentEstimate}A estimate${suffix}.`,
          target: refs.wire(w.id)
        })
      }
    }
  },
  { code: "HK-WIRE-004" }
)

export const differentialPairNotTwisted: Rule = rule(
  "differentialPairNotTwisted",
  (ctx) => {
    const bySignal = new Map<string, Array<(typeof ctx.hir.wires)[number]>>()
    for (const w of ctx.hir.wires) {
      if (w.signal === undefined) continue
      const list = bySignal.get(w.signal.toUpperCase()) ?? []
      list.push(w)
      bySignal.set(w.signal.toUpperCase(), list)
    }
    for (const [signal, wires] of [...bySignal.entries()].sort()) {
      const partner = differentialPartner(signal)
      if (partner === undefined || !bySignal.has(partner)) continue
      // Report each pair once, from the lexically smaller signal.
      if (partner < signal) continue
      const partnerWires = bySignal.get(partner) ?? []
      for (const w of wires) {
        const mate = partnerWires.find(
          (p) => p.twistGroup !== undefined && p.twistGroup === w.twistGroup
        )
        if (w.twistGroup === undefined || mate === undefined) {
          ctx.report({
            severity: Err,
            message: `Differential pair ${signal}/${partner} (wire ${w.id}) must share a twist group.`,
            target: refs.wire(w.id)
          })
        }
      }
    }
  },
  { code: "HK-ELEC-001" }
)

export const twistGroupTooSmall: Rule = rule(
  "twistGroupTooSmall",
  (ctx) => {
    const counts = new Map<string, number>()
    for (const w of ctx.hir.wires) {
      if (w.twistGroup === undefined) continue
      counts.set(w.twistGroup, (counts.get(w.twistGroup) ?? 0) + 1)
    }
    for (const [group, count] of [...counts.entries()].sort()) {
      if (count < 2) {
        ctx.report({
          severity: Err,
          message: `Twist group ${group} contains only ${count} wire; twisting requires at least 2.`
        })
      }
    }
  },
  { code: "HK-ELEC-002" }
)

export const missingGroundReturn: Rule = rule(
  "missingGroundReturn",
  (ctx) => {
    const signals = ctx.hir.wires
      .map((w) => w.signal)
      .filter((s): s is string => s !== undefined)
    const power = signals.filter(isPowerSignal)
    const hasGround = signals.some(isGroundSignal)
    if (power.length > 0 && !hasGround) {
      ctx.report({
        severity: Err,
        message: `Power signals (${[...new Set(power)].sort().join(", ")}) have no ground return wire.`
      })
    }
  },
  { code: "HK-ELEC-003" }
)

export const shieldDrainUnconnected: Rule = rule(
  "shieldDrainUnconnected",
  (ctx) => {
    const wired = wiredPins(ctx.hir)
    for (const c of ctx.hir.connectors) {
      for (const p of c.pins) {
        if (p.signal === undefined || !isShieldSignal(p.signal)) continue
        if (!wired.has(`${c.ref}:${p.pin}`)) {
          ctx.report({
            severity: Warn,
            message: `Shield drain pin ${c.ref}.${p.pin} (${p.signal}) has no wire connected.`,
            target: refs.pin(c.ref, p.pin)
          })
        }
      }
    }
  },
  { code: "HK-ELEC-004" }
)

// --- Connectivity -----------------------------------------------------------

export const unconnectedAssignedPin: Rule = rule(
  "unconnectedAssignedPin",
  (ctx) => {
    const wired = wiredPins(ctx.hir)
    for (const c of ctx.hir.connectors) {
      for (const p of c.pins) {
        if (p.signal === undefined) continue
        if (isShieldSignal(p.signal)) continue // covered by shieldDrainUnconnected
        if (!wired.has(`${c.ref}:${p.pin}`)) {
          ctx.report({
            severity: Warn,
            message: `Pin ${c.ref}.${p.pin} is assigned signal ${p.signal} but has no wire connected.`,
            target: refs.pin(c.ref, p.pin)
          })
        }
      }
    }
  },
  { code: "HK-CONN-010" }
)

export const wireSignalMismatch: Rule = rule(
  "wireSignalMismatch",
  (ctx) => {
    const byRef = new Map(ctx.hir.connectors.map((c) => [c.ref, c]))
    for (const w of ctx.hir.wires) {
      if (w.signal === undefined) continue
      for (const end of [w.from, w.to]) {
        if (!isPinEndpoint(end)) continue
        const pinSignal = byRef
          .get(end.connector)
          ?.pins.find((p) => p.pin === end.pin)?.signal
        if (pinSignal !== undefined && pinSignal !== w.signal) {
          ctx.report({
            severity: Err,
            message: `Wire ${w.id} carries ${w.signal} but pin ${end.connector}.${end.pin} is assigned ${pinSignal}.`,
            target: refs.pin(end.connector, end.pin)
          })
        }
      }
    }
  },
  { code: "HK-CONN-011" }
)

// --- Component compatibility (PRD §30) ---------------------------------------

export const terminalIncompatible: Rule = rule(
  "terminalIncompatible",
  (ctx) => {
    for (const c of ctx.hir.connectors) {
      if (c.compatibleTerminals === undefined) continue
      for (const p of c.pins) {
        if (p.terminal !== undefined && !c.compatibleTerminals.includes(p.terminal)) {
          ctx.report({
            severity: Err,
            message: `Pin ${c.ref}.${p.pin} uses terminal ${p.terminal}, which is not compatible with ${c.mpn} (allowed: ${c.compatibleTerminals.join(", ")}).`,
            target: refs.pin(c.ref, p.pin)
          })
        }
      }
    }
  },
  { code: "HK-CONN-012" }
)

export const missingSeal: Rule = rule(
  "missingSeal",
  (ctx) => {
    const wired = wiredPins(ctx.hir)
    for (const c of ctx.hir.connectors) {
      if (c.sealed !== true) continue
      for (const p of c.pins) {
        if (wired.has(`${c.ref}:${p.pin}`) && p.seal === undefined) {
          ctx.report({
            severity: Err,
            message: `Connector ${c.ref} (${c.mpn}) is sealed, but populated pin ${p.pin} has no seal assigned.`,
            target: refs.pin(c.ref, p.pin)
          })
        }
      }
    }
  },
  { code: "HK-CONN-013" }
)

export const sealIncompatible: Rule = rule(
  "sealIncompatible",
  (ctx) => {
    for (const c of ctx.hir.connectors) {
      if (c.compatibleSeals === undefined) continue
      for (const p of c.pins) {
        if (p.seal !== undefined && !c.compatibleSeals.includes(p.seal)) {
          ctx.report({
            severity: Err,
            message: `Pin ${c.ref}.${p.pin} uses seal ${p.seal}, which is not compatible with ${c.mpn} (allowed: ${c.compatibleSeals.join(", ")}).`,
            target: refs.pin(c.ref, p.pin)
          })
        }
      }
    }
  },
  { code: "HK-CONN-014" }
)

/**
 * Org approval gate (PRD §30 acceptance: organizations override approval
 * state without mutating library data). Pass the approved MPN list from
 * org config; anything else in the BOM is flagged.
 */
export const requireApprovedParts = (approvedMpns: ReadonlyArray<string>): Rule => {
  const approved = new Set(approvedMpns)
  return rule(
    "requireApprovedParts",
    (ctx) => {
      for (const item of ctx.hir.bom) {
        if (!approved.has(item.mpn)) {
          ctx.report({
            severity: Warn,
            message: `Part ${item.mpn} (${item.category ?? "part"}) is not on the approved parts list.`,
            target: refs.bom(item.mpn)
          })
        }
      }
    },
    { code: "HK-DOC-004" }
  )
}

/** All built-in rules, in stable order. */

export const voltageRatingBelowSignal: Rule = rule(
  "voltageRatingBelowSignal",
  (ctx) => {
    for (const w of ctx.hir.wires) {
      if (w.voltageRating === undefined || w.signal === undefined) continue
      const nominal = signalNominalVolts(w.signal)
      if (nominal === undefined) continue
      if (w.voltageRating < nominal) {
        ctx.report({
          severity: Err,
          message: `Wire ${w.id} is rated ${w.voltageRating}V but carries ${w.signal} (nominal ${nominal}V).`,
          target: refs.wire(w.id)
        })
      }
    }
  },
  { code: "HK-ELEC-005" }
)

export const reservedPinAssigned: Rule = rule(
  "reservedPinAssigned",
  (ctx) => {
    for (const c of ctx.hir.connectors) {
      if (c.reservedPins === undefined) continue
      const reserved = new Set(c.reservedPins)
      for (const p of c.pins) {
        if (p.signal !== undefined && reserved.has(p.pin)) {
          ctx.report({
            severity: Err,
            message: `Connector ${c.ref} pin ${p.pin} is reserved but carries ${p.signal}.`,
            target: refs.pin(c.ref, p.pin)
          })
        }
      }
    }
  },
  { code: "HK-CONN-015" }
)

export const breakoutTighterThanBendRadius: Rule = rule(
  "breakoutTighterThanBendRadius",
  (ctx) => {
    for (const b of ctx.hir.branches) {
      if (b.minBendRadius === undefined || b.breakoutDistance === undefined) continue
      if (b.breakoutDistance < b.minBendRadius) {
        ctx.report({
          severity: Err,
          message: `Branch ${b.id} breaks out ${b.breakoutDistance}mm from its parent but the bundle needs a ${b.minBendRadius}mm bend radius.`,
          target: refs.branch(b.id)
        })
      }
    }
  },
  { code: "HK-MFG-005" }
)

export const bundleOverSleeveCapacity: Rule = rule(
  "bundleOverSleeveCapacity",
  (ctx) => {
    // Member wires: both endpoints' nodes sit on the branch path (splices
    // count via their branch assignment).
    const spliceBranch = new Map(
      ctx.hir.splices.flatMap((sp) => (sp.branch !== undefined ? [[sp.id, sp.branch] as const] : []))
    )
    for (const b of ctx.hir.branches) {
      if (b.sleeve === undefined) continue
      const capacity = sleeveCapacityMm(b.sleeve)
      if (capacity === undefined) continue
      const onBranch = new Set(b.path)
      const nodeOnBranch = (e: (typeof ctx.hir.wires)[number]["from"]): boolean =>
        "connector" in e ? onBranch.has(e.connector) : spliceBranch.get(e.splice) === b.id || onBranch.has(e.splice)
      const ods: Array<number> = []
      for (const w of ctx.hir.wires) {
        if (!nodeOnBranch(w.from) || !nodeOnBranch(w.to)) continue
        const awg = w.gauge !== undefined ? parseAwg(w.gauge) : undefined
        const od = awg !== undefined ? INSULATED_OD_MM_BY_AWG[awg] : undefined
        if (od !== undefined) ods.push(od)
      }
      if (ods.length === 0) continue
      const estimated = estimateBundleDiameterMm(ods)
      if (estimated > capacity) {
        ctx.report({
          severity: Err,
          message: `Branch ${b.id} bundle is ~${estimated.toFixed(1)}mm across ${ods.length} wires but sleeve ${b.sleeve} takes ${capacity}mm.`,
          target: refs.branch(b.id)
        })
      }
    }
  },
  { code: "HK-MFG-006" }
)

export const builtinRules: ReadonlyArray<Rule> = [
  missingRevision,
  branchMissingLabel,
  spliceMissingNotes,
  missingWireLength,
  missingWireColor,
  missingWireGauge,
  gaugeOutsideConnectorRange,
  gaugeCurrentMismatch,
  differentialPairNotTwisted,
  twistGroupTooSmall,
  missingGroundReturn,
  shieldDrainUnconnected,
  unconnectedAssignedPin,
  wireSignalMismatch,
  terminalIncompatible,
  missingSeal,
  sealIncompatible,
  voltageRatingBelowSignal,
  reservedPinAssigned,
  breakoutTighterThanBendRadius,
  bundleOverSleeveCapacity
]
