/**
 * Nerve CLI (PRD §9.7).
 *
 *   nerve init [dir]
 *   nerve compile  <file.harness.ts> [--out dir]
 *   nerve validate <file.harness.ts>
 *   nerve render   <file.harness.ts> --format svg [--out dir]
 *   nerve export   <file.harness.ts> --target manufacturing-packet [--out dir]
 *   nerve inspect  <dist/harness.json>
 *
 * Exit codes: 0 success · 1 validation errors · 2 usage/compile failure.
 * All file output is deterministic and CI-suitable.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { Effect, Exit, Cause } from "effect"
import {
  compileDesign,
  decodeHir,
  diffHir,
  formatDiff,
  hasErrors,
  isEmptyDiff,
  type Diagnostic,
  type Hir
} from "@grayhaven/nerve"
import {
  compileFile,
  type CompileFileResult
} from "@grayhaven/nerve-compiler"
import { exportWireViz, importWireViz } from "@grayhaven/nerve-wireviz"
import {
  assemblyInstructions,
  boardSvg,
  bomCsv,
  buildPacket,
  canRelease,
  cutListCsv,
  labelScheduleCsv,
  generateTestPlan,
  manufacturingPacketPdf,
  schematicSvg,
  testPlanCsv,
  testPlanJson
} from "@grayhaven/nerve-exporters"

export interface Io {
  out(line: string): void
  err(line: string): void
}

const realIo: Io = {
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n")
}

interface ParsedArgs {
  readonly command: string | undefined
  readonly positional: ReadonlyArray<string>
  readonly flags: Readonly<Record<string, string>>
}

const parseArgs = (argv: ReadonlyArray<string>): ParsedArgs => {
  const [command, ...rest] = argv
  const positional: Array<string> = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=")
      if (eq > -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1)
      } else {
        flags[arg.slice(2)] = rest[i + 1]?.startsWith("--") === false ? rest[++i]! : "true"
      }
    } else {
      positional.push(arg)
    }
  }
  return { command, positional, flags }
}

const severityLabel: Record<string, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info"
}

const printDiagnostics = (diagnostics: ReadonlyArray<Diagnostic>, io: Io): void => {
  for (const d of diagnostics) {
    const head = `${d.code} ${severityLabel[d.severity] ?? d.severity}${d.target !== undefined ? `  ${d.target}` : ""}`
    const print = d.severity === "error" ? io.err : io.out
    print(head)
    print(`  ${d.message}`)
  }
}

const summarize = (hir: Hir): string => {
  const errors = hir.diagnostics.filter((d) => d.severity === "error").length
  const warnings = hir.diagnostics.filter((d) => d.severity === "warning").length
  return `${hir.harness.id} rev ${hir.harness.revision} — ${hir.connectors.length} connectors, ${hir.wires.length} wires — ${errors} error(s), ${warnings} warning(s)`
}

const compileOrExit = async (
  file: string,
  io: Io
): Promise<CompileFileResult | number> => {
  const exit = await Effect.runPromiseExit(compileFile(file))
  if (Exit.isFailure(exit)) {
    const failure = Cause.failureOption(exit.cause)
    io.err(
      failure._tag === "Some"
        ? `CompileError: ${failure.value.message}`
        : `Unexpected failure: ${Cause.pretty(exit.cause)}`
    )
    return 2
  }
  return exit.value
}

const writeOut = (dir: string, name: string, contents: string | Uint8Array, io: Io): void => {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, contents)
  io.out(`wrote ${path}`)
}

const USAGE = `nerve — harnesses as code (Grayhaven Nerve)

Usage:
  nerve init [dir]
  nerve compile  <file.harness.ts> [--out dir]
  nerve validate <file.harness.ts>
  nerve render   <file.harness.ts> [--format svg] [--view schematic|board] [--out dir]
  nerve export   <file.harness.ts> [--target manufacturing-packet|wireviz] [--out dir]
  nerve import   <file.yml> [--id harness-id] [--out dir]   (WireViz YAML → HIR)
  nerve diff     <revA> <revB> [--json]   (each: harness.json, .harness.ts, or revision dir)
  nerve inspect  <harness.json>`

/** Resolve a diff argument to HIR: a harness.json, a .harness.ts, or a directory. */
const loadHirForDiff = async (path: string, io: Io): Promise<Hir | number> => {
  const p = resolve(path)
  if (existsSync(p) && statSync(p).isDirectory()) {
    for (const candidate of [join(p, "harness.json"), join(p, "dist", "harness.json")]) {
      if (existsSync(candidate)) return loadHirForDiff(candidate, io)
    }
    io.err(`No harness.json found in ${path} (looked in ./ and ./dist).`)
    return 2
  }
  if (p.endsWith(".json")) {
    try {
      return decodeHir(JSON.parse(readFileSync(p, "utf8")))
    } catch (cause) {
      io.err(`Failed to load ${path}: ${cause instanceof Error ? cause.message : String(cause)}`)
      return 2
    }
  }
  const result = await compileOrExit(p, io)
  return typeof result === "number" ? result : result.hir
}

export const run = async (argv: ReadonlyArray<string>, io: Io = realIo): Promise<number> => {
  const { command, positional, flags } = parseArgs(argv)

  switch (command) {
    case "compile": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      writeOut(outDir, "harness.json", JSON.stringify(result.hir, null, 2) + "\n", io)
      writeOut(outDir, "diagnostics.json", JSON.stringify(result.diagnostics, null, 2) + "\n", io)
      printDiagnostics(result.diagnostics, io)
      io.out(summarize(result.hir))
      return hasErrors(result.diagnostics) ? 1 : 0
    }

    case "validate": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      printDiagnostics(result.diagnostics, io)
      io.out(summarize(result.hir))
      return hasErrors(result.diagnostics) ? 1 : 0
    }

    case "render": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      const format = flags["format"] ?? "svg"
      if (format !== "svg") {
        io.err(`Unsupported render format: ${format} (supported: svg)`)
        return 2
      }
      const view = flags["view"] ?? "schematic"
      if (view !== "schematic" && view !== "board") {
        io.err(`Unsupported render view: ${view} (supported: schematic, board)`)
        return 2
      }
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      if (view === "board") {
        writeOut(outDir, "board.svg", boardSvg(result.hir), io)
      } else {
        writeOut(outDir, "schematic.svg", schematicSvg(result.hir), io)
      }
      return 0
    }

    case "export": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      const target = flags["target"] ?? "manufacturing-packet"
      if (target === "wireviz") {
        const result = await compileOrExit(file, io)
        if (typeof result === "number") return result
        const { yaml, diagnostics } = exportWireViz(result.hir)
        printDiagnostics(diagnostics, io)
        const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
        writeOut(outDir, "wireviz.yml", yaml, io)
        return 0
      }
      if (target !== "manufacturing-packet") {
        io.err(`Unsupported export target: ${target} (supported: manufacturing-packet, wireviz)`)
        return 2
      }
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      printDiagnostics(result.diagnostics, io)
      if (!canRelease(result.hir)) {
        io.err(
          "Export blocked: validation errors present. Release exports fail closed (PRD §15)."
        )
        return 1
      }
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      const tolerance = result.config.defaultWireTolerance
      const options = tolerance !== undefined ? { defaultWireTolerance: tolerance } : {}
      const plan = generateTestPlan(result.hir)
      writeOut(outDir, "harness.json", JSON.stringify(result.hir, null, 2) + "\n", io)
      writeOut(outDir, "schematic.svg", schematicSvg(result.hir), io)
      writeOut(outDir, "board.svg", boardSvg(result.hir), io)
      writeOut(outDir, "bom.csv", bomCsv(result.hir), io)
      writeOut(outDir, "cut-list.csv", cutListCsv(result.hir, options), io)
      writeOut(outDir, "labels.csv", labelScheduleCsv(result.hir), io)
      writeOut(outDir, "tests.csv", testPlanCsv(plan), io)
      writeOut(outDir, "test-plan.json", testPlanJson(result.hir), io)
      writeOut(outDir, "assembly-instructions.txt", assemblyInstructions(result.hir), io)
      writeOut(outDir, "manufacturing-packet.pdf", await manufacturingPacketPdf(result.hir, options), io)
      writeOut(outDir, "manufacturing-packet.zip", (await buildPacket(result.hir, options)).zip, io)
      io.out(summarize(result.hir))
      return 0
    }

    case "import": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      let result
      try {
        result = importWireViz(readFileSync(resolve(file), "utf8"), {
          ...(flags["id"] !== undefined ? { harnessId: flags["id"] } : {})
        })
      } catch (cause) {
        io.err(
          `Failed to import ${file}: ${cause instanceof Error ? cause.message : String(cause)}`
        )
        return 2
      }
      const { hir, diagnostics: structural } = compileDesign(result.design)
      const diagnostics = [...result.diagnostics, ...structural]
      const full = { ...hir, diagnostics }
      printDiagnostics(diagnostics, io)
      const outDir = resolve(flags["out"] ?? "dist")
      writeOut(outDir, "harness.json", JSON.stringify(full, null, 2) + "\n", io)
      writeOut(outDir, "diagnostics.json", JSON.stringify(diagnostics, null, 2) + "\n", io)
      io.out(summarize(full))
      return hasErrors(diagnostics) ? 1 : 0
    }

    case "diff": {
      const [pathA, pathB] = positional
      if (pathA === undefined || pathB === undefined) return usage(io)
      const a = await loadHirForDiff(pathA, io)
      if (typeof a === "number") return a
      const b = await loadHirForDiff(pathB, io)
      if (typeof b === "number") return b
      const d = diffHir(a, b)
      if (flags["json"] === "true") {
        io.out(JSON.stringify(d, null, 2))
      } else {
        io.out(formatDiff(d).trimEnd())
      }
      // git-diff convention: exit 1 when differences exist.
      return isEmptyDiff(d) ? 0 : 1
    }

    case "inspect": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      try {
        const hir = decodeHir(JSON.parse(readFileSync(resolve(file), "utf8")))
        io.out(`schema   ${hir.schemaVersion}`)
        io.out(`harness  ${hir.harness.id}`)
        io.out(`revision ${hir.harness.revision}`)
        io.out(`units    ${hir.harness.units}`)
        io.out(`connectors ${hir.connectors.length}`)
        io.out(`wires      ${hir.wires.length}`)
        io.out(`branches   ${hir.branches.length}`)
        io.out(`labels     ${hir.labels.length}`)
        io.out(`bom items  ${hir.bom.length}`)
        io.out(
          `diagnostics ${hir.diagnostics.length} (${hir.diagnostics.filter((d) => d.severity === "error").length} errors)`
        )
        return 0
      } catch (cause) {
        io.err(
          `Failed to inspect ${file}: ${cause instanceof Error ? cause.message : String(cause)}`
        )
        return 2
      }
    }

    case "init": {
      const dir = resolve(positional[0] ?? ".")
      const srcDir = join(dir, "src")
      const configPath = join(dir, "nerve.config.ts")
      const harnessPath = join(srcDir, "main.harness.ts")
      if (existsSync(configPath) || existsSync(harnessPath)) {
        io.err(`Refusing to overwrite an existing Nerve project in ${dir}.`)
        return 2
      }
      mkdirSync(srcDir, { recursive: true })
      writeFileSync(configPath, INIT_CONFIG)
      writeFileSync(harnessPath, INIT_HARNESS)
      io.out(`Initialized Nerve project in ${dir}`)
      io.out("  nerve.config.ts")
      io.out("  src/main.harness.ts")
      io.out("Next: nerve compile ./src/main.harness.ts")
      return 0
    }

    case undefined:
    case "help":
    case "--help":
      io.out(USAGE)
      return command === undefined ? 2 : 0

    default:
      io.err(`Unknown command: ${command}`)
      io.out(USAGE)
      return 2
  }
}

const usage = (io: Io): number => {
  io.err("Missing required argument.")
  io.out(USAGE)
  return 2
}

const INIT_CONFIG = `import { defineConfig } from "@grayhaven/nerve"

export default defineConfig({
  units: "mm",
  defaultWireTolerance: 10,
  outputDir: "dist",
  rules: {
    missingWireColor: "error",
    missingWireLength: "warning"
  },
  exports: { csv: true, svg: true }
})
`

const INIT_HARNESS = `import { harness, connector, wire, type ConnectorPart } from "@grayhaven/nerve"

// Replace with parts from @grayhaven/nerve-connectors as the library grows.
const genericPart: ConnectorPart = { mpn: "GENERIC-2", pinCount: 2 }

const j1 = connector("J1", genericPart, {
  pins: { 1: "PWR_12V", 2: "GND" },
})

const j2 = connector("J2", genericPart, {
  pins: { 1: "PWR_12V", 2: "GND" },
})

export default harness("my-first-harness", {
  revision: "A",
  units: "mm",
  connectors: [j1, j2],
  wires: [
    wire("W1", j1.pin(1), j2.pin(1), { gauge: "20AWG", color: "red", length: 250, signal: "PWR_12V" }),
    wire("W2", j1.pin(2), j2.pin(2), { gauge: "20AWG", color: "black", length: 250, signal: "GND" }),
  ],
})
`

export const main = (): Promise<number> => run(process.argv.slice(2))
