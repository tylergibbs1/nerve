/**
 * Gauge parsing and canonicalization.
 *
 * Lives in core (not nerve-rules) because `compileDesign` canonicalizes
 * gauge strings into HIR: a wire authored as "awg 20", "20 AWG", or "20"
 * compiles to "20AWG", so every downstream consumer — rules, exporters,
 * WireViz round-trips — sees one spelling. Before this, `gauge: "20"`
 * silently disabled the three gauge-based rules (HK-MFG-004, HK-WIRE-004,
 * HK-MFG-006), which skip wires whose gauge they cannot parse.
 *
 * Strings that don't parse as AWG (metric "0.5mm2", typos) pass through
 * unchanged; the unparseableGauge rule (HK-MFG-007) makes that visible.
 */

/** Bare integers are only treated as AWG inside the plausible range. */
const BARE_AWG_MIN = 1
const BARE_AWG_MAX = 40

/**
 * Parse an AWG gauge string → its number.
 * Accepts "18AWG", "18 AWG", "awg18", "AWG 18", and bare "18".
 */
export const parseAwg = (gauge: string): number | undefined => {
  const s = gauge.trim()
  const match =
    /^(\d+)\s*AWG$/i.exec(s) ?? /^AWG\s*(\d+)$/i.exec(s) ?? /^(\d+)$/.exec(s)
  if (match === null) return undefined
  const n = Number(match[1])
  if (!Number.isInteger(n) || n <= 0) return undefined
  // A bare number is only unambiguously AWG within hookup-wire range.
  if (/^\d+$/.test(s) && (n < BARE_AWG_MIN || n > BARE_AWG_MAX)) return undefined
  return n
}

/**
 * Canonical spelling for a gauge string: AWG inputs normalize to "18AWG";
 * anything unparseable is returned unchanged (and HK-MFG-007 flags it).
 */
export const canonicalGauge = (gauge: string): string => {
  const awg = parseAwg(gauge)
  return awg !== undefined ? `${awg}AWG` : gauge
}

/**
 * Gauges the rule data tables cover (ampacity, insulated OD). Authoring
 * surfaces use `AutocompleteString<KnownGauge>` so editors suggest these
 * while any string still passes through (raw catalogs, metric).
 */
export type KnownGauge = `${10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30}AWG`
