/**
 * WireViz YAML → HarnessDesign (PRD §27.2).
 *
 * Imports the useful subset: connectors (type, subtype, pincount,
 * pinlabels), cables (gauge, length, wirecount, colors, color_code,
 * wirelabels, shield), named template instances, and connections
 * (alternating connector/cable chains with pin lists, semantic labels, or
 * ranges). Anything WireViz expresses that HIR cannot map cleanly produces
 * an actionable diagnostic instead of silent loss.
 */
import { parse } from "yaml"
import {
  cable,
  canonicalGauge,
  connector,
  harness,
  wire,
  DiagnosticSeverity,
  type CableDef,
  type ConnectorInstance,
  type Diagnostic,
  type HarnessDesign,
  type WireDef
} from "@grayhaven/nerve"
import { COLOR_CODES, colorFromWireViz } from "./colors.js"

export interface ImportOptions {
  readonly harnessId?: string
  readonly revision?: string
  /** WireViz YAML prepended before the main document (equivalent to --prepend-file). */
  readonly prependYaml?: ReadonlyArray<string>
}

export interface ImportResult {
  readonly design: HarnessDesign
  readonly diagnostics: ReadonlyArray<Diagnostic>
}

const SUPPORTED_CONNECTOR_KEYS = new Set([
  "type",
  "subtype",
  "pincount",
  "pins",
  "pinlabels",
  "pn",
  "manufacturer",
  "mpn",
  "notes"
])
const SUPPORTED_CABLE_KEYS = new Set([
  "gauge",
  "length",
  "wirecount",
  "colors",
  "color_code",
  "wirelabels",
  "shield",
  "category",
  "notes"
])

/** "1-4" → [1,2,3,4]; "4-1" → [4,3,2,1]; 3 → [3]. */
const expandPins = (spec: unknown): Array<string> => {
  const expandOne = (v: unknown): Array<string> => {
    if (typeof v === "number") return [String(v)]
    if (typeof v === "string") {
      const range = /^(\d+)\s*-\s*(\d+)$/.exec(v.trim())
      if (range !== null) {
        const lo = Number(range[1])
        const hi = Number(range[2])
        const out: Array<string> = []
        const step = lo <= hi ? 1 : -1
        for (let i = lo; step > 0 ? i <= hi : i >= hi; i += step) out.push(String(i))
        return out
      }
      return [v.trim()]
    }
    return []
  }
  return Array.isArray(spec) ? spec.flatMap(expandOne) : expandOne(spec)
}

const normalizeGauge = (gauge: unknown): string | undefined => {
  if (gauge === undefined || gauge === null) return undefined
  const s = String(gauge).trim()
  // WireViz convention (syntax.md): a unitless gauge number is mm², NOT
  // AWG. Tag it so canonicalGauge/parseAwg never misread "16" (16mm² ≈
  // 5AWG) as 16AWG. Explicit AWG spellings canonicalize as everywhere else.
  if (/awg/i.test(s)) return canonicalGauge(s)
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}mm2`
  return s
}

const LENGTH_UNIT_TO_MM: Readonly<Record<string, number>> = {
  "": 1000,
  m: 1000,
  meter: 1000,
  meters: 1000,
  metre: 1000,
  metres: 1000,
  cm: 10,
  centimeter: 10,
  centimeters: 10,
  centimetre: 10,
  centimetres: 10,
  mm: 1,
  millimeter: 1,
  millimeters: 1,
  millimetre: 1,
  millimetres: 1,
  in: 25.4,
  inch: 25.4,
  inches: 25.4,
  '"': 25.4,
  ft: 304.8,
  foot: 304.8,
  feet: 304.8,
  "'": 304.8
}

/** WireViz assumes numeric lengths are metres; unit-bearing strings retain their unit. */
const normalizeLengthMm = (length: unknown): number | undefined => {
  if (typeof length === "number" && Number.isFinite(length)) return Math.round(length * 1000)
  if (typeof length !== "string") return undefined
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-zA-Z"']*)$/.exec(length.trim())
  if (match === null) return undefined
  const value = Number(match[1])
  const factor = LENGTH_UNIT_TO_MM[match[2]!.toLowerCase()]
  return Number.isFinite(value) && factor !== undefined ? Math.round(value * factor) : undefined
}

const addReference = (
  references: Map<string, Array<string>>,
  reference: unknown,
  value: string
): void => {
  if (reference === undefined || reference === null) return
  const key = String(reference).trim()
  if (key === "") return
  const values = references.get(key) ?? []
  if (!values.includes(value)) values.push(value)
  references.set(key, values)
}

const splitGeneratedName = (
  name: string,
  separator: string
): { readonly template: string; readonly instance: string } | undefined => {
  const at = name.indexOf(separator)
  if (at <= 0) return undefined
  return {
    template: name.slice(0, at),
    instance: name.slice(at + separator.length)
  }
}

export const importWireViz = (
  yamlText: string,
  options: ImportOptions = {}
): ImportResult => {
  const source = [...(options.prependYaml ?? []), yamlText].join("\n")
  const doc = parse(source, { merge: true }) as Record<string, unknown> | null
  const diagnostics: Array<Diagnostic> = []
  const report = (
    severity: DiagnosticSeverity,
    message: string,
    target?: string
  ) => {
    diagnostics.push({
      code: "HK-WV-001",
      severity,
      message,
      ...(target !== undefined ? { target } : {})
    })
  }
  const warn = (message: string, target?: string) =>
    report(DiagnosticSeverity.Warning, message, target)
  const error = (message: string, target?: string) =>
    report(DiagnosticSeverity.Error, message, target)

  const connectorsIn = (doc?.["connectors"] ?? {}) as Record<string, Record<string, unknown>>
  const cablesIn = (doc?.["cables"] ?? {}) as Record<string, Record<string, unknown>>
  const connectionsIn = (doc?.["connections"] ?? []) as Array<Array<unknown>>

  const optionsIn = (doc?.["options"] ?? {}) as Record<string, unknown>
  const configuredSeparator = optionsIn["template_separator"]
  const hasConfiguredSeparator =
    typeof configuredSeparator === "string" && configuredSeparator.length > 0
  const templateSeparator =
    typeof configuredSeparator === "string" && configuredSeparator.length > 0
      ? configuredSeparator
      : "."
  if (configuredSeparator !== undefined && !hasConfiguredSeparator) {
    warn(`WireViz option "template_separator" must be a non-empty string; using ".".`)
  }
  const unsupportedOptions = Object.keys(optionsIn).filter((key) => key !== "template_separator")
  if (unsupportedOptions.length > 0) {
    warn(`WireViz options ${unsupportedOptions.map((key) => `"${key}"`).join(", ")} are not imported.`)
  }

  for (const section of ["tweak", "additional_bom_items"]) {
    if (doc?.[section] !== undefined) {
      warn(`WireViz section "${section}" is not imported.`)
    }
  }

  const metadataIn = (doc?.["metadata"] ?? {}) as Record<string, unknown>
  const importedMetadata: Record<string, string> = { importedFrom: "wireviz" }
  if (typeof metadataIn["title"] === "string") importedMetadata["sourceTitle"] = metadataIn["title"]
  if (typeof metadataIn["pn"] === "string") importedMetadata["sourcePartNumber"] = metadataIn["pn"]
  for (const key of Object.keys(metadataIn)) {
    if (key !== "title" && key !== "pn") warn(`WireViz metadata key "${key}" is not imported.`)
  }

  // --- Connectors -----------------------------------------------------------
  const connectors: Array<ConnectorInstance> = []
  const connectorByRef = new Map<string, ConnectorInstance>()
  const connectorPins = new Map<string, ReadonlySet<string>>()
  const connectorPinsByLabel = new Map<string, Map<string, Array<string>>>()
  for (const [ref, def] of Object.entries(connectorsIn)) {
    for (const key of Object.keys(def)) {
      if (!SUPPORTED_CONNECTOR_KEYS.has(key)) {
        warn(`Connector ${ref}: WireViz key "${key}" is not imported.`, `connector:${ref}`)
      }
    }
    const pinlabels = Array.isArray(def["pinlabels"]) ? (def["pinlabels"] as Array<unknown>) : []
    const pinIds = Array.isArray(def["pins"])
      ? (def["pins"] as Array<unknown>).map(String)
      : []
    const pincount =
      typeof def["pincount"] === "number"
        ? def["pincount"]
        : Math.max(pinlabels.length, pinIds.length)
    const subtype = typeof def["subtype"] === "string" ? def["subtype"].toLowerCase() : undefined
    const pins: Record<string, string> = {}
    const pinsByLabel = new Map<string, Array<string>>()
    pinlabels.forEach((label, i) => {
      if (label !== null && label !== undefined) {
        const pin = pinIds[i] ?? String(i + 1)
        pins[pin] = String(label)
        addReference(pinsByLabel, label, pin)
      }
    })
    const instance = connector(
      ref,
      {
        mpn: String(def["mpn"] ?? def["pn"] ?? def["type"] ?? ref),
        ...(typeof def["manufacturer"] === "string"
          ? { manufacturer: def["manufacturer"] }
          : {}),
        ...(typeof def["type"] === "string" ? { family: def["type"] } : {}),
        ...(subtype === "female"
          ? { gender: "receptacle" as const }
          : subtype === "male"
            ? { gender: "plug" as const }
            : {}),
        pinCount: Math.max(pincount, 1)
      },
      { pins }
    )
    connectors.push(instance)
    connectorByRef.set(ref, instance)
    connectorPins.set(
      ref,
      new Set(
        pinIds.length > 0
          ? pinIds
          : Array.from({ length: Math.max(pincount, 1) }, (_, index) => String(index + 1))
      )
    )
    connectorPinsByLabel.set(ref, pinsByLabel)
  }

  // --- Cables ---------------------------------------------------------------
  interface CableInfo {
    readonly def: CableDef
    readonly gauge: string | undefined
    readonly lengthMm: number | undefined
    readonly colors: ReadonlyArray<string>
    readonly conductorReferences: ReadonlyMap<string, ReadonlyArray<string>>
    readonly isBundle: boolean
  }
  const cables: Array<CableDef> = []
  const cableInfo = new Map<string, CableInfo>()
  for (const [id, def] of Object.entries(cablesIn)) {
    for (const key of Object.keys(def)) {
      if (!SUPPORTED_CABLE_KEYS.has(key)) {
        warn(`Cable ${id}: WireViz key "${key}" is not imported.`, `cable:${id}`)
      }
    }
    const wirecount =
      typeof def["wirecount"] === "number"
        ? def["wirecount"]
        : Array.isArray(def["colors"])
          ? (def["colors"] as Array<unknown>).length
          : undefined
    let colorTokens = Array.isArray(def["colors"])
      ? (def["colors"] as Array<unknown>).map(String)
      : []
    let colors = colorTokens.map(colorFromWireViz)
    const colorCode = typeof def["color_code"] === "string" ? def["color_code"].toUpperCase() : undefined
    if (colors.length === 0 && colorCode !== undefined) {
      const cycle = COLOR_CODES[colorCode]
      if (cycle !== undefined && wirecount !== undefined) {
        colorTokens = Array.from({ length: wirecount }, (_, i) => cycle[i % cycle.length]!)
        colors = colorTokens.map(colorFromWireViz)
      } else {
        warn(`Cable ${id}: color_code "${colorCode}" is not supported; colors omitted.`, `cable:${id}`)
      }
    }
    const isBundle = def["category"] === "bundle"
    const lengthMm = normalizeLengthMm(def["length"])
    if (def["length"] !== undefined && lengthMm === undefined) {
      warn(`Cable ${id}: length "${String(def["length"])}" cannot be converted to millimetres.`, `cable:${id}`)
    }
    const cableDef = cable(id, {
      ...(typeof def["gauge"] === "string" || typeof def["gauge"] === "number"
        ? { type: `${wirecount ?? "?"}x${String(def["gauge"])}` }
        : {}),
      ...(wirecount !== undefined ? { conductors: wirecount } : {}),
      ...(def["shield"] === true || typeof def["shield"] === "string"
        ? { shield: typeof def["shield"] === "string" ? def["shield"] : "shield" }
        : {}),
      ...(typeof def["notes"] === "string" ? { notes: def["notes"] } : {})
    })
    const conductorReferences = new Map<string, Array<string>>()
    const wirelabels = Array.isArray(def["wirelabels"])
      ? (def["wirelabels"] as Array<unknown>)
      : []
    const referenceCount = Math.max(wirecount ?? 0, colorTokens.length, wirelabels.length)
    for (let index = 0; index < referenceCount; index++) {
      const conductor = String(index + 1)
      addReference(conductorReferences, conductor, conductor)
      addReference(conductorReferences, wirelabels[index], conductor)
      addReference(conductorReferences, colorTokens[index], conductor)
      addReference(conductorReferences, colors[index], conductor)
    }
    if (!isBundle) cables.push(cableDef)
    cableInfo.set(id, {
      def: cableDef,
      gauge: normalizeGauge(def["gauge"]),
      lengthMm,
      colors,
      conductorReferences,
      isBundle
    })
  }

  const sourceConnectorRefs = new Set(Object.keys(connectorsIn))
  const sourceCableIds = new Set(Object.keys(cablesIn))
  const directlyUsedConnectors = new Set<string>()
  const directlyUsedCables = new Set<string>()
  const usedConnectorTemplates = new Set<string>()
  const usedCableTemplates = new Set<string>()
  const generatedConnectorOrigins = new Map<string, string>()
  const generatedCableOrigins = new Map<string, string>()

  const resolveConnector = (name: string, row: number): ConnectorInstance | undefined => {
    const exact = connectorByRef.get(name)
    if (exact !== undefined) {
      if (sourceConnectorRefs.has(name)) directlyUsedConnectors.add(name)
      return exact
    }

    const generated = splitGeneratedName(name, templateSeparator)
    if (generated === undefined) return undefined
    if (generated.instance === "") {
      error(
        `Connection row ${row}: unnamed connector autogeneration "${name}" is not representable; assign an explicit designator.`,
        `connector:${generated.template}`
      )
      return undefined
    }
    const template = connectorByRef.get(generated.template)
    if (template === undefined || !sourceConnectorRefs.has(generated.template)) return undefined

    const occupied = connectorByRef.get(generated.instance)
    if (occupied !== undefined) {
      if (generatedConnectorOrigins.get(generated.instance) === generated.template) return occupied
      error(
        `Connection row ${row}: connector designator ${generated.instance} already exists; cannot instantiate template ${generated.template}.`,
        `connector:${generated.instance}`
      )
      return undefined
    }

    const instance = connector(generated.instance, template.part, {
      pins: template.pins,
      terminals: template.terminals,
      seals: template.seals
    })
    connectors.push(instance)
    connectorByRef.set(generated.instance, instance)
    connectorPins.set(generated.instance, connectorPins.get(generated.template) ?? new Set())
    connectorPinsByLabel.set(
      generated.instance,
      connectorPinsByLabel.get(generated.template) ?? new Map()
    )
    usedConnectorTemplates.add(generated.template)
    generatedConnectorOrigins.set(generated.instance, generated.template)
    return instance
  }

  const resolveCable = (name: string, row: number): CableInfo | undefined => {
    const exact = cableInfo.get(name)
    if (exact !== undefined) {
      if (sourceCableIds.has(name)) directlyUsedCables.add(name)
      return exact
    }

    const generated = splitGeneratedName(name, templateSeparator)
    if (generated === undefined) return undefined
    if (generated.instance === "") {
      error(
        `Connection row ${row}: unnamed cable autogeneration "${name}" is not representable; assign an explicit designator.`,
        `cable:${generated.template}`
      )
      return undefined
    }
    const template = cableInfo.get(generated.template)
    if (template === undefined || !sourceCableIds.has(generated.template)) return undefined

    const occupied = cableInfo.get(generated.instance)
    if (occupied !== undefined) {
      if (generatedCableOrigins.get(generated.instance) === generated.template) return occupied
      error(
        `Connection row ${row}: cable designator ${generated.instance} already exists; cannot instantiate template ${generated.template}.`,
        `cable:${generated.instance}`
      )
      return undefined
    }

    const { id: _id, kind: _kind, ...props } = template.def
    const instance = cable(generated.instance, props)
    const info: CableInfo = { ...template, def: instance }
    cableInfo.set(generated.instance, info)
    if (!template.isBundle) cables.push(instance)
    usedCableTemplates.add(generated.template)
    generatedCableOrigins.set(generated.instance, generated.template)
    return info
  }

  const resolveConnectorPin = (
    instance: ConnectorInstance,
    reference: string,
    row: number
  ): string | undefined => {
    if (connectorPins.get(instance.ref)?.has(reference) === true) return reference
    const matches = connectorPinsByLabel.get(instance.ref)?.get(reference) ?? []
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      error(
        `Connection row ${row}: pin label "${reference}" is ambiguous on connector ${instance.ref}.`,
        `connector:${instance.ref}`
      )
      return undefined
    }
    error(
      `Connection row ${row}: pin "${reference}" does not exist on connector ${instance.ref}.`,
      `connector:${instance.ref}`
    )
    return undefined
  }

  const resolveConductor = (
    info: CableInfo,
    reference: string,
    row: number
  ): string | undefined => {
    const matches = info.conductorReferences.get(reference) ?? []
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      error(
        `Connection row ${row}: conductor reference "${reference}" is ambiguous on cable ${info.def.id}.`,
        `cable:${info.def.id}`
      )
      return undefined
    }
    error(
      `Connection row ${row}: conductor "${reference}" does not exist on cable ${info.def.id}.`,
      `cable:${info.def.id}`
    )
    return undefined
  }

  // --- Connections ------------------------------------------------------------
  const wires: Array<WireDef> = []
  let looseWireCounter = 0
  for (const [rowIndex, row] of connectionsIn.entries()) {
    if (!Array.isArray(row)) {
      error(`Connection row ${rowIndex + 1} is not a sequence; skipped.`)
      continue
    }
    // Each row is an alternating chain of {connector: pins} / {cable: conductors}.
    const items = row.map((entry) => {
      if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
        const [name, spec] = Object.entries(entry)[0] ?? []
        return name !== undefined ? { name, pins: expandPins(spec) } : undefined
      }
      return undefined
    })
    for (let i = 0; i + 2 < items.length || (items.length === 2 && i === 0); i += 2) {
      const left = items[i]
      const middle = items.length === 2 ? undefined : items[i + 1]
      const right = items.length === 2 ? items[i + 1] : items[i + 2]
      if (left === undefined || right === undefined) {
        error(`Connection row ${rowIndex + 1} has an unrecognized entry; skipped.`)
        break
      }
      const leftConn = resolveConnector(left.name, rowIndex + 1)
      const rightConn = resolveConnector(right.name, rowIndex + 1)
      if (leftConn === undefined || rightConn === undefined) {
        error(
          `Connection row ${rowIndex + 1} references unknown connector ${leftConn === undefined ? left.name : right.name}; skipped.`
        )
        break
      }
      const info = middle !== undefined ? resolveCable(middle.name, rowIndex + 1) : undefined
      if (middle !== undefined && info === undefined) {
        error(`Connection row ${rowIndex + 1} references unknown cable ${middle.name}; skipped.`)
        break
      }
      const pinCounts = [left.pins.length, right.pins.length]
      if (middle !== undefined) pinCounts.push(middle.pins.length)
      if (new Set(pinCounts).size !== 1) {
        error(
          `Connection row ${rowIndex + 1} has mismatched pin counts (${pinCounts.join("/")}); only aligned pins are imported.`
        )
      }
      const count = Math.min(
        left.pins.length,
        right.pins.length,
        middle?.pins.length ?? Number.POSITIVE_INFINITY
      )
      if (count === 0) {
        error(`Connection row ${rowIndex + 1} contains no aligned pins; skipped.`)
        continue
      }
      for (let k = 0; k < count; k++) {
        const fromPin = resolveConnectorPin(leftConn, left.pins[k]!, rowIndex + 1)
        const toPin = resolveConnectorPin(rightConn, right.pins[k]!, rowIndex + 1)
        const conductorReference = middle?.pins[k]
        const conductor =
          conductorReference !== undefined && info !== undefined
            ? resolveConductor(info, conductorReference, rowIndex + 1)
            : undefined
        if (fromPin === undefined || toPin === undefined) continue
        if (middle !== undefined && conductor === undefined) continue
        const cableId = info?.def.id
        const id =
          cableId !== undefined && conductor !== undefined
            ? `${cableId}.${conductor}`
            : `W${++looseWireCounter}`
        const signal =
          leftConn.pins[fromPin] ?? rightConn.pins[toPin]
        wires.push(
          wire(id, leftConn.pin(fromPin), rightConn.pin(toPin), {
            ...(info?.gauge !== undefined ? { gauge: info.gauge } : {}),
            ...(info?.lengthMm !== undefined ? { length: info.lengthMm } : {}),
            ...(conductor !== undefined && info !== undefined
              ? {
                  color: info.colors[Number(conductor) - 1],
                  ...(cableId !== undefined && cables.some((c) => c.id === cableId)
                    ? { cable: cableId, conductor }
                    : {})
                }
              : {}),
            ...(signal !== undefined ? { signal } : {})
          })
        )
      }
    }
  }

  if (connectionsIn.length > 0 && wires.length === 0) {
    error(`WireViz source declares ${connectionsIn.length} connection row(s), but no wires were imported.`)
  }

  const design = harness(options.harnessId ?? "imported-wireviz-harness", {
    revision: options.revision ?? "A",
    units: "mm",
    metadata: importedMetadata,
    connectors: connectors.filter(
      (instance) =>
        !usedConnectorTemplates.has(instance.ref) || directlyUsedConnectors.has(instance.ref)
    ),
    wires,
    cables: cables.filter(
      (instance) => !usedCableTemplates.has(instance.id) || directlyUsedCables.has(instance.id)
    )
  })

  return { design, diagnostics }
}
