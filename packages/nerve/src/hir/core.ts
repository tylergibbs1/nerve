/**
 * Effect-free HIR values. Lives apart from schema.ts (whose top-level
 * Schema.Struct construction pins the effect runtime into any chunk that
 * includes it) so pure consumers — formatters, the web client, rules —
 * tree-shake cleanly. Types import from schema.ts type-only (erased).
 */
import type { HirEndpoint, HirPinRef } from "./schema.js"

export const HIR_SCHEMA_VERSION = "0.1.0" as const

/** Narrow an endpoint to a pin ref. */
export const isPinEndpoint = (e: HirEndpoint): e is HirPinRef => "connector" in e

/** Stable display form: `J1.1` or `S1`. */
export const endpointLabel = (e: HirEndpoint): string =>
  isPinEndpoint(e) ? `${e.connector}.${e.pin}` : e.splice

/** Stable object references (PRD §19), e.g. `connector:J1.pin:1`. */
export const refs = {
  connector: (ref: string) => `connector:${ref}`,
  pin: (connector: string, pin: string) => `connector:${connector}.pin:${pin}`,
  wire: (id: string) => `wire:${id}`,
  branch: (id: string) => `branch:${id}`,
  splice: (id: string) => `splice:${id}`,
  label: (id: string) => `label:${id}`,
  bom: (mpn: string) => `bom:${mpn}`
} as const
