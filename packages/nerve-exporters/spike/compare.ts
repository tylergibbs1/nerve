/** Generates /tmp/elk-compare.html: legacy vs ELK for all three examples. */
import { writeFileSync } from "node:fs"
import { compileDesign, runRules } from "@grayhaven/nerve"
import { builtinRules } from "@grayhaven/nerve-rules"
import { schematicSvg } from "../src/svg.js"
import { schematicSvgElk } from "./elk-schematic.js"
import motor from "../../../examples/motor-controller/src/main.harness.ts"
import sensor from "../../../examples/sensor-splice/src/main.harness.ts"
import robot from "../../../examples/robot-platform/src/main.harness.ts"

const sections: string[] = []
for (const [name, design] of [["motor-controller", motor], ["sensor-splice", sensor], ["robot-platform", robot]] as const) {
  const { hir } = compileDesign(design)
  const full = { ...hir, diagnostics: [...hir.diagnostics, ...runRules(hir, builtinRules)] }
  const legacy = schematicSvg(full)
  const elk = await schematicSvgElk(full)
  sections.push(`<h2>${name}</h2>
<div style="display:flex;gap:16px;align-items:flex-start">
  <figure style="margin:0;flex:1;min-width:0"><figcaption>legacy (bezier, 2-column)</figcaption><div style="border:1px solid #ccc;overflow:auto">${legacy}</div></figure>
  <figure style="margin:0;flex:1;min-width:0"><figcaption>ELK (layered, orthogonal)</figcaption><div style="border:1px solid #ccc;overflow:auto">${elk}</div></figure>
</div>`)
}
writeFileSync("/tmp/elk-compare.html", `<!doctype html><meta charset="utf8"><title>ELK spike</title>
<body style="font-family:monospace;padding:16px;background:#fff">${sections.join("\n")}</body>`)
console.log("wrote /tmp/elk-compare.html")
