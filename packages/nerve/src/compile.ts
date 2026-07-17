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
import { canonicalGauge } from "./gauge.js"
import { endpointLabel, HIR_SCHEMA_VERSION, refs } from "./hir/core.js"
import {
  type Hir,
  type HirBomItem,
  type HirBranch,
  type HirCable,
  type HirConnector,
  type HirEndpoint,
  type HirLabel,
  type HirProtection,
  type HirSplice,
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

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0
const isNonNegativeFinite = (value: number): boolean => Number.isFinite(value) && value >= 0
const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0

/** Numeric conductor labels have one canonical identity (`01` and `1` are
 * the same conductor); non-numeric labels such as `red` remain valid. */
const normalizeConductor = (value: string | number): string | undefined => {
  const raw = String(value).trim()
  if (raw === "") return undefined
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return raw
  const numeric = Number(raw)
  return isPositiveInteger(numeric) ? String(numeric) : undefined
}

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
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    extra?: Pick<Diagnostic, "targets" | "data">
  ) => {
    diagnostics.push({
      code,
      severity,
      message,
      ...(target !== undefined ? { target } : {}),
      ...(extra?.targets !== undefined && extra.targets.length > 0
        ? { targets: extra.targets }
        : {}),
      ...(extra?.data !== undefined ? { data: extra.data } : {})
    })
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
    if (!isPositiveInteger(c.part.pinCount)) {
      report(
        Codes.InvalidConnectorQuantity,
        `Connector ${c.ref} has pinCount ${c.part.pinCount}; pinCount must be a positive integer.`,
        refs.connector(c.ref),
        DiagnosticSeverity.Error,
        { data: { pinCount: c.part.pinCount } }
      )
    }
    if (
      c.part.cavityLayout !== undefined &&
      (!isPositiveInteger(c.part.cavityLayout.rows) ||
        !isPositiveInteger(c.part.cavityLayout.columns))
    ) {
      report(
        Codes.InvalidConnectorQuantity,
        `Connector ${c.ref} has cavity layout ${c.part.cavityLayout.rows}×${c.part.cavityLayout.columns}; rows and columns must be positive integers.`,
        refs.connector(c.ref),
        DiagnosticSeverity.Error,
        { data: { rows: c.part.cavityLayout.rows, columns: c.part.cavityLayout.columns } }
      )
    }
    for (const [field, value] of [
      ["currentLimitA", c.part.currentLimitA],
      ["voltageLimitV", c.part.voltageLimitV]
    ] as const) {
      if (value !== undefined && !isPositiveFinite(value)) {
        report(
          Codes.InvalidConnectorQuantity,
          `Connector ${c.ref} has ${field} ${value}; electrical ratings must be positive finite values.`,
          refs.connector(c.ref),
          DiagnosticSeverity.Error,
          { data: { field, value } }
        )
      }
    }
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
        matingMpn: c.part.matingMpn,
        cavityLayout: c.part.cavityLayout
          ? { rows: c.part.cavityLayout.rows, columns: c.part.cavityLayout.columns }
          : undefined,
        reservedPins: c.part.reservedPins?.map(String),
        sealed: c.part.sealed,
        currentLimitA: c.part.currentLimitA,
        voltageLimitV: c.part.voltageLimitV,
        compatibleTerminals: c.part.compatibleTerminals
          ? [...c.part.compatibleTerminals]
          : undefined,
        compatibleSeals: c.part.compatibleSeals
          ? [...c.part.compatibleSeals]
          : undefined,
        crimpTool: c.part.crimpTool,
        provenance: c.part.provenance ? { ...c.part.provenance } : undefined,
        pins: Object.entries(c.pins)
          .sort(([a], [b]) => comparePins(a, b))
          .map(([pin, signal]) =>
            compact({
              pin,
              signal,
              terminal: c.terminals[pin],
              seal: c.seals[pin]
            })
          )
      })
    )

  const pinExists = (connectorRef: string, pin: string): boolean => {
    const c = connectorByRef.get(connectorRef)
    if (c === undefined) return false
    if (pin in c.pins) return true
    const n = Number(pin)
    return Number.isInteger(n) && n >= 1 && n <= c.part.pinCount
  }

  // Splice IDs must be known before wires can validate endpoints.
  const spliceIds = new Set<string>()
  for (const s of design.splices) {
    if (spliceIds.has(s.id)) {
      report(
        Codes.DuplicateSpliceId,
        `Splice ID ${s.id} is defined more than once.`,
        refs.splice(s.id)
      )
    }
    spliceIds.add(s.id)
  }

  const cableIds = new Set<string>()
  const cableById = new Map<string, (typeof design.cables)[number]>()
  for (const c of design.cables) {
    if (cableIds.has(c.id)) {
      report(
        Codes.DuplicateCableId,
        `Cable ID ${c.id} is defined more than once.`,
        `cable:${c.id}`
      )
    } else cableById.set(c.id, c)
    cableIds.add(c.id)
    if (c.conductors !== undefined && !isPositiveInteger(c.conductors)) {
      report(
        Codes.InvalidCableDefinition,
        `Cable ${c.id} has conductor count ${c.conductors}; conductor count must be a positive integer.`,
        `cable:${c.id}`,
        DiagnosticSeverity.Error,
        { data: { conductors: c.conductors } }
      )
    }
    if (c.outerDiameter !== undefined && !isPositiveFinite(c.outerDiameter)) {
      report(
        Codes.InvalidCableDefinition,
        `Cable ${c.id} has outer diameter ${c.outerDiameter}; outer diameter must be positive and finite.`,
        `cable:${c.id}`,
        DiagnosticSeverity.Error,
        { data: { outerDiameter: c.outerDiameter } }
      )
    }
  }

  const checkEndpoint = (owner: string, end: HirEndpoint) => {
    if (!("connector" in end)) {
      if (!spliceIds.has(end.splice)) {
        report(
          Codes.UndefinedSpliceRef,
          `${owner} references undefined splice ${end.splice}.`,
          refs.splice(end.splice)
        )
      }
      return
    }
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

  const toHirEndpoint = (e: (typeof design.wires)[number]["from"]): HirEndpoint =>
    e.kind === "pin-ref"
      ? { connector: e.connector, pin: e.pin }
      : { splice: e.splice }

  // --- Wires --------------------------------------------------------------
  const wireIds = new Set<string>()
  const wires: Array<HirWire> = []
  const conductorOwners = new Map<string, string>()
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
    const from = toHirEndpoint(w.from)
    const to = toHirEndpoint(w.to)
    checkEndpoint(ownerLabel, from)
    checkEndpoint(ownerLabel, to)
    if (endpointLabel(from) === endpointLabel(to)) {
      report(
        Codes.WireEndpointsIdentical,
        `Wire ${w.id} starts and ends on the same endpoint ${endpointLabel(from)}.`,
        refs.wire(w.id)
      )
    }
    if (w.cable !== undefined && !cableIds.has(w.cable)) {
      report(
        Codes.UndefinedCableRef,
        `Wire ${w.id} references undefined cable ${w.cable}.`,
        refs.wire(w.id)
      )
    }

    if (w.lengthTolerance !== undefined) {
      const toleranceValid = isNonNegativeFinite(w.lengthTolerance)
      const belowLength =
        w.length === undefined || !isPositiveFinite(w.length) || w.lengthTolerance < w.length
      if (!toleranceValid || !belowLength) {
        report(
          Codes.InvalidWireQuantity,
          `Wire ${w.id} has length tolerance ${w.lengthTolerance}; tolerance must be non-negative, finite, and smaller than its positive length${w.length !== undefined ? ` (${w.length})` : ""}.`,
          refs.wire(w.id),
          DiagnosticSeverity.Error,
          {
            data: {
              lengthTolerance: w.lengthTolerance,
              ...(w.length !== undefined ? { length: w.length } : {})
            }
          }
        )
      }
    }
    for (const [field, value, valid] of [
      ["voltageRating", w.voltageRating, w.voltageRating === undefined || isPositiveFinite(w.voltageRating)],
      ["currentEstimate", w.currentEstimate, w.currentEstimate === undefined || isNonNegativeFinite(w.currentEstimate)],
      ["temperatureRating", w.temperatureRating, w.temperatureRating === undefined || Number.isFinite(w.temperatureRating)]
    ] as const) {
      if (!valid && value !== undefined) {
        report(
          Codes.InvalidWireQuantity,
          `Wire ${w.id} has invalid ${field} ${value}.`,
          refs.wire(w.id),
          DiagnosticSeverity.Error,
          { data: { field, value } }
        )
      }
    }

    const conductor =
      w.conductor !== undefined ? normalizeConductor(w.conductor) : undefined
    if (w.conductor !== undefined && conductor === undefined) {
      report(
        Codes.InvalidCableConductor,
        `Wire ${w.id} has invalid conductor identifier "${String(w.conductor)}"; use a positive integer or a non-empty name.`,
        refs.wire(w.id)
      )
    }
    if (w.conductor !== undefined && w.cable === undefined) {
      report(
        Codes.InvalidCableConductor,
        `Wire ${w.id} declares conductor ${String(w.conductor)} without declaring a cable.`,
        refs.wire(w.id)
      )
    }
    if (w.cable !== undefined && conductor !== undefined) {
      const cable = cableById.get(w.cable)
      const numeric = /^\d+$/.test(conductor) ? Number(conductor) : undefined
      if (numeric !== undefined && cable?.conductors !== undefined && numeric > cable.conductors) {
        report(
          Codes.InvalidCableConductor,
          `Wire ${w.id} uses conductor ${conductor} of cable ${w.cable}, but that cable has only ${cable.conductors} conductors.`,
          refs.wire(w.id),
          DiagnosticSeverity.Error,
          { data: { cable: w.cable, conductor, conductors: cable.conductors } }
        )
      }
      const key = `${w.cable}\u0000${conductor}`
      const previous = conductorOwners.get(key)
      if (previous !== undefined) {
        report(
          Codes.DuplicateCableConductor,
          `Wires ${previous} and ${w.id} both claim conductor ${conductor} of cable ${w.cable}.`,
          refs.wire(w.id),
          DiagnosticSeverity.Error,
          {
            targets: [refs.wire(previous)],
            data: { cable: w.cable, conductor, firstWire: previous }
          }
        )
      } else conductorOwners.set(key, w.id)
    }

    wires.push(
      compact({
        id: w.id,
        from,
        to,
        // "awg 20" / "20 AWG" / "20" all compile to "20AWG" so gauge-based
        // rules and exporters see one spelling (HK-MFG-007 flags the rest).
        gauge: w.gauge !== undefined ? canonicalGauge(w.gauge) : undefined,
        color: w.color,
        stripe: w.stripe,
        length: w.length,
        lengthTolerance: w.lengthTolerance,
        signal: w.signal,
        insulation: w.insulation,
        voltageRating: w.voltageRating,
        temperatureRating: w.temperatureRating,
        currentEstimate: w.currentEstimate,
        emcClass: w.emcClass,
        twistGroup: w.twistGroup,
        shieldGroup: w.shieldGroup,
        cable: w.cable,
        conductor,
        notes: w.notes
      })
    )
  }
  wires.sort((a, b) => compareStrings(a.id, b.id))

  // --- Splices --------------------------------------------------------------
  const spliceWires = (id: string): Array<string> =>
    wires
      .filter(
        (w) =>
          (!("connector" in w.from) && w.from.splice === id) ||
          (!("connector" in w.to) && w.to.splice === id)
      )
      .map((w) => w.id)

  const designBranchIds = new Set(design.branches.map((b) => b.id))
  const seenSplices = new Set<string>()
  const splices: Array<HirSplice> = []
  for (const s of design.splices) {
    if (seenSplices.has(s.id)) continue // duplicate already reported
    seenSplices.add(s.id)
    if (s.branch !== undefined && !designBranchIds.has(s.branch)) {
      report(
        Codes.SpliceUndefinedBranch,
        `Splice ${s.id} is located on undefined branch ${s.branch}.`,
        refs.splice(s.id)
      )
    }
    if (s.location !== undefined && !isNonNegativeFinite(s.location)) {
      report(
        Codes.InvalidSpliceLocation,
        `Splice ${s.id} has location ${s.location}; splice location must be non-negative and finite.`,
        refs.splice(s.id),
        DiagnosticSeverity.Error,
        { data: { location: s.location } }
      )
    }
    const attached = spliceWires(s.id)
    if (attached.length < 2) {
      report(
        Codes.SpliceTooFewWires,
        `Splice ${s.id} joins ${attached.length} wire(s); a splice needs at least 2.`,
        refs.splice(s.id),
        DiagnosticSeverity.Error,
        { targets: attached.map(refs.wire), data: { attachedWires: attached.length } }
      )
    }
    splices.push(
      compact({
        id: s.id,
        type: s.type,
        part: s.part,
        branch: s.branch,
        location: s.location,
        notes: s.notes,
        wires: attached
      })
    )
  }
  splices.sort((a, b) => compareStrings(a.id, b.id))

  // --- Cables ---------------------------------------------------------------
  const seenCables = new Set<string>()
  const cables: Array<HirCable> = []
  for (const c of design.cables) {
    if (seenCables.has(c.id)) continue
    seenCables.add(c.id)
    const members = wires.filter((w) => w.cable === c.id)
    const lengths = members
      .map((w) => w.length)
      .filter((l): l is number => l !== undefined)
    cables.push(
      compact({
        id: c.id,
        type: c.type,
        conductors: c.conductors,
        shield: c.shield,
        jacket: c.jacket,
        outerDiameter: c.outerDiameter,
        cutLength: lengths.length > 0 ? Math.max(...lengths) : undefined,
        notes: c.notes,
        wires: members.map((w) => w.id)
      })
    )
  }
  cables.sort((a, b) => compareStrings(a.id, b.id))

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

    for (const [field, value, valid] of [
      ["nominalLength", b.nominalLength, b.nominalLength === undefined || isPositiveFinite(b.nominalLength)],
      ["breakoutDistance", b.breakoutDistance, b.breakoutDistance === undefined || isNonNegativeFinite(b.breakoutDistance)],
      ["minBendRadius", b.minBendRadius, b.minBendRadius === undefined || isPositiveFinite(b.minBendRadius)],
      ["ambientTemperatureC", b.ambientTemperatureC, b.ambientTemperatureC === undefined || Number.isFinite(b.ambientTemperatureC)]
    ] as const) {
      if (!valid && value !== undefined) {
        report(
          Codes.InvalidBranchGeometry,
          `Branch ${b.id} has invalid ${field} ${value}.`,
          refs.branch(b.id),
          DiagnosticSeverity.Error,
          { data: { field, value } }
        )
      }
    }

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
        breakoutDistance: b.breakoutDistance,
        minBendRadius: b.minBendRadius,
        ambientTemperatureC: b.ambientTemperatureC
      })
    )
  }
  branches.sort((a, b) => compareStrings(a.id, b.id))

  // --- Protections --------------------------------------------------------
  const protectionIds = new Set<string>()
  const protections: Array<HirProtection> = []
  for (const p of design.protections) {
    if (protectionIds.has(p.id)) {
      report(
        Codes.DuplicateProtectionId,
        `Protection ID ${p.id} is defined more than once.`,
        `protection:${p.id}`
      )
      continue
    }
    protectionIds.add(p.id)
    if (!isPositiveFinite(p.ratingA)) {
      report(
        Codes.InvalidProtectionRating,
        `${p.kind} ${p.id} has rating ${p.ratingA}A; protection ratings must be positive and finite.`,
        `protection:${p.id}`,
        DiagnosticSeverity.Error,
        { data: { ratingA: p.ratingA } }
      )
    }
    for (const wireId of p.protects) {
      if (!wireIds.has(wireId)) {
        report(
          Codes.ProtectionUndefinedWire,
          `Protection ${p.id} guards undefined wire ${wireId}.`,
          `protection:${p.id}`
        )
      }
    }
    protections.push(
      compact({
        id: p.id,
        kind: p.kind,
        ratingA: p.ratingA,
        protects: [...p.protects].sort(compareStrings),
        notes: p.notes
      })
    )
  }
  protections.sort((a, b) => compareStrings(a.id, b.id))

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

    if (l.distance !== undefined && !isNonNegativeFinite(l.distance)) {
      report(
        Codes.InvalidLabelQuantity,
        `Label ${l.id} has distance ${l.distance}; placement distance must be non-negative and finite.`,
        refs.label(l.id),
        DiagnosticSeverity.Error,
        { data: { distance: l.distance } }
      )
    }
    if (l.quantity !== undefined && !isPositiveInteger(l.quantity)) {
      report(
        Codes.InvalidLabelQuantity,
        `Label ${l.id} has quantity ${l.quantity}; label quantity must be a positive integer.`,
        refs.label(l.id),
        DiagnosticSeverity.Error,
        { data: { quantity: l.quantity } }
      )
    }

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

  // --- BOM (connector housings + terminals + seals; wire rollups in CSVs) ---
  const bomByMpn = new Map<
    string,
    { item: Omit<HirBomItem, "usedBy" | "quantity">; usedBy: Array<string>; qty: number }
  >()
  const bomAdd = (
    mpn: string,
    category: string,
    usedBy: string,
    extra: Partial<Omit<HirBomItem, "usedBy" | "quantity" | "mpn">> = {}
  ): void => {
    const existing = bomByMpn.get(mpn)
    if (existing) {
      existing.qty += 1
      existing.usedBy.push(usedBy)
    } else {
      bomByMpn.set(mpn, {
        item: compact({ mpn, category, unitOfMeasure: "ea", ...extra }) as Omit<
          HirBomItem,
          "usedBy" | "quantity"
        >,
        usedBy: [usedBy],
        qty: 1
      })
    }
  }
  for (const c of [...connectorByRef.values()].sort((a, b) => compareStrings(a.ref, b.ref))) {
    bomAdd(c.part.mpn, "connector", refs.connector(c.ref), {
      manufacturer: c.part.manufacturer,
      description: c.part.description
    })
    for (const [pin, terminal] of Object.entries(c.terminals).sort(([a], [b]) =>
      comparePins(a, b)
    )) {
      bomAdd(terminal, "terminal", refs.pin(c.ref, pin))
    }
    for (const [pin, seal] of Object.entries(c.seals).sort(([a], [b]) =>
      comparePins(a, b)
    )) {
      bomAdd(seal, "seal", refs.pin(c.ref, pin))
    }
  }
  for (const s of splices) {
    if (s.part !== undefined) bomAdd(s.part, "splice", refs.splice(s.id))
  }
  const bom: Array<HirBomItem> = [...bomByMpn.values()]
    .map(({ item, usedBy, qty }) => ({ ...item, quantity: qty, usedBy }))
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
    cables,
    branches,
    splices,
    labels,
    bom,
    // Omitted when empty so existing golden HIR stays byte-identical.
    ...(protections.length > 0 ? { protections } : {}),
    diagnostics,
    layoutHints: [],
    exports: {}
  }

  return { hir, diagnostics }
}
