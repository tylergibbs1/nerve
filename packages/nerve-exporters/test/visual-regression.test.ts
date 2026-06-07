/**
 * Pixel visual regression: render the example schematics to PNG headlessly
 * (resvg, fonts disabled — geometry-only, so output is deterministic across
 * machines/CI) and compare against committed baselines. A byte-snapshot
 * update can slip through review as noise; a changed PNG baseline is a
 * picture in the diff that someone has to look at.
 *
 * Refresh deliberately: UPDATE_VISUALS=1 bun ... vitest run visual-regression
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { Resvg } from "@resvg/resvg-js"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import {
  compileDesign,
  connector,
  harness,
  runRules,
  splice,
  wire,
  type ConnectorPart,
  type HarnessDesign
} from "@grayhaven/nerve"
import { builtinRules } from "@grayhaven/nerve-rules"
import { schematicSvg } from "../src/svg.js"
import { connectorFacesSvg } from "../src/faces.js"
import motor from "../../../examples/motor-controller/src/main.harness.js"
import sensor from "../../../examples/sensor-splice/src/main.harness.js"
import robot from "../../../examples/robot-platform/src/main.harness.js"

const BASELINES = join(__dirname, "__image_baselines__")
mkdirSync(BASELINES, { recursive: true })

const render = (design: HarnessDesign, fn: (hir: ReturnType<typeof compileDesign>["hir"]) => string = schematicSvg): Buffer => {
  const svg = fn(compileDesign(design).hir)
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false }, // geometry-only: deterministic everywhere
    fitTo: { mode: "width", value: 1200 }
  })
  return Buffer.from(resvg.render().asPng())
}

const check = (name: string, design: HarnessDesign, fn?: (hir: ReturnType<typeof compileDesign>["hir"]) => string): void => {
  const actual = render(design, fn)
  const baselinePath = join(BASELINES, `${name}.png`)
  if (!existsSync(baselinePath) || process.env["UPDATE_VISUALS"] === "1") {
    writeFileSync(baselinePath, actual)
    return
  }
  const a = PNG.sync.read(actual)
  const b = PNG.sync.read(readFileSync(baselinePath))
  expect({ width: a.width, height: a.height }).toEqual({ width: b.width, height: b.height })
  const diff = new PNG({ width: a.width, height: a.height })
  const differing = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.05 })
  if (differing > 0) {
    const diffPath = join(BASELINES, `${name}.diff.png`)
    writeFileSync(diffPath, PNG.sync.write(diff))
    expect.fail(
      `${name}: ${differing} pixels differ from baseline. Inspect ${diffPath}; ` +
        `if intentional, refresh with UPDATE_VISUALS=1.`
    )
  }
}

// Error presentation needs its own baseline: every example above renders
// clean, so badge/red-dash regressions would otherwise be invisible. This
// design fails wire-, pin-, splice-, and pair-targeted rules on purpose.
const errorPart: ConnectorPart = {
  mpn: "ERR-4",
  pinCount: 4,
  wireGaugeRange: { min: "30AWG", max: "18AWG" }
}
const errJ1 = connector("J1", errorPart, {
  pins: { 1: "CAN_H", 2: "CAN_L", 3: "VBAT_24V", 4: "GND" }
})
const errJ2 = connector("J2", errorPart, {
  pins: { 1: "CAN_H", 2: "CAN_L", 3: "VBAT_24V", 4: "GND" }
})
const errSplice = splice("SP1", { notes: "deliberately underfed" })
const errorDesign = harness("error-showcase", {
  revision: "A",
  units: "mm",
  connectors: [errJ1, errJ2],
  splices: [errSplice],
  wires: [
    // Untwisted differential pair: HK-ELEC-001 on both wires.
    wire("W1", errJ1.pin(1), errJ2.pin(1), { signal: "CAN_H", gauge: "24AWG", color: "yellow", length: 100 }),
    wire("W2", errJ1.pin(2), errJ2.pin(2), { signal: "CAN_L", gauge: "24AWG", color: "green", length: 100 }),
    // Overloaded + out of connector range: HK-WIRE-004 + HK-MFG-004 (pin badge).
    wire("W3", errJ1.pin(3), errJ2.pin(3), { signal: "VBAT_24V", gauge: "14AWG", color: "red", length: 100, currentEstimate: 30 }),
    // Splice with a single wire: HK-SPLICE-003 (splice badge).
    wire("W4", errJ1.pin(4), errSplice, { signal: "GND", gauge: "20AWG", color: "black", length: 100 })
  ]
})

/** Compile + run rules so the HIR carries renderable findings. */
const withRuleDiagnostics = (design: HarnessDesign): ReturnType<typeof compileDesign>["hir"] => {
  const { hir } = compileDesign(design)
  return { ...hir, diagnostics: [...hir.diagnostics, ...runRules(hir, builtinRules)] }
}

describe("visual regression (pixel baselines)", () => {
  it("motor-controller", () => check("motor-controller", motor))
  it("sensor-splice", () => check("sensor-splice", sensor))
  it("robot-platform", () => check("robot-platform", robot))
  it("motor-controller faces", () => check("motor-controller-faces", motor, connectorFacesSvg))
  it("error states: badges + red-dash on schematic", () =>
    check("error-showcase", errorDesign, () => schematicSvg(withRuleDiagnostics(errorDesign))))
  it("error states: badges on faces", () =>
    check("error-showcase-faces", errorDesign, () => connectorFacesSvg(withRuleDiagnostics(errorDesign))))
})
