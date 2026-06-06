import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { Effect, Exit } from "effect"
import { compileFile, failOnErrors, loadDesign, CompileError } from "@grayhaven/nerve-compiler"

const FIXTURE = resolve(
  import.meta.dirname,
  "../../../examples/motor-controller/src/main.harness.ts"
)

describe("compileFile", () => {
  it("loads and compiles the golden fixture from disk", async () => {
    const result = await Effect.runPromise(compileFile(FIXTURE))
    expect(result.design.id).toBe("motor-controller-harness")
    expect(result.hir.harness.revision).toBe("A")
    expect(result.hir.connectors).toHaveLength(2)
    // Rule diagnostics are merged into the HIR (warnings only on the fixture).
    expect(result.diagnostics.every((d) => d.severity !== "error")).toBe(true)
    expect(result.hir.diagnostics).toEqual(result.diagnostics)
  })

  it("is deterministic across repeated compilations", async () => {
    const a = await Effect.runPromise(compileFile(FIXTURE))
    const b = await Effect.runPromise(compileFile(FIXTURE))
    expect(JSON.stringify(a.hir)).toBe(JSON.stringify(b.hir))
  })

  it("passes the fail-closed gate when there are no errors", async () => {
    const result = await Effect.runPromise(
      compileFile(FIXTURE).pipe(Effect.flatMap(failOnErrors))
    )
    expect(result.hir.harness.id).toBe("motor-controller-harness")
  })

  it("fails with ValidationError when a design has errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nerve-test-"))
    const file = join(dir, "bad.harness.ts")
    writeFileSync(
      file,
      `import { harness, connector, wire } from "${resolve(import.meta.dirname, "../../nerve/src/index.ts")}"
const part = { mpn: "X", pinCount: 2 }
const a = connector("J1", part, { pins: { 1: "SIG" } })
const b = connector("J2", part, { pins: { 1: "SIG" } })
export default harness("bad", {
  revision: "A",
  units: "mm",
  connectors: [a, b],
  wires: [
    wire("W1", a.pin(1), b.pin(1), { color: "red", length: 100 }),
    wire("W1", a.pin(1), b.pin(1), { color: "red", length: 100 })
  ]
})
`
    )
    const exit = await Effect.runPromiseExit(
      compileFile(file).pipe(Effect.flatMap(failOnErrors))
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      const error = exit.cause.error
      expect(error._tag).toBe("ValidationError")
      if (error._tag === "ValidationError") {
        expect(error.diagnostics.some((d) => d.code === "HK-WIRE-001")).toBe(true)
      }
    }
  })

  it("fails with CompileError when there is no harness default export", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nerve-test-"))
    const file = join(dir, "not-a-harness.ts")
    writeFileSync(file, "export default { hello: 'world' }\n")
    const exit = await Effect.runPromiseExit(loadDesign(file))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      expect(exit.cause.error).toBeInstanceOf(CompileError)
      expect(exit.cause.error.message).toContain("does not default-export")
    }
  })
})
