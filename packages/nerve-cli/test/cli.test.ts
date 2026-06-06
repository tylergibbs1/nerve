import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { run, type Io } from "@grayhaven/nerve-cli"

const FIXTURE = resolve(
  import.meta.dirname,
  "../../../examples/motor-controller/src/main.harness.ts"
)

const capture = (): Io & { stdout: Array<string>; stderr: Array<string> } => {
  const stdout: Array<string> = []
  const stderr: Array<string> = []
  return { stdout, stderr, out: (l) => stdout.push(l), err: (l) => stderr.push(l) }
}

const tmp = () => mkdtempSync(join(tmpdir(), "nerve-cli-"))

describe("nerve compile", () => {
  it("writes harness.json + diagnostics.json and exits 0 on the fixture", async () => {
    const io = capture()
    const out = tmp()
    const code = await run(["compile", FIXTURE, "--out", out], io)
    expect(code).toBe(0)
    expect(existsSync(join(out, "harness.json"))).toBe(true)
    expect(existsSync(join(out, "diagnostics.json"))).toBe(true)
    expect(io.stdout.at(-1)).toContain("motor-controller-harness rev A")
    expect(io.stdout.at(-1)).toContain("0 error(s)")
  })

  it("is deterministic: same input, same harness.json bytes", async () => {
    const a = tmp()
    const b = tmp()
    await run(["compile", FIXTURE, "--out", a], capture())
    await run(["compile", FIXTURE, "--out", b], capture())
    expect(readFileSync(join(a, "harness.json"), "utf8")).toBe(
      readFileSync(join(b, "harness.json"), "utf8")
    )
  })

  it("exits 2 with CompileError on a broken module", async () => {
    const dir = tmp()
    const bad = join(dir, "bad.harness.ts")
    writeFileSync(bad, "export default 42\n")
    const io = capture()
    expect(await run(["compile", bad, "--out", dir], io)).toBe(2)
    expect(io.stderr.join("\n")).toContain("CompileError")
  })
})

describe("nerve validate", () => {
  it("exits 0 and prints PRD-style diagnostics for the fixture", async () => {
    const io = capture()
    expect(await run(["validate", FIXTURE], io)).toBe(0)
    const text = io.stdout.join("\n")
    expect(text).toContain("HK-CONN-010 Warning")
    expect(text).toContain("HK-ELEC-004 Warning")
  })

  it("exits 1 when a design has validation errors", async () => {
    const dir = tmp()
    const bad = join(dir, "bad.harness.ts")
    const core = resolve(import.meta.dirname, "../../nerve/src/index.ts")
    writeFileSync(
      bad,
      `import { harness, connector, wire } from "${core}"
const part = { mpn: "X", pinCount: 2 }
const a = connector("J1", part, { pins: { 1: "SIG", 2: "GND" } })
const b = connector("J2", part, { pins: { 1: "SIG", 2: "GND" } })
export default harness("bad", {
  revision: "A", units: "mm",
  connectors: [a, b],
  wires: [wire("W1", a.pin(1), b.pin(1), { length: 100 })] // no color/gauge → errors
})
`
    )
    const io = capture()
    expect(await run(["validate", bad], io)).toBe(1)
    expect(io.stderr.join("\n")).toContain("HK-MFG-002 Error")
  })
})

describe("nerve render / export", () => {
  it("renders schematic.svg", async () => {
    const out = tmp()
    expect(await run(["render", FIXTURE, "--format", "svg", "--out", out], capture())).toBe(0)
    expect(readFileSync(join(out, "schematic.svg"), "utf8")).toContain("<svg")
  })

  it("rejects unsupported formats", async () => {
    const io = capture()
    expect(await run(["render", FIXTURE, "--format", "dxf"], io)).toBe(2)
  })

  it("exports the full manufacturing packet", async () => {
    const out = tmp()
    const io = capture()
    expect(await run(["export", FIXTURE, "--out", out], io)).toBe(0)
    for (const f of [
      "harness.json",
      "schematic.svg",
      "bom.csv",
      "cut-list.csv",
      "labels.csv",
      "tests.csv",
      "test-plan.json",
      "manufacturing-packet.zip"
    ]) {
      expect(existsSync(join(out, f)), f).toBe(true)
    }
  })

  it("fails closed: blocks export when errors exist", async () => {
    const dir = tmp()
    const bad = join(dir, "bad.harness.ts")
    const core = resolve(import.meta.dirname, "../../nerve/src/index.ts")
    writeFileSync(
      bad,
      `import { harness, connector, wire } from "${core}"
const part = { mpn: "X", pinCount: 2 }
const a = connector("J1", part, { pins: { 1: "SIG", 2: "GND" } })
const b = connector("J2", part, { pins: { 1: "SIG", 2: "GND" } })
export default harness("bad", {
  revision: "A", units: "mm",
  connectors: [a, b],
  wires: [wire("W1", a.pin(1), b.pin(1), { length: 100 })]
})
`
    )
    const io = capture()
    expect(await run(["export", bad, "--out", dir], io)).toBe(1)
    expect(io.stderr.join("\n")).toContain("Export blocked")
    expect(existsSync(join(dir, "manufacturing-packet.zip"))).toBe(false)
  })
})

describe("nerve inspect / init / help", () => {
  it("inspects a compiled harness.json", async () => {
    const out = tmp()
    await run(["compile", FIXTURE, "--out", out], capture())
    const io = capture()
    expect(await run(["inspect", join(out, "harness.json")], io)).toBe(0)
    const text = io.stdout.join("\n")
    expect(text).toContain("harness  motor-controller-harness")
    expect(text).toContain("connectors 2")
  })

  it("rejects an invalid harness.json", async () => {
    const dir = tmp()
    const file = join(dir, "harness.json")
    writeFileSync(file, JSON.stringify({ schemaVersion: "9.9.9" }))
    const io = capture()
    expect(await run(["inspect", file], io)).toBe(2)
  })

  it("init scaffolds a project and refuses to overwrite", async () => {
    const dir = tmp()
    const io = capture()
    expect(await run(["init", dir], io)).toBe(0)
    expect(existsSync(join(dir, "nerve.config.ts"))).toBe(true)
    expect(existsSync(join(dir, "src/main.harness.ts"))).toBe(true)
    expect(await run(["init", dir], capture())).toBe(2)
  })

  it("prints usage and exits 2 with no command", async () => {
    const io = capture()
    expect(await run([], io)).toBe(2)
    expect(io.stdout.join("\n")).toContain("Usage:")
  })
})
