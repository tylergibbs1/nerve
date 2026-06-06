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

  it("renders board.svg with --view board", async () => {
    const out = tmp()
    expect(await run(["render", FIXTURE, "--view", "board", "--out", out], capture())).toBe(0)
    expect(readFileSync(join(out, "board.svg"), "utf8")).toContain("harness board")
  })

  it("exports the full manufacturing packet", async () => {
    const out = tmp()
    const io = capture()
    expect(await run(["export", FIXTURE, "--out", out], io)).toBe(0)
    for (const f of [
      "harness.json",
      "schematic.svg",
      "board.svg",
      "bom.csv",
      "cut-list.csv",
      "labels.csv",
      "tests.csv",
      "test-plan.json",
      "assembly-instructions.txt",
      "manufacturing-packet.pdf",
      "manufacturing-packet.zip"
    ]) {
      expect(existsSync(join(out, f)), f).toBe(true)
    }
    expect(readFileSync(join(out, "manufacturing-packet.pdf")).subarray(0, 5).toString()).toBe("%PDF-")
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

describe("nerve import / export --target wireviz", () => {
  const WV_FIXTURE = resolve(
    import.meta.dirname,
    "../../nerve-wireviz/test/fixtures/motor.yml"
  )

  it("imports WireViz YAML to HIR", async () => {
    const out = tmp()
    const io = capture()
    expect(await run(["import", WV_FIXTURE, "--id", "imported", "--out", out], io)).toBe(0)
    const hir = JSON.parse(readFileSync(join(out, "harness.json"), "utf8"))
    expect(hir.harness.id).toBe("imported")
    expect(hir.wires).toHaveLength(4)
  })

  it("exports a design to WireViz YAML", async () => {
    const out = tmp()
    expect(await run(["export", FIXTURE, "--target", "wireviz", "--out", out], capture())).toBe(0)
    const yml = readFileSync(join(out, "wireviz.yml"), "utf8")
    expect(yml).toContain("connectors:")
    expect(yml).toContain("J1:")
    expect(yml).toContain("connections:")
  })
})

describe("nerve diff", () => {
  it("diffs two compiled revisions and exits 1 on differences", async () => {
    const dirA = tmp()
    const dirB = tmp()
    await run(["compile", FIXTURE, "--out", dirA], capture())
    // Rev B: bump revision and change W1 gauge in a copy of the HIR.
    const hir = JSON.parse(readFileSync(join(dirA, "harness.json"), "utf8"))
    hir.harness.revision = "B"
    hir.wires[0].gauge = "16AWG"
    mkdirSync(dirB, { recursive: true })
    writeFileSync(join(dirB, "harness.json"), JSON.stringify(hir))

    const io = capture()
    expect(await run(["diff", dirA, dirB], io)).toBe(1)
    const text = io.stdout.join("\n")
    expect(text).toContain("revision: A -> B")
    expect(text).toContain("~ wire:W1")
    expect(text).toContain("gauge: 18AWG -> 16AWG")
  })

  it("exits 0 for identical revisions and supports --json", async () => {
    const dir = tmp()
    await run(["compile", FIXTURE, "--out", dir], capture())
    const io = capture()
    expect(await run(["diff", join(dir, "harness.json"), join(dir, "harness.json"), "--json"], io)).toBe(0)
    expect(JSON.parse(io.stdout.join("\n")).pinouts).toEqual([])
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
