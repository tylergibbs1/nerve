/**
 * WireViz two-letter color codes ↔ Nerve color names.
 */

const CODE_TO_NAME: Readonly<Record<string, string>> = {
  BK: "black",
  WH: "white",
  GY: "gray",
  PK: "pink",
  RD: "red",
  OG: "orange",
  YE: "yellow",
  OL: "olive",
  GN: "green",
  TQ: "turquoise",
  BU: "blue",
  VT: "violet",
  BN: "brown",
  BG: "beige",
  IV: "ivory",
  SL: "slate",
  CU: "copper",
  SN: "tin",
  SR: "silver",
  GD: "gold"
}

const NAME_TO_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CODE_TO_NAME).map(([code, name]) => [name, code])
)

export const colorFromWireViz = (code: string): string =>
  CODE_TO_NAME[code.toUpperCase()] ?? code

export const colorToWireViz = (name: string): string =>
  NAME_TO_CODE[name.toLowerCase()] ?? name.toUpperCase().slice(0, 2)

/** Wire color sequences for WireViz `color_code` generation. */
export const COLOR_CODES: Readonly<Record<string, ReadonlyArray<string>>> = {
  // DIN 47100 (first 10)
  DIN: ["WH", "BN", "GN", "YE", "GY", "PK", "BU", "RD", "BK", "VT"],
  // IEC 60757-flavored cycle used by WireViz
  IEC: ["BN", "RD", "OG", "YE", "GN", "BU", "VT", "GY", "WH", "BK"]
}
