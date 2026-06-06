import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { compileFile } from "@grayhaven/nerve-compiler"

const CORE = resolve(import.meta.dirname, "../../nerve/src/index.ts")

const scaffold = (pluginBody: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "nerve-plugin-"))
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t", type: "module" }))
  writeFileSync(join(dir, "rules.plugin.ts"), pluginBody)
  writeFileSync(
    join(dir, "nerve.config.ts"),
    `import { defineConfig } from "${CORE}"\nexport default defineConfig({ plugins: ["./rules.plugin.ts"] })\n`
  )
  writeFileSync(
    join(dir, "main.harness.ts"),
    `import { harness, connector, wire } from "${CORE}"
const part = { mpn: "X", pinCount: 2 }
const a = connector("J1", part, { pins: { 1: "SIG", 2: "GND" } })
const b = connector("J2", part, { pins: { 1: "SIG", 2: "GND" } })
export default harness("plugged", {
  revision: "A", units: "mm",
  connectors: [a, b],
  wires: [
    wire("W1", a.pin(1), b.pin(1), { gauge: "24AWG", color: "red", length: 99, signal: "SIG" }),
    wire("W2", a.pin(2), b.pin(2), { gauge: "24AWG", color: "black", length: 99, signal: "GND" })
  ]
})
`
  )
  return join(dir, "main.harness.ts")
}

describe("plugin SDK (PRD §40)", () => {
  it("loads a rule-pack plugin from config and runs its rules", async () => {
    const file = scaffold(
      `import { definePlugin, rule, HIR_SCHEMA_VERSION } from "${CORE}"
export default definePlugin({
  name: "org-standards",
  version: "1.0.0",
  hirSchemaVersions: [HIR_SCHEMA_VERSION],
  rules: [
    rule("no-odd-lengths", (ctx) => {
      for (const w of ctx.hir.wires) {
        if (w.length !== undefined && w.length % 2 !== 0) {
          ctx.report({ severity: "warning", message: \`Wire \${w.id} has odd length \${w.length}.\`, target: \`wire:\${w.id}\` })
        }
      }
    }, { code: "ORG-001" })
  ]
})
`
    )
    const result = await Effect.runPromise(compileFile(file))
    const orgDiags = result.diagnostics.filter((d) => d.code === "ORG-001")
    expect(orgDiags).toHaveLength(2) // both 99mm wires
    expect(orgDiags[0]?.message).toContain("odd length 99")
  })

  it("refuses plugins declaring an unsupported HIR schema version", async () => {
    const file = scaffold(
      `import { definePlugin } from "${CORE}"
export default definePlugin({ name: "stale-pack", hirSchemaVersions: ["0.0.1"], rules: [] })
`
    )
    const result = await Effect.runPromise(compileFile(file))
    const diag = result.diagnostics.find((d) => d.code === "HK-PLUGIN-001")
    expect(diag?.severity).toBe("error")
    expect(diag?.message).toContain("stale-pack")
  })
})
