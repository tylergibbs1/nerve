/**
 * Generated-docs drift guard: dsl-meta.json, the dsl.md reference block,
 * and the completion source must match a fresh extraction from
 * @grayhaven/nerve source. If this fails, someone changed the DSL without
 * regenerating: cd packages/nerve-web && bun scripts/gen-llms.ts
 *
 * (The committed dsl.md once documented three props that never existed —
 * `current`, `branch({from,to,length})`, `label({text,position})`. This
 * test makes that class of drift impossible.)
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { dslReferenceMd, extractDslMeta } from "../packages/nerve-web/scripts/extract-dsl.js"

const WEB = join(import.meta.dirname, "..", "packages", "nerve-web")
const REGEN = "Regenerate: cd packages/nerve-web && bun scripts/gen-llms.ts"

describe("generated DSL reference", () => {
  const fresh = extractDslMeta()

  it("dsl-meta.json matches the source extraction", () => {
    const committed = JSON.parse(
      readFileSync(join(WEB, "src", "docs", "dsl-meta.json"), "utf8")
    ) as unknown
    expect(committed, REGEN).toEqual(JSON.parse(JSON.stringify(fresh)))
  })

  it("dsl.md generated block is current", () => {
    const md = readFileSync(join(WEB, "docs-content", "dsl.md"), "utf8")
    const START = "<!-- generated:dsl-reference:start -->"
    const END = "<!-- generated:dsl-reference:end -->"
    const block = md.slice(md.indexOf(START) + START.length, md.indexOf(END))
    expect(block.trim(), REGEN).toBe(dslReferenceMd(fresh).trim())
  })

  it("every builder has an editor completion entry", () => {
    const completions = readFileSync(join(WEB, "src", "lib", "dsl-completions.ts"), "utf8")
    for (const b of fresh.builders) {
      expect(completions, `dsl-completions.ts is missing fn("${b.name}", …)`).toContain(
        `fn("${b.name}"`
      )
    }
  })

  it("extraction sees the props the old docs got wrong", () => {
    const wire = fresh.interfaces.find((i) => i.name === "WireProps")
    expect(wire?.props.map((p) => p.name)).toContain("currentEstimate")
    expect(wire?.props.map((p) => p.name)).not.toContain("current")
    const branch = fresh.interfaces.find((i) => i.name === "BranchProps")
    expect(branch?.props.map((p) => p.name)).toContain("path")
    expect(branch?.props.map((p) => p.name)).not.toContain("from")
    const label = fresh.interfaces.find((i) => i.name === "LabelProps")
    expect(label?.props.map((p) => p.name)).toContain("attachTo")
    expect(label?.props.map((p) => p.name)).not.toContain("position")
  })
})
