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
  if (c.mpn !== contract.mpn) {
    diagnostics.push({
      code: "HK-IFC-002",
      severity: DiagnosticSeverity.Warning,
      message: `Connector ${c.ref} is ${c.mpn} but the contract specifies ${contract.mpn}.`,
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

export const contractJson = (contract: ConnectorContract): string =>
  JSON.stringify(contract, null, 2) + "\n"
