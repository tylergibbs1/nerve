/**
 * System interface contracts (PRD §37).
 *
 * A connector contract is the harness-side pinout as a versioned, shareable
 * artifact: PCB teams validate their connector against it, firmware teams
 * validate their signal dictionary, and `validateContract` catches the
 * classic swapped-pin mistake between board and harness revisions.
 */
import {
  DiagnosticSeverity,
  HIR_SCHEMA_VERSION,
  refs,
  type Diagnostic,
  type Hir
} from "@grayhaven/nerve"

export interface ConnectorContract {
  readonly contractVersion: "0.1.0"
  readonly harness: { readonly id: string; readonly revision: string }
  readonly hirSchema: string
  readonly connector: string
  readonly mpn: string
  readonly matingSide?: string
  readonly pinout: ReadonlyArray<{ readonly pin: string; readonly signal?: string }>
}

/** Export the harness-side contract for one connector. */
export const exportConnectorContract = (
  hir: Hir,
  connectorRef: string
): ConnectorContract | undefined => {
  const c = hir.connectors.find((x) => x.ref === connectorRef)
  if (c === undefined) return undefined
  return {
    contractVersion: "0.1.0",
    harness: { id: hir.harness.id, revision: hir.harness.revision },
    hirSchema: HIR_SCHEMA_VERSION,
    connector: c.ref,
    mpn: c.mpn,
    pinout: c.pins.map((p) => ({
      pin: p.pin,
      ...(p.signal !== undefined ? { signal: p.signal } : {})
    }))
  }
}

/**
 * Validate the harness against a contract (e.g. exported from a PCB tool or
 * a previous release). Detects swapped pins, signal renames, and missing or
 * extra pins.
 */
export const validateContract = (
  hir: Hir,
  contract: ConnectorContract
): ReadonlyArray<Diagnostic> => {
  const diagnostics: Array<Diagnostic> = []
  const c = hir.connectors.find((x) => x.ref === contract.connector)
  if (c === undefined) {
    return [
      {
        code: "HK-IFC-001",
        severity: DiagnosticSeverity.Error,
        message: `Contract references connector ${contract.connector}, which does not exist in this harness.`,
        target: refs.connector(contract.connector)
      }
    ]
  }
  // PRD §37: PCB connector, harness connector, and mating connector are
  // linked but distinct — a contract naming the harness part's MATE (the
  // PCB-side housing) is correct, not a mismatch.
  if (c.mpn !== contract.mpn && c.matingMpn !== contract.mpn && contract.mpn !== "unknown") {
    diagnostics.push({
      code: "HK-IFC-002",
      severity: DiagnosticSeverity.Warning,
      message: `Connector ${c.ref} is ${c.mpn} (mates ${c.matingMpn ?? "unspecified"}) but the contract specifies ${contract.mpn}.`,
      target: refs.connector(c.ref)
    })
  }
  const harnessPins = new Map(c.pins.map((p) => [p.pin, p.signal]))
  const contractPins = new Map(contract.pinout.map((p) => [p.pin, p.signal]))
  for (const [pin, expected] of contractPins) {
    if (!harnessPins.has(pin)) {
      diagnostics.push({
        code: "HK-IFC-003",
        severity: DiagnosticSeverity.Error,
        message: `Contract pin ${c.ref}.${pin} (${expected ?? "unassigned"}) is missing from the harness pinout.`,
        target: refs.pin(c.ref, pin)
      })
      continue
    }
    const actual = harnessPins.get(pin)
    if (expected !== undefined && actual !== expected) {
      diagnostics.push({
        code: "HK-IFC-004",
        severity: DiagnosticSeverity.Error,
        message: `Pin ${c.ref}.${pin}: harness carries ${actual ?? "nothing"} but the contract requires ${expected}.`,
        target: refs.pin(c.ref, pin)
      })
    }
  }
  for (const pin of harnessPins.keys()) {
    if (!contractPins.has(pin)) {
      diagnostics.push({
        code: "HK-IFC-005",
        severity: DiagnosticSeverity.Warning,
        message: `Harness pin ${c.ref}.${pin} is not covered by the contract.`,
        target: refs.pin(c.ref, pin)
      })
    }
  }
  return diagnostics
}

/** Parse a simple pinout CSV ("pin,signal" with optional header) into a contract. */
export const importPinoutCsv = (
  csv: string,
  meta: { readonly connector: string; readonly mpn?: string }
): ConnectorContract => {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split(",").map((cell) => cell.trim()))
  const body = rows[0]?.[0]?.toLowerCase() === "pin" ? rows.slice(1) : rows
  return {
    contractVersion: "0.1.0",
    harness: { id: "external", revision: "-" },
    hirSchema: HIR_SCHEMA_VERSION,
    connector: meta.connector,
    mpn: meta.mpn ?? "unknown",
    pinout: body.map(([pin, signal]) => ({
      pin: pin ?? "",
      ...(signal !== undefined && signal !== "" ? { signal } : {})
    }))
  }
}

/**
 * Import a connector pinout from tscircuit Circuit JSON (PRD §37).
 * Circuit JSON is a flat array of typed elements; we read the named
 * `source_component` (the PCB-side connector, e.g. "J1") and its
 * `source_port`s. Signal names come from port_hints (first hint that
 * is not a pinN/number alias) falling back to the port name.
 */
export const importTscircuitPinout = (
  circuitJson: ReadonlyArray<Record<string, unknown>>,
  meta: { readonly connector: string; readonly component?: string }
): ConnectorContract | undefined => {
  const wanted = meta.component ?? meta.connector
  const component = circuitJson.find(
    (el) => el["type"] === "source_component" && el["name"] === wanted
  )
  if (component === undefined) return undefined
  const componentId = component["source_component_id"]
  const ports = circuitJson.filter(
    (el) => el["type"] === "source_port" && el["source_component_id"] === componentId
  )
  const isAlias = (hint: string, pin: number | undefined): boolean =>
    /^(pin)?\d+$/i.test(hint) && (pin === undefined || hint.replace(/^pin/i, "") === String(pin))
  const pinout = ports
    .map((port) => {
      const pinNumber = typeof port["pin_number"] === "number" ? port["pin_number"] : undefined
      const hints = Array.isArray(port["port_hints"]) ? (port["port_hints"] as Array<string>) : []
      const name = typeof port["name"] === "string" ? port["name"] : undefined
      const signal =
        hints.find((h) => !isAlias(h, pinNumber)) ??
        (name !== undefined && !isAlias(name, pinNumber) ? name : undefined)
      return {
        pin: pinNumber !== undefined ? String(pinNumber) : (name ?? ""),
        ...(signal !== undefined ? { signal: signal.toUpperCase() } : {})
      }
    })
    .filter((p) => p.pin !== "")
    .sort((a, b) => Number(a.pin) - Number(b.pin))
  const mpn = component["manufacturer_part_number"]
  return {
    contractVersion: "0.1.0",
    harness: { id: "tscircuit", revision: "-" },
    hirSchema: HIR_SCHEMA_VERSION,
    connector: meta.connector,
    mpn: typeof mpn === "string" ? mpn : "unknown",
    pinout
  }
}

/**
 * Export harness connectors as tscircuit Circuit JSON source elements
 * (PRD §37, reverse direction): a tscircuit board project can validate
 * its connector against the HARNESS as the source of truth. Shapes match
 * circuit-json@0.0.433; ids are deterministic.
 */
export const exportTscircuitCircuitJson = (
  hir: Hir,
  connectorRef?: string
): Array<Record<string, unknown>> => {
  const connectors =
    connectorRef !== undefined
      ? hir.connectors.filter((c) => c.ref === connectorRef)
      : hir.connectors
  return connectors.flatMap((c) => [
    {
      type: "source_component",
      ftype: "simple_chip",
      source_component_id: `nerve_${c.ref}`,
      name: c.ref,
      manufacturer_part_number: c.mpn,
      ...(c.matingMpn !== undefined ? { display_value: `mates ${c.matingMpn}` } : {})
    },
    ...c.pins.map((p) => ({
      type: "source_port",
      source_port_id: `nerve_${c.ref}_pin${p.pin}`,
      source_component_id: `nerve_${c.ref}`,
      name: `pin${p.pin}`,
      pin_number: Number(p.pin),
      port_hints: [...(p.signal !== undefined ? [p.signal] : []), `pin${p.pin}`]
    }))
  ])
}

export const contractJson = (contract: ConnectorContract): string =>
  JSON.stringify(contract, null, 2) + "\n"
