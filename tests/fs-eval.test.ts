/**
 * Multi-file sandbox evaluation (PRD §9.6): resolution and cycle rules for
 * the web editor's fsMap evaluator, tested outside the browser.
 */
import { describe, expect, it } from "vitest"
// Root tests sit outside the workspace packages; resolve sucrase through
// nerve-web's install (the same copy the worker lazy-loads).
import { transform } from "../packages/nerve-web/node_modules/sucrase/dist/index.js"
import * as nerve from "../packages/nerve/src/index.js"
import * as connectors from "../packages/nerve-connectors/src/index.js"
import {
  evaluateFsMap,
  normalizePath,
  resolveFilePath
} from "../packages/nerve-web/src/lib/fs-eval.js"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const OPTS = {
  modules: {
    "@grayhaven/nerve": nerve,
    "@grayhaven/nerve-connectors": connectors
  },
  transform: (s: string) => transform(s, { transforms: ["typescript", "imports"] }).code
}

describe("normalizePath", () => {
  it.each([
    ["main.harness.ts", "/main.harness.ts"],
    ["./variants/long.ts", "/variants/long.ts"],
    ["/variants/../main.harness.js", "/main.harness.js"],
    ["a/b/../../c.ts", "/c.ts"]
  ])("%s → %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected)
  })
})

describe("resolveFilePath", () => {
  const files = new Map([
    ["/main.harness.ts", ""],
    ["/variants/long.ts", ""],
    ["/lib/index.ts", ""]
  ])
  it("NodeNext: authored .js specifiers resolve to .ts files", () => {
    expect(resolveFilePath(files, "/variants/long.ts", "../main.harness.js")).toBe(
      "/main.harness.ts"
    )
  })
  it("extensionless and directory imports probe", () => {
    expect(resolveFilePath(files, "/main.harness.ts", "./variants/long")).toBe(
      "/variants/long.ts"
    )
    expect(resolveFilePath(files, "/main.harness.ts", "./lib")).toBe("/lib/index.ts")
  })
  it("misses return undefined", () => {
    expect(resolveFilePath(files, "/main.harness.ts", "./nope")).toBeUndefined()
  })
})

describe("evaluateFsMap", () => {
  const entry = `
import { harness, connector, wire } from "@grayhaven/nerve"
import { part } from "./parts.js"
const j1 = connector("J1", part, { pins: { 1: "PWR" } })
const j2 = connector("J2", part, { pins: { 1: "PWR" } })
export default harness("multi-file", {
  revision: "A", units: "mm",
  connectors: [j1, j2],
  wires: [wire("W1", j1.pin(1), j2.pin(1), { signal: "PWR" })]
})
`
  const parts = `export const part = { mpn: "GEN-1", pinCount: 1 }`

  it("evaluates cross-file imports", () => {
    const design = evaluateFsMap(
      { "/main.harness.ts": entry, "/parts.ts": parts },
      "/main.harness.ts",
      OPTS
    )
    expect(design.id).toBe("multi-file")
    const { hir } = nerve.compileDesign(design)
    expect(hir.connectors.map((c) => c.mpn)).toEqual(["GEN-1", "GEN-1"])
  })

  it("the REAL proof case: variants/long.ts imports ../main.harness.js", () => {
    const root = join(import.meta.dirname, "..", "examples", "motor-controller", "src")
    const fsMap = {
      "/main.harness.ts": readFileSync(join(root, "main.harness.ts"), "utf8"),
      "/variants/long.ts": readFileSync(join(root, "variants", "long.ts"), "utf8")
    }
    const design = evaluateFsMap(fsMap, "/variants/long.ts", OPTS)
    expect(design.id).toBe("motor-controller-harness-long")
    const { hir } = nerve.compileDesign(design)
    expect(hir.wires.find((w) => w.id === "W1")?.length).toBe(800)
  })

  it("import cycles fail with the exact chain", () => {
    const fsMap = {
      "/a.ts": `import "./b.js"\nexport default { kind: "harness" }`,
      "/b.ts": `import "./a.js"\nexport const x = 1`
    }
    expect(() => evaluateFsMap(fsMap, "/a.ts", OPTS)).toThrow(
      /Circular import: \/a\.ts → \/b\.ts → \/a\.ts/
    )
  })

  it("unresolvable imports name the files that DO exist", () => {
    expect(() =>
      evaluateFsMap({ "/main.harness.ts": `import "./ghost.js"` }, "/main.harness.ts", OPTS)
    ).toThrow(/Cannot resolve ".\/ghost.js".*\/main\.harness\.ts/)
  })

  it("bare specifiers outside the sandbox table fail with the menu", () => {
    expect(() =>
      evaluateFsMap({ "/main.harness.ts": `import "leftpad"` }, "/main.harness.ts", OPTS)
    ).toThrow(/not available in the editor sandbox/)
  })

  it("shared imports evaluate once", () => {
    const fsMap = {
      "/main.harness.ts": `
import { n } from "./counter.js"
import { m } from "./other.js"
import { harness } from "@grayhaven/nerve"
export default harness("once-" + n + "-" + m, { revision: "A", units: "mm", connectors: [], wires: [] })`,
      "/other.ts": `import { n } from "./counter.js"\nexport const m = n`,
      "/counter.ts": `let count = 0\nexport const n = ++count`
    }
    const design = evaluateFsMap(fsMap, "/main.harness.ts", OPTS)
    expect(design.id).toBe("once-1-1")
  })
})
