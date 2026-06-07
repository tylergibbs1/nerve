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
import { compileDesign, type HarnessDesign } from "@grayhaven/nerve"
import { schematicSvg } from "../src/svg.js"
import motor from "../../../examples/motor-controller/src/main.harness.js"
import sensor from "../../../examples/sensor-splice/src/main.harness.js"
import robot from "../../../examples/robot-platform/src/main.harness.js"

const BASELINES = join(__dirname, "__image_baselines__")
mkdirSync(BASELINES, { recursive: true })

const render = (design: HarnessDesign): Buffer => {
  const svg = schematicSvg(compileDesign(design).hir)
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false }, // geometry-only: deterministic everywhere
    fitTo: { mode: "width", value: 1200 }
  })
  return Buffer.from(resvg.render().asPng())
}

const check = (name: string, design: HarnessDesign): void => {
  const actual = render(design)
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

describe("visual regression (pixel baselines)", () => {
  it("motor-controller", () => check("motor-controller", motor))
  it("sensor-splice", () => check("sensor-splice", sensor))
  it("robot-platform", () => check("robot-platform", robot))
})
