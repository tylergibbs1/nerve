/**
 * Design → HIR normalization (PRD §9.3).
 *
 * `compileDesign` is a pure, deterministic function: given the same
 * `HarnessDesign`, it produces a byte-identical HIR regardless of the order
 * in which connectors, wires, branches, or labels were authored. All
 * collections are canonically sorted and optional fields are omitted (never
 * `undefined`) so serialized output is stable and diffable.
 *
 * Structural integrity checks run here because a broken object graph makes
 * downstream rules meaningless. Domain rules (gauge vs current, twisted
 * pairs, seals, ...) belong to `@grayhaven/nerve-rules`.
 */
import type { HarnessDesign } from "./domain.js"
import { Codes, DiagnosticSeverity, type Diagnostic } from "./diagnostics.js"
import {
  HIR_SCHEMA_VERSION,
  refs,
  type Hir,
  type HirBomItem,
  type HirBranch,
  type HirConnector,
  type HirLabel,
  type HirWire
} from "./hir/schema.js"

export interface CompileResult {
  readonly hir: Hir
  readonly diagnostics: ReadonlyArray<Diagnostic>
}

/** Numeric-aware comparison so pin "10" sorts after pin "2". */
const comparePins = (a: string, b: string): number => {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return a < b ? -1 : a > b ? 1 : 0
}

const compareStrings = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

/** Strip `undefined` values so optional fields are absent in serialized HIR. */
const compact = <T extends Record<string, unknown>>(obj: T): T => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value
  }
  return out as T
}

export const compileDesign = (design: HarnessDesign): CompileResult => {
  const diagnostics: Array<Diagnostic> = []
  const report = (
    code: string,
    message: string,
    target?: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
  ) => {
    diagnostics.push(
      target !== undefined
        ? { code, severity, message, target }
        : { code, severity, message }
    )
  }

  // --- Connectors ---------------------------------------------------------
  const connectorByRef = new Map<string, (typeof design.connectors)[number]>()
  for (const c of design.connectors) {
    if (connectorByRef.has(c.ref)) {
      report(
        Codes.DuplicateConnectorRef,
        `Connector reference ${c.ref} is defined more than once.`,
        refs.connector(c.ref)
      )
      continue
    }
    connectorByRef.set(c.ref, c)
  }

  const connectors: Array<HirConnector> = [...connectorByRef.values()]
    .sort((a, b) => compareStrings(a.ref, b.ref))
    .map((c) =>
      compact({
        ref: c.ref,
        mpn: c.part.mpn,
        manufacturer: c.part.manufacturer,
        family: c.part.family,
        description: c.part.description,
        gender: c.part.gender,
        pinCount: c.part.pinCount,
        wireGaugeRange: c.part.wireGaugeRange
          ? { min: c.part.wireGaugeRange.min, max: c.part.wireGaugeRange.max }
          : undefined,
        pins: Object.entries(c.pins)
          .sort(([a], [b]) => comparePins(a, b))
          .map(([pin, signal]) => compact({ pin, signal }))
      })
    )

  const pinExists = (connectorRef: string, pin: string): boolean => {
    const c = connectorByRef.get(connectorRef)
    if (c === undefined) return false
    if (pin in c.pins) return true
    const n = Number(pin)
    return Number.isInteger(n) && n >= 1 && n <= c.part.pinCount
  }

  const checkEndpoint = (owner: string, end: { connector: string; pin: string }) => {
    if (!connectorByRef.has(end.connector)) {
      report(
        Codes.UndefinedConnectorRef,
        `${owner} references undefined connector ${end.connector}.`,
        refs.connector(end.connector)
      )
    } else if (!pinExists(end.connector, end.pin)) {
      report(
        Codes.UndefinedPinRef,
        `${owner} references pin ${end.pin} which does not exist on connector ${end.connector}.`,
        refs.pin(end.connector, end.pin)
      )
    }
  }

  // --- Wires --------------------------------------------------------------
  const wireIds = new Set<string>()
  const wires: Array<HirWire> = []
  for (const w of design.wires) {
    if (wireIds.has(w.id)) {
      report(
        Codes.DuplicateWireId,
        `Wire ID ${w.id} is defined more than once.`,
        refs.wire(w.id)
      )
      continue
    }
    wireIds.add(w.id)

    const ownerLabel = `Wire ${w.id}`
    checkEndpoint(ownerLabel, w.from)
    checkEndpoint(ownerLabel, w.to)
    if (w.from.connector === w.to.connector && w.from.pin === w.to.pin) {
      report(
        Codes.WireEndpointsIdentical,
        `Wire ${w.id} starts and ends on the same pin ${w.from.connector}.${w.from.pin}.`,
        refs.wire(w.id)
      )
    }

    wires.push(
      compact({
        id: w.id,
        from: { connector: w.from.connector, pin: w.from.pin },
        to: { connector: w.to.connector, pin: w.to.pin },
        gauge: w.gauge,
        color: w.color,
        stripe: w.stripe,
        length: w.length,
        lengthTolerance: w.lengthTolerance,
        signal: w.signal,
        insulation: w.insulation,
        voltageRating: w.voltageRating,
        temperatureRating: w.temperatureRating,
        currentEstimate: w.currentEstimate,
        twistGroup: w.twistGroup,
        shieldGroup: w.shieldGroup,
        notes: w.notes
      })
    )
  }
  wires.sort((a, b) => compareStrings(a.id, b.id))

  // --- Branches -----------------------------------------------------------
  const branchIds = new Set<string>()
  const branches: Array<HirBranch> = []
  for (const b of design.branches) {
    if (branchIds.has(b.id)) {
      report(
        Codes.DuplicateBranchId,
        `Branch ID ${b.id} is defined more than once.`,
        refs.branch(b.id)
      )
      continue
    }
    branchIds.add(b.id)

    for (const endpoint of b.path) {
      if (!connectorByRef.has(endpoint)) {
        report(
          Codes.BranchUndefinedEndpoint,
          `Branch ${b.id} path references undefined connector ${endpoint}.`,
          refs.branch(b.id)
        )
      }
    }

    branches.push(
      compact({
        id: b.id,
        path: [...b.path],
        parent: b.parent,
        sleeve: b.sleeve,
        nominalLength: b.nominalLength,
        breakoutDistance: b.breakoutDistance
      })
    )
  }
  branches.sort((a, b) => compareStrings(a.id, b.id))

  // --- Labels ---------------------------------------------------------------
  const labelIds = new Set<string>()
  const labels: Array<HirLabel> = []
  for (const l of design.labels) {
    if (labelIds.has(l.id)) {
      report(
        Codes.DuplicateLabelId,
        `Label ID ${l.id} is defined more than once.`,
        refs.label(l.id)
      )
      continue
    }
    labelIds.add(l.id)

    if (!branchIds.has(l.attachTo) && !connectorByRef.has(l.attachTo)) {
      report(
        Codes.LabelUndefinedTarget,
        `Label ${l.id} attaches to ${l.attachTo}, which is not a defined branch or connector.`,
        refs.label(l.id)
      )
    }
    if (l.offsetFrom !== undefined && !connectorByRef.has(l.offsetFrom)) {
      report(
        Codes.LabelUndefinedTarget,
        `Label ${l.id} is offset from ${l.offsetFrom}, which is not a defined connector.`,
        refs.label(l.id)
      )
    }

    labels.push(
      compact({
        id: l.id,
        text: l.text,
        attachTo: l.attachTo,
        offsetFrom: l.offsetFrom,
        distance: l.distance,
        material: l.material,
        quantity: l.quantity
      })
    )
  }
  labels.sort((a, b) => compareStrings(a.id, b.id))

  // --- BOM (connector housings; wire/terminal rollups arrive in M2) --------
  const bomByMpn = new Map<string, { item: Omit<HirBomItem, "usedBy">; usedBy: Array<string> }>()
  for (const c of [...connectorByRef.values()].sort((a, b) => compareStrings(a.ref, b.ref))) {
    const existing = bomByMpn.get(c.part.mpn)
    if (existing) {
      existing.usedBy.push(refs.connector(c.ref))
    } else {
      bomByMpn.set(c.part.mpn, {
        item: compact({
          mpn: c.part.mpn,
          manufacturer: c.part.manufacturer,
          description: c.part.description,
          category: "connector",
          quantity: 0,
          unitOfMeasure: "ea"
        }),
        usedBy: [refs.connector(c.ref)]
      })
    }
  }
  const bom: Array<HirBomItem> = [...bomByMpn.values()]
    .map(({ item, usedBy }) => ({ ...item, quantity: usedBy.length, usedBy }))
    .sort((a, b) => compareStrings(a.mpn, b.mpn))

  // --- Diagnostics (canonical order) ----------------------------------------
  diagnostics.sort(
    (a, b) =>
      compareStrings(a.target ?? "", b.target ?? "") ||
      compareStrings(a.code, b.code) ||
      compareStrings(a.message, b.message)
  )

  const hir: Hir = {
    schemaVersion: HIR_SCHEMA_VERSION,
    harness: {
      id: design.id,
      revision: design.revision,
      units: design.units,
      metadata: design.metadata
    },
    connectors,
    wires,
    cables: [],
    branches,
    splices: [],
    labels,
    bom,
    diagnostics,
    layoutHints: [],
    exports: {}
  }

  return { hir, diagnostics }
}
