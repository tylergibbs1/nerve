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
 * Parse an AWG gauge string → its number, for the rule layer.
 *
 * Leading-anchored with a word boundary so spec-suffixed catalog strings
 * still yield their gauge: "18 AWG TXL" / "AWG18 (TEW)" → 18 (the rules
 * must still hold these to ampacity). A bare integer is AWG only inside
 * the hookup-wire range. "20.5AWG" stays unparsed (the decimal breaks the
 * boundary), as does any string whose number isn't immediately AWG.
 */
export const parseAwg = (gauge: string): number | undefined => {
  const s = gauge.trim()
  const match =
    /^(\d+)\s*AWG\b/i.exec(s) ?? /^AWG\s*(\d+)\b/i.exec(s) ?? /^(\d+)$/.exec(s)
  if (match === null) return undefined
  const n = Number(match[1])
  if (!Number.isInteger(n) || n <= 0) return undefined
  // A bare number is only unambiguously AWG within hookup-wire range.
  if (/^\d+$/.test(s) && (n < BARE_AWG_MIN || n > BARE_AWG_MAX)) return undefined
  return n
}

/**
 * Canonical spelling for a gauge string. Only a WHOLE-string AWG spelling
 * is rewritten ("20"/"20 AWG"/"awg20" → "20AWG"); spec-suffixed strings
 * ("18 AWG TXL") and metric ("0.5mm2") keep their text verbatim so no
 * information is lost — parseAwg still reads the gauge from them for the
 * rules, and HK-MFG-007 flags whatever genuinely isn't AWG.
 */
export const canonicalGauge = (gauge: string): string => {
  const s = gauge.trim()
  const whole =
    /^(\d+)\s*AWG$/i.exec(s) ?? /^AWG\s*(\d+)$/i.exec(s) ?? /^(\d+)$/.exec(s)
  if (whole === null) return gauge
  const awg = parseAwg(s)
  return awg !== undefined ? `${awg}AWG` : gauge
}

/**
 * Gauges the rule data tables cover (ampacity, insulated OD). Authoring
 * surfaces use `AutocompleteString<KnownGauge>` so editors suggest these
 * while any string still passes through (raw catalogs, metric).
 */
export type KnownGauge = `${10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30}AWG`
