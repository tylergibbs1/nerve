/**
 * WireViz YAML → HarnessDesign (PRD §27.2).
 *
 * Imports the useful subset: connectors (type, subtype, pincount,
 * pinlabels), cables (gauge, length, wirecount, colors, color_code,
 * shield), and connections (alternating connector/cable chains with pin
 * lists or ranges). Anything WireViz expresses that HIR cannot map cleanly
 * produces an actionable diagnostic instead of silent loss.
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

  for (const section of ["options", "tweak", "additional_bom_items"]) {
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
    pinlabels.forEach((label, i) => {
      if (label !== null && label !== undefined) pins[pinIds[i] ?? String(i + 1)] = String(label)
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
  }

  // --- Cables ---------------------------------------------------------------
  interface CableInfo {
    readonly def: CableDef
    readonly gauge: string | undefined
    readonly lengthMm: number | undefined
    readonly colors: ReadonlyArray<string>
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
    let colors = Array.isArray(def["colors"])
      ? (def["colors"] as Array<unknown>).map((c) => colorFromWireViz(String(c)))
      : []
    const colorCode = typeof def["color_code"] === "string" ? def["color_code"].toUpperCase() : undefined
    if (colors.length === 0 && colorCode !== undefined) {
      const cycle = COLOR_CODES[colorCode]
      if (cycle !== undefined && wirecount !== undefined) {
        colors = Array.from({ length: wirecount }, (_, i) =>
          colorFromWireViz(cycle[i % cycle.length]!)
        )
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
    if (!isBundle) cables.push(cableDef)
    cableInfo.set(id, {
      def: cableDef,
      gauge: normalizeGauge(def["gauge"]),
      lengthMm,
      colors
    })
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
      const leftConn = connectorByRef.get(left.name)
      const rightConn = connectorByRef.get(right.name)
      if (leftConn === undefined || rightConn === undefined) {
        error(
          `Connection row ${rowIndex + 1} references unknown connector ${leftConn === undefined ? left.name : right.name}; skipped.`
        )
        break
      }
      const info = middle !== undefined ? cableInfo.get(middle.name) : undefined
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
        const conductor = middle?.pins[k]
        const id =
          middle !== undefined && conductor !== undefined
            ? `${middle.name}.${conductor}`
            : `W${++looseWireCounter}`
        const fromPin = left.pins[k]!
        const toPin = right.pins[k]!
        const signal =
          leftConn.pins[fromPin] ?? rightConn.pins[toPin]
        wires.push(
          wire(id, leftConn.pin(fromPin), rightConn.pin(toPin), {
            ...(info?.gauge !== undefined ? { gauge: info.gauge } : {}),
            ...(info?.lengthMm !== undefined ? { length: info.lengthMm } : {}),
            ...(conductor !== undefined && info !== undefined
              ? {
                  color: info.colors[Number(conductor) - 1],
                  ...(cables.some((c) => c.id === middle!.name)
                    ? { cable: middle!.name, conductor }
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
    connectors,
    wires,
    cables
  })

  return { design, diagnostics }
}
