import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
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
    expect(text).toContain("gauge: 20AWG -> 16AWG")
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

describe("config-driven entrypoint + exports toggles", () => {
  // Inside the repo tree (not os tmp): the scaffolded harness imports
  // @grayhaven/nerve, which must resolve through the workspace.
  const project = (config: string): string => {
    const dir = mkdtempSync(join(import.meta.dirname, "tmp-entry-"))
    mkdirSync(join(dir, "src"), { recursive: true })
    writeFileSync(join(dir, "nerve.config.ts"), config)
    writeFileSync(
      join(dir, "src", "main.harness.ts"),
      readFileSync(FIXTURE, "utf8")
    )
    return dir
  }

  const inDir = async <T>(dir: string, fn: () => Promise<T>): Promise<T> => {
    const prev = process.cwd()
    process.chdir(dir)
    try {
      return await fn()
    } finally {
      process.chdir(prev)
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it("nerve compile runs bare via config.entry", async () => {
    const dir = project(
      `export default { entry: "./src/main.harness.ts", outputDir: "dist" }\n`
    )
    await inDir(dir, async () => {
      const io = capture()
      expect(await run(["compile"], io)).toBe(0)
      expect(existsSync(join(dir, "dist", "harness.json"))).toBe(true)
    })
  })

  it("without entry, bare compile still prints usage", async () => {
    const dir = project(`export default { outputDir: "dist" }\n`)
    await inDir(dir, async () => {
      const io = capture()
      expect(await run(["compile"], io)).toBe(2)
      expect(io.stdout.join("\n")).toContain("Usage:")
    })
  })

  it("config.exports toggles filter loose files; the zip stays complete", async () => {
    const dir = project(
      `export default { entry: "./src/main.harness.ts", exports: { csv: false, svg: false, pdf: true } }\n`
    )
    await inDir(dir, async () => {
      const out = join(dir, "packet")
      expect(await run(["export", "--out", out], capture())).toBe(0)
      expect(existsSync(join(out, "manufacturing-packet.pdf"))).toBe(true)
      expect(existsSync(join(out, "manufacturing-packet.zip"))).toBe(true)
      expect(existsSync(join(out, "harness.json"))).toBe(true)
      expect(existsSync(join(out, "bom.csv"))).toBe(false)
      expect(existsSync(join(out, "schematic.svg"))).toBe(false)
    })
  })
})

describe("nerve snapshot", () => {
  const project = (): { dir: string; harness: string } => {
    const dir = mkdtempSync(join(import.meta.dirname, "tmp-snap-"))
    mkdirSync(join(dir, "src"), { recursive: true })
    const harness = join(dir, "src", "main.harness.ts")
    writeFileSync(harness, readFileSync(FIXTURE, "utf8"))
    return { dir, harness }
  }

  it("writes snapshots on first run, matches on second, drifts on change, --update fixes", async () => {
    const { dir, harness } = project()
    try {
      // First run: writes all four views.
      let io = capture()
      expect(await run(["snapshot", harness], io)).toBe(0)
      const snapDir = join(dir, "src", "__snapshots__")
      for (const view of ["schematic", "board", "faces", "pinout"]) {
        expect(existsSync(join(snapDir, `main-${view}.snap.svg`)), view).toBe(true)
      }
      // Second run: byte-exact match.
      io = capture()
      expect(await run(["snapshot", harness], io)).toBe(0)
      expect(io.stdout.join("\n")).toContain("4 snapshot(s) match")
      // Change the design: drift, exit 1, message points at --update.
      writeFileSync(
        harness,
        readFileSync(harness, "utf8").replace('revision: "A"', 'revision: "B"')
      )
      io = capture()
      expect(await run(["snapshot", harness], io)).toBe(1)
      expect(io.stderr.join("\n")).toContain("--update to fix")
      // --update: rewrites, next run clean.
      expect(await run(["snapshot", harness, "--update"], capture())).toBe(0)
      expect(await run(["snapshot", harness], capture())).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60000)

  it("--ci writes a pixel-diff artifact on drift", async () => {
    const { dir, harness } = project()
    try {
      expect(await run(["snapshot", harness], capture())).toBe(0)
      writeFileSync(
        harness,
        readFileSync(harness, "utf8").replace('revision: "A"', 'revision: "B"')
      )
      const io = capture()
      expect(await run(["snapshot", harness, "--ci"], io)).toBe(1)
      expect(existsSync(join(dir, "src", "__snapshots__", "main-schematic.diff.png"))).toBe(true)
      expect(io.stderr.join("\n")).toContain("pixels differ")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60000)
})

describe("nerve parts", () => {
  it("lists the bundled library with specs", async () => {
    const io = capture()
    expect(await run(["parts"], io)).toBe(0)
    const text = io.stdout.join("\n")
    expect(text).toContain("compact specs:")
    expect(text).toContain("PHR-3 (ph-3)")
    expect(text).toContain("DT06-4S (dt-4s)")
  })

  it("describes one part by spec or MPN, including limits", async () => {
    const io = capture()
    expect(await run(["parts", "ph-3"], io)).toBe(0)
    const text = io.stdout.join("\n")
    expect(text).toContain("mpn        PHR-3")
    expect(text).toContain("current    2A")
  })

  it("emits JSON for agents/CI", async () => {
    const io = capture()
    expect(await run(["parts", "--json"], io)).toBe(0)
    const rows = JSON.parse(io.stdout.join("\n")) as Array<{ mpn: string; specs: string[] }>
    expect(rows.length).toBeGreaterThanOrEqual(21)
    expect(rows.find((r) => r.mpn === "PHR-3")?.specs).toContain("ph-3")
  })

  it("exits 2 on unknown parts", async () => {
    const io = capture()
    expect(await run(["parts", "nope-99"], io)).toBe(2)
    expect(io.stderr.join("\n")).toContain('Unknown part "nope-99"')
  })
})

const ROBOT = resolve(import.meta.dirname, "../../../examples/robot-platform/src/main.harness.ts")

describe("nerve analyze / quote", () => {
  it("analyze writes csv + json engineering analysis", async () => {
    const out = tmp()
    const io = capture()
    expect(await run(["analyze", FIXTURE, "--out", out], io)).toBe(0)
    expect(existsSync(join(out, "analysis.csv"))).toBe(true)
    expect(JSON.parse(readFileSync(join(out, "analysis.json"), "utf8"))).toBeTruthy()
  })

  it("quote uses the project costing model and is deterministic", async () => {
    const outA = tmp()
    const outB = tmp()
    expect(await run(["quote", ROBOT, "--out", outA], capture())).toBe(0)
    expect(await run(["quote", ROBOT, "--out", outB], capture())).toBe(0)
    const a = readFileSync(join(outA, "quote.csv"), "utf8")
    expect(a).toBe(readFileSync(join(outB, "quote.csv"), "utf8"))
    expect(a).toContain("connector,43025")
  })

  it("quote exits 2 with guidance when no costing model is configured", async () => {
    const io = capture()
    expect(await run(["quote", FIXTURE, "--out", tmp()], io)).toBe(2)
    expect(io.stderr.join("\n")).toContain("costing")
  })
})

describe("nerve machine", () => {
  it("generates shop-floor files through a builtin adapter", async () => {
    const out = tmp()
    const io = capture()
    expect(await run(["machine", "generic-cut-strip-csv", FIXTURE, "--out", out], io)).toBe(0)
    const written = io.stdout.filter((l) => l.startsWith("wrote"))
    expect(written.length).toBeGreaterThan(0)
  })

  it("names available adapters on an unknown id", async () => {
    const io = capture()
    expect(await run(["machine", "nope", FIXTURE], io)).toBe(2)
    expect(io.stderr.join("\n")).toContain("generic-cut-strip-csv")
  })
})

describe("nerve contract", () => {
  it("exports a connector contract and validates the design against it (round-trip)", async () => {
    const out = tmp()
    expect(await run(["contract", FIXTURE, "--connector", "J1", "--out", out], capture())).toBe(0)
    const contractPath = join(out, "contract-J1.json")
    expect(existsSync(contractPath)).toBe(true)
    const io = capture()
    expect(await run(["contract", FIXTURE, "--connector", "J1", "--against", contractPath], io)).toBe(0)
    expect(io.stdout.join("\n")).toContain("conforms")
  })

  it("exits 2 for an unknown connector", async () => {
    const io = capture()
    expect(await run(["contract", FIXTURE, "--connector", "J9", "--out", tmp()], io)).toBe(2)
  })
})

describe("nerve release / record", () => {
  it("creates a release, then a passing build record against it", async () => {
    const out = tmp()
    const io = capture()
    expect(
      await run(
        ["release", FIXTURE, "--eco", "ECO-1", "--reason", "initial", "--date", "2026-06-07", "--out", out],
        io
      )
    ).toBe(0)
    expect(io.stdout.join("\n")).toContain("fingerprint")
    const releasePath = join(out, "release-A.json")
    expect(existsSync(releasePath)).toBe(true)

    // Measurements for every continuity test: closed at 0.2 ohm.
    const plan = JSON.parse(readFileSync(join(out, "harness.json"), "utf8"))
    expect(plan.harness.id).toBe("motor-controller-harness")
    const testPlan = JSON.parse(
      readFileSync(join(out, "..", "x", "..").replace(/.*/, join(out, "harness.json")), "utf8")
    )
    void testPlan
    const resultsPath = join(out, "results.json")
    writeFileSync(resultsPath, JSON.stringify([{ id: "T-001", measuredOhms: 0.2 }]) + "\n")
    const rio = capture()
    const code = await run(
      [
        "record", FIXTURE,
        "--release", releasePath,
        "--serial", "SN-0001",
        "--operator", "tg",
        "--date", "2026-06-07",
        "--results", resultsPath,
        "--out", out
      ],
      rio
    )
    expect(code).toBe(0)
    expect(existsSync(join(out, "build-record-SN-0001.json"))).toBe(true)
    expect(rio.stdout.join("\n")).toMatch(/SN-0001: \d+ pass \/ 0 fail/)
  })

  it("release diffs against a previous release and reports impact", async () => {
    const prev = tmp()
    await run(["release", FIXTURE, "--eco", "ECO-1", "--reason", "initial", "--date", "2026-06-07", "--out", prev], capture())
    const io = capture()
    expect(
      await run(
        [
          "release", FIXTURE,
          "--eco", "ECO-2", "--reason", "respin", "--date", "2026-06-08",
          "--against", join(prev, "release-A.json"),
          "--out", tmp()
        ],
        io
      )
    ).toBe(0)
    expect(io.stdout.join("\n")).toContain("impact")
  })
})

describe("nerve redline", () => {
  it("adds a redline against a valid target, rejects an invalid one, then resolves", async () => {
    const dir = tmp()
    const redlines = join(dir, "redlines.json")
    const add = capture()
    expect(
      await run(
        [
          "redline", "add", FIXTURE,
          "--target", "wire:W1",
          "--type", "length",
          "--description", "W1 runs 30mm short on the bench",
          "--file", redlines
        ],
        add
      )
    ).toBe(0)
    expect(add.stdout.join("\n")).toContain("RL-001")

    const bad = capture()
    expect(
      await run(
        ["redline", "add", FIXTURE, "--target", "wire:W99", "--type", "length", "--description", "x", "--file", redlines],
        bad
      )
    ).toBe(1)

    const res = capture()
    expect(
      await run(
        ["redline", "resolve", redlines, "--id", "RL-001", "--accept", "true", "--reason", "confirmed", "--date", "2026-06-08"],
        res
      )
    ).toBe(0)
    expect(res.stdout.join("\n")).toContain("accepted")
    const final = JSON.parse(readFileSync(redlines, "utf8"))
    expect(final[0].status).toBe("accepted")
  })
})
