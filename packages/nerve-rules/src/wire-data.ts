/**
 * Wire reference data shared by electrical rules.
 *
 * Ampacities are conservative bundled-harness values (chassis-wiring tables
 * derated for bundling). Rule packs can override with stricter
 * standards-informed data later (PRD §38).
 */

/** Parse "18AWG" / "18 AWG" / "awg18" → 18. */
export const parseAwg = (gauge: string): number | undefined => {
  const match = /(\d+)\s*AWG|AWG\s*(\d+)/i.exec(gauge.trim())
  const raw = match?.[1] ?? match?.[2]
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/** Max continuous current (A) per AWG, bundled/derated. */
export const AMPACITY_BY_AWG: Readonly<Record<number, number>> = {
  30: 0.3,
  28: 0.5,
  26: 0.8,
  24: 1.4,
  22: 2.3,
  20: 3.7,
  18: 5.9,
  16: 9.4,
  14: 15,
  12: 24,
  10: 38
}

/** Smallest (thickest-allowed) AWG number that carries `current` amps, or undefined if off-table. */
export const requiredAwgForCurrent = (current: number): number | undefined => {
  const candidates = Object.entries(AMPACITY_BY_AWG)
    .map(([awg, amps]) => [Number(awg), amps] as const)
    .filter(([, amps]) => amps >= current)
    .map(([awg]) => awg)
  return candidates.length > 0 ? Math.max(...candidates) : undefined
}

const POWER_SIGNAL = /^(VBAT|VCC|VDD|VIN|VSYS|PWR|\+?\d+(\.\d+)?V)/i
const GROUND_SIGNAL = /^(GND|GROUND|0V|RTN|RETURN|VSS)/i
const SHIELD_SIGNAL = /(SHIELD|DRAIN|SHLD)/i

export const isPowerSignal = (signal: string): boolean => POWER_SIGNAL.test(signal)
export const isGroundSignal = (signal: string): boolean => GROUND_SIGNAL.test(signal)
export const isShieldSignal = (signal: string): boolean => SHIELD_SIGNAL.test(signal)

/**
 * Known differential / twisted-pair signal pairs (PRD §9.4: CAN, RS-485,
 * USB, Ethernet). Each entry maps a signal to its expected partner.
 */
export const differentialPartner = (signal: string): string | undefined => {
  const s = signal.toUpperCase()
  const table: ReadonlyArray<readonly [RegExp, (s: string) => string]> = [
    [/^(.*)CAN_?H$/, (m) => m.replace(/CAN_?H$/, (h) => h.replace("H", "L"))],
    [/^(.*)CAN_?L$/, (m) => m.replace(/CAN_?L$/, (l) => l.replace("L", "H"))],
    [/^(.*)RS485_?A$/, (m) => m.slice(0, -1) + "B"],
    [/^(.*)RS485_?B$/, (m) => m.slice(0, -1) + "A"],
    [/^(.*)_P$/, (m) => m.slice(0, -2) + "_N"],
    [/^(.*)_N$/, (m) => m.slice(0, -2) + "_P"],
    [/^(.*)USB_?DP$/, (m) => m.replace(/DP$/, "DM")],
    [/^(.*)USB_?DM$/, (m) => m.replace(/DM$/, "DP")]
  ]
  for (const [pattern, partner] of table) {
    if (pattern.test(s)) return partner(s)
  }
  return undefined
}
