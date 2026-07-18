/**
 * One-shot OG image generator: renders public/og-image.png (1200x630)
 * from an inline SVG in the site's token language. Run from this package:
 *   bun scripts/gen-og.ts
 * Uses @resvg/resvg-js from the repo-root node_modules.
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"

const W = 1200
const H = 630
const MARGIN = 80

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#0a0a0a" />

  <!-- wires: muted grays plus one sunset line, curving across the lower right -->
  <path d="M 520 640 C 700 560, 860 610, 1000 520 S 1180 430, 1260 450"
    fill="none" stroke="#2a2a2a" stroke-width="3" stroke-linecap="round" />
  <path d="M 560 660 C 740 590, 880 640, 1030 560 S 1190 480, 1260 500"
    fill="none" stroke="#454545" stroke-width="3" stroke-linecap="round" />
  <path d="M 620 670 C 790 620, 930 660, 1070 590 S 1200 520, 1260 540"
    fill="none" stroke="#2a2a2a" stroke-width="3" stroke-linecap="round" />
  <path d="M 480 620 C 680 530, 840 580, 990 480 S 1170 390, 1260 410"
    fill="none" stroke="#ff7a17" stroke-width="3" stroke-linecap="round" />

  <text x="${MARGIN}" y="238" fill="#ededed" font-family="Helvetica Neue, Arial, sans-serif"
    font-size="64" font-weight="600" letter-spacing="-1">
    <tspan x="${MARGIN}" dy="0">Check a harness before</tspan>
    <tspan x="${MARGIN}" dy="82">it reaches the floor.</tspan>
  </text>

  <text x="${MARGIN}" y="404" fill="#8f8f8f" font-family="Helvetica Neue, Arial, sans-serif"
    font-size="28">Grayhaven Nerve · open-source wiring-harness compiler</text>
</svg>
`

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: { loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" }
})
const png = resvg.render().asPng()
const out = join(import.meta.dir, "..", "public", "og-image.png")
writeFileSync(out, png)
console.log(`wrote ${out} (${png.length} bytes)`)
