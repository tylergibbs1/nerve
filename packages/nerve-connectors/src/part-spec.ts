/**
 * Compact part specs (tscircuit footprinter-style): resolve short,
 * memorable strings to library parts. `part("microfit-2x8")` beats
 * remembering "43025-1600", and unknown specs fail loudly with the
 * full menu.
 *
 *   microfit-8 / microfit-2x4   -> 43025-0800 (receptacle)
 *   microfit-8-plug             -> 43020-0800
 *   megafit-8 / megafit-8-plug  -> 76829-0008 / 76825-0008
 *   ph-2..6, xh-2..4            -> JST housings
 *   dt-2s..4s / dt-2p..4p       -> Deutsch DT plugs / receptacles
 *   xt60-m / xt60-f             -> AMASS XT60
 */
import type { AutocompleteString, ConnectorPart } from "@grayhaven/nerve"
import { allParts } from "./index.js"

// `satisfies` (not a wide annotation) keeps `keyof typeof SPECS` a literal
// union, so part() autocompletes every spec while raw MPNs still pass.
const SPECS = {
  "microfit-8": "43025-0800",
  "microfit-2x4": "43025-0800",
  "microfit-8-plug": "43020-0800",
  "microfit-2x4-plug": "43020-0800",
  "microfit-16": "43025-1600",
  "microfit-2x8": "43025-1600",
  "microfit-16-plug": "43020-1600",
  "microfit-2x8-plug": "43020-1600",
  "megafit-8": "76829-0008",
  "megafit-2x4": "76829-0008",
  "megafit-8-plug": "76825-0008",
  "ph-2": "PHR-2",
  "ph-3": "PHR-3",
  "ph-4": "PHR-4",
  "ph-6": "PHR-6",
  "xh-2": "XHP-2",
  "xh-3": "XHP-3",
  "xh-4": "XHP-4",
  "dt-2s": "DT06-2S",
  "dt-3s": "DT06-3S",
  "dt-4s": "DT06-4S",
  "dt-2p": "DT04-2P",
  "dt-3p": "DT04-3P",
  "dt-4p": "DT04-4P",
  "xt60-m": "XT60PW-M",
  "xt60-f": "XT60PW-F"
} as const satisfies Readonly<Record<string, string>>

/** Every compact spec name, as a literal union (drives autocomplete). */
export type PartSpecName = keyof typeof SPECS

/** Resolve a compact spec or a raw MPN to a library part. Throws with the menu on a miss. */
export const part = (spec: AutocompleteString<PartSpecName>): ConnectorPart => {
  const mpn = (SPECS as Readonly<Record<string, string>>)[spec.toLowerCase()] ?? spec
  const found = allParts[mpn]
  if (found === undefined) {
    throw new Error(
      `Unknown part spec "${spec}". Compact specs: ${Object.keys(SPECS).join(", ")} — or any library MPN.`
    )
  }
  return found
}

/** Every compact spec and its MPN, for docs and tooling. */
export const partSpecs: Readonly<Record<string, string>> = SPECS
