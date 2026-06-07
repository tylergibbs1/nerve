/**
 * DrawingIR (PRD §27.4): the Nerve-owned intermediate representation for
 * exported drawings. Layout algorithms emit a `Drawing`; renderers
 * (SVG, PDF) consume it. This keeps every exported artifact deterministic,
 * reproducible, and renderable to multiple formats from one layout.
 *
 * Coordinate system: y increases downward (SVG convention); the PDF
 * renderer flips.
 */

/** Optional data-* attributes (sorted at render time — deterministic). */
export interface DrawData {
  readonly data?: Readonly<Record<string, string>>
}

export interface DrawRect extends DrawData {
  readonly kind: "rect"
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly rx?: number
  readonly fill?: string
  readonly stroke?: string
  readonly strokeWidth?: number
}

export interface DrawLine extends DrawData {
  readonly kind: "line"
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly stroke: string
  readonly strokeWidth?: number
  readonly dash?: ReadonlyArray<number>
}

/** Cubic-bezier path expressed as an SVG `d` string (M/C/L commands only). */
export interface DrawPath extends DrawData {
  readonly kind: "path"
  readonly d: string
  readonly stroke: string
  readonly strokeWidth?: number
  readonly dash?: ReadonlyArray<number>
}

export interface DrawText extends DrawData {
  readonly kind: "text"
  readonly x: number
  readonly y: number
  readonly text: string
  readonly size?: number
  readonly weight?: "normal" | "bold"
  readonly fill?: string
  readonly anchor?: "start" | "middle" | "end"
}

export interface DrawCircle extends DrawData {
  readonly kind: "circle"
  readonly cx: number
  readonly cy: number
  readonly r: number
  readonly fill: string
}

export type DrawItem = DrawRect | DrawLine | DrawPath | DrawText | DrawCircle

export interface Drawing {
  readonly width: number
  readonly height: number
  readonly background?: string
  readonly items: ReadonlyArray<DrawItem>
}

const dataAttrs = (item: DrawData): string => {
  if (item.data === undefined) return ""
  return Object.entries(item.data)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => ` data-${k}="${esc(v)}"`)
    .join("")
}

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/** Render the item list only (no svg envelope) — used by tiled outputs. */
export const renderItems = (items: ReadonlyArray<DrawItem>): string => {
  const parts: Array<string> = []
  for (const item of items) {
    switch (item.kind) {
      case "rect":
        parts.push(
          `<rect${dataAttrs(item)} x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}"${item.rx !== undefined ? ` rx="${item.rx}"` : ""} fill="${esc(item.fill ?? "none")}"${item.stroke !== undefined ? ` stroke="${esc(item.stroke)}" stroke-width="${item.strokeWidth ?? 1}"` : ""}/>`
        )
        break
      case "line":
        parts.push(
          `<line${dataAttrs(item)} x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${esc(item.stroke)}" stroke-width="${item.strokeWidth ?? 1}"${item.dash !== undefined ? ` stroke-dasharray="${item.dash.join(" ")}"` : ""}/>`
        )
        break
      case "path":
        parts.push(
          `<path${dataAttrs(item)} d="${esc(item.d)}" fill="none" stroke="${esc(item.stroke)}" stroke-width="${item.strokeWidth ?? 1}"${item.dash !== undefined ? ` stroke-dasharray="${item.dash.join(" ")}"` : ""}/>`
        )
        break
      case "text":
        parts.push(
          `<text${dataAttrs(item)} x="${item.x}" y="${item.y}"${item.size !== undefined ? ` font-size="${item.size}"` : ""}${item.weight === "bold" ? ` font-weight="bold"` : ""} fill="${esc(item.fill ?? "#111")}"${item.anchor !== undefined && item.anchor !== "start" ? ` text-anchor="${item.anchor}"` : ""}>${esc(item.text)}</text>`
        )
        break
      case "circle":
        parts.push(
          `<circle${dataAttrs(item)} cx="${item.cx}" cy="${item.cy}" r="${item.r}" fill="${esc(item.fill)}"/>`
        )
        break
    }
  }
  return parts.join("\n")
}

/** Render a Drawing to standalone SVG. Deterministic. */
export const renderSvg = (drawing: Drawing): string => {
  const parts: Array<string> = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${drawing.width}" height="${drawing.height}" viewBox="0 0 ${drawing.width} ${drawing.height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12">`
  ]
  if (drawing.background !== undefined) {
    parts.push(
      `<rect width="${drawing.width}" height="${drawing.height}" fill="${esc(drawing.background)}"/>`
    )
  }
  parts.push(renderItems(drawing.items))
  parts.push("</svg>")
  return parts.join("\n") + "\n"
}

/** Uniformly scale a drawing (used to fit PDF pages). */
export const scaleDrawing = (drawing: Drawing, s: number): Drawing => ({
  width: drawing.width * s,
  height: drawing.height * s,
  ...(drawing.background !== undefined ? { background: drawing.background } : {}),
  items: drawing.items.map((item): DrawItem => {
    switch (item.kind) {
      case "rect":
        return {
          ...item,
          x: item.x * s,
          y: item.y * s,
          w: item.w * s,
          h: item.h * s,
          ...(item.rx !== undefined ? { rx: item.rx * s } : {}),
          ...(item.strokeWidth !== undefined ? { strokeWidth: item.strokeWidth * s } : {})
        }
      case "line":
        return {
          ...item,
          x1: item.x1 * s,
          y1: item.y1 * s,
          x2: item.x2 * s,
          y2: item.y2 * s,
          ...(item.strokeWidth !== undefined ? { strokeWidth: item.strokeWidth * s } : {}),
          ...(item.dash !== undefined ? { dash: item.dash.map((d) => d * s) } : {})
        }
      case "path":
        return {
          ...item,
          d: scalePathData(item.d, s),
          ...(item.strokeWidth !== undefined ? { strokeWidth: item.strokeWidth * s } : {}),
          ...(item.dash !== undefined ? { dash: item.dash.map((d) => d * s) } : {})
        }
      case "text":
        return {
          ...item,
          x: item.x * s,
          y: item.y * s,
          size: (item.size ?? 12) * s
        }
      case "circle":
        return { ...item, cx: item.cx * s, cy: item.cy * s, r: item.r * s }
    }
  })
})

/** Scale every numeric token in an M/C/L path string. */
const scalePathData = (d: string, s: number): string =>
  d.replace(/-?\d+(\.\d+)?/g, (n) => String(round2(Number(n) * s)))

const round2 = (n: number): number => Math.round(n * 100) / 100
