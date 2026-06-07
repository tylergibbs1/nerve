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
  connectorFacesSvg,
  assemblyInstructions,
  boardSvg,
  bomCsv,
  bopCsv,
  bopJson,
  analysisCsv,
  analysisJson,
  analyzeHarness,
  builtinAdapters,
  buildRecordJson,
  contractJson,
  createBuildRecord,
  createRedline,
  createRelease,
  formboardSheets,
  releaseJson,
  ReleaseBlockedError,
  resolveRedline,
  suggestPatch,
  validateRedlineTarget,
  exportConnectorContract,
  findAdapter,
  generateQuote,
  importPinoutCsv,
  exportTscircuitCircuitJson,
  importTscircuitPinout,
  quoteCsv,
  quoteJson,
  validateContract,
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

const writeOutBytes = (dir: string, name: string, bytes: Uint8Array, io: Io): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), bytes)
  io.out(`wrote ${join(dir, name)}`)
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
  nerve render   <file.harness.ts> [--format svg] [--view schematic|board|formboard] [--paper letter|a4] [--out dir]
  nerve export   <file.harness.ts> [--target manufacturing-packet|wireviz] [--out dir]
  nerve import   <file.yml> [--id harness-id] [--out dir]   (WireViz YAML → HIR)
  nerve quote    <file.harness.ts> [--out dir]   (requires costing in nerve.config.ts)
  nerve analyze  <file.harness.ts> [--out dir]   (resistance, drop, bundle, weight §34)
  nerve machine  <adapter-id> <file.harness.ts> [--out dir]   (shop-floor exports §31)
  nerve contract <file.harness.ts> --connector <ref> [--against contract.json|pinout.csv] [--out dir]
  nerve release  <file.harness.ts> --eco <id> --reason <text> --date <iso> [--against release.json] [--out dir]
  nerve record   <file.harness.ts> --release <release.json> --serial <sn> --operator <name> --date <iso> --results <measurements.json> [--out dir]
  nerve redline  add <file.harness.ts> --target <hir-ref> --type <type> --description <text> [--value v] [--release id] [--serial sn]
  nerve redline  resolve <redlines.json> --id <id> --accept|--reject --reason <text> --date <iso>
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
      if (format !== "svg" && format !== "png") {
        io.err(`Unsupported render format: ${format} (supported: svg, png)`)
        return 2
      }
      const view = flags["view"] ?? "schematic"
      if (view !== "schematic" && view !== "board" && view !== "faces" && view !== "formboard") {
        io.err(`Unsupported render view: ${view} (supported: schematic, board, faces, formboard)`)
        return 2
      }
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      if (view === "formboard") {
        const paper = flags["paper"] === "a4" ? "a4" as const : "letter" as const
        const board = formboardSheets(result.hir, { paper })
        for (const sheet of board.sheets) writeOut(outDir, sheet.name, sheet.svg, io)
        io.out(
          `formboard ${board.boardWidthMm}x${board.boardHeightMm} mm → ${board.rows}x${board.cols} ${paper} sheet(s) at 1:1. Print at 100% and verify the calibration ruler.`
        )
        return 0
      }
      const svg =
        view === "board"
          ? boardSvg(result.hir)
          : view === "faces"
            ? connectorFacesSvg(result.hir)
            : schematicSvg(result.hir)
      const base = view === "schematic" ? "schematic" : view === "faces" ? "connector-faces" : "board"
      if (format === "png") {
        // PNG preview (PRD §9.8): native resvg lives in the CLI only — the
        // exporters package stays browser-clean.
        const { Resvg } = await import("@resvg/resvg-js")
        const png = new Resvg(svg, { fitTo: { mode: "width", value: 1600 } }).render().asPng()
        writeOutBytes(outDir, `${base}.png`, png, io)
      } else {
        writeOut(outDir, `${base}.svg`, svg, io)
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
      const options = {
        ...(tolerance !== undefined ? { defaultWireTolerance: tolerance } : {}),
        ...(result.config.costing !== undefined ? { costing: result.config.costing } : {})
      }
      // The packet IS the artifact list (PRD §9.8): write every file it
      // contains as loose output too — one source of truth, no second
      // hand-maintained list to drift (the pre-0.5.2 list silently lacked
      // connector faces, the HTML viewer, and the JSON satellites).
      const packet = await buildPacket(result.hir, options)
      for (const [name, contents] of packet.files) {
        writeOut(outDir, name, contents, io)
      }
      writeOut(outDir, "manufacturing-packet.zip", packet.zip, io)
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

    case "quote": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      const model = result.config.costing
      if (model === undefined) {
        io.err("No costing model: add `costing: { laborRatePerHour, ... }` to nerve.config.ts (PRD §29).")
        return 2
      }
      const quote = generateQuote(result.hir, model)
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      writeOut(outDir, "quote.csv", quoteCsv(result.hir, model), io)
      writeOut(outDir, "quote.json", quoteJson(result.hir, model), io)
      io.out(
        `${quote.harness.id} rev ${quote.harness.revision} — material ${quote.materialCost.toFixed(2)} + scrap ${quote.scrapCost.toFixed(2)} + labor ${quote.laborCost.toFixed(2)} = ${quote.totalCost.toFixed(2)} ${quote.currency} (${quote.perUnitCost.toFixed(2)}/unit @ ${(quote.assumptions.yield * 100).toFixed(0)}% yield)`
      )
      for (const mpn of quote.longLeadItems) io.out(`LONG-LEAD: ${mpn}`)
      for (const mpn of quote.lifecycleRisks) io.out(`LIFECYCLE: ${mpn}`)
      for (const item of quote.unpricedItems) io.out(`UNPRICED: ${item}`)
      return 0
    }

    case "analyze": {
      const file = positional[0]
      if (file === undefined) return usage(io)
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      const report = analyzeHarness(result.hir)
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      writeOut(outDir, "analysis.csv", analysisCsv(result.hir), io)
      writeOut(outDir, "analysis.json", analysisJson(result.hir), io)
      io.out(
        `${report.harness.id} rev ${report.harness.revision} — ${report.totals.wireLengthM} m wire, ~${report.totals.estimatedWeightG} g, ${report.branches.map((b) => `${b.id}: Ø${b.bundleDiameterMm}mm`).join(", ")}`
      )
      return 0
    }

    case "machine": {
      const [adapterId, file] = positional
      if (adapterId === undefined || file === undefined) return usage(io)
      const adapter = findAdapter(adapterId)
      if (adapter === undefined) {
        io.err(`Unknown adapter: ${adapterId}. Available: ${builtinAdapters.map((a) => a.id).join(", ")}`)
        return 2
      }
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      const { files, diagnostics } = adapter.generate(result.hir)
      printDiagnostics(diagnostics, io)
      if (hasErrors(diagnostics)) return 1
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      for (const [name, contents] of files) writeOut(outDir, name, contents, io)
      return 0
    }

    case "contract": {
      const file = positional[0]
      const connectorRef = flags["connector"]
      if (file === undefined || connectorRef === undefined) return usage(io)
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      const against = flags["against"]
      if (against !== undefined) {
        let contract
        try {
          const raw = readFileSync(resolve(against), "utf8")
          if (against.endsWith(".csv")) {
            contract = importPinoutCsv(raw, { connector: connectorRef })
          } else if (against.endsWith(".circuit.json")) {
            // PRD §37: validate the harness against a tscircuit board.
            contract = importTscircuitPinout(JSON.parse(raw), {
              connector: connectorRef,
              ...(flags["component"] !== undefined ? { component: flags["component"] } : {})
            })
            if (contract === undefined) {
              io.err(`Component ${flags["component"] ?? connectorRef} not found in ${against}.`)
              return 2
            }
          } else {
            contract = JSON.parse(raw)
          }
        } catch (cause) {
          io.err(`Failed to load contract ${against}: ${cause instanceof Error ? cause.message : String(cause)}`)
          return 2
        }
        const diagnostics = validateContract(result.hir, contract)
        printDiagnostics(diagnostics, io)
        io.out(
          diagnostics.length === 0
            ? `Connector ${connectorRef} conforms to ${against}.`
            : `${diagnostics.length} contract issue(s) for ${connectorRef}.`
        )
        return hasErrors(diagnostics) ? 1 : 0
      }
      const contract = exportConnectorContract(result.hir, connectorRef)
      if (contract === undefined) {
        io.err(`Connector ${connectorRef} not found in ${result.hir.harness.id}.`)
        return 2
      }
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      if (flags["format"] === "circuit-json") {
        // PRD §37 reverse direction: hand tscircuit the harness side.
        writeOut(
          outDir,
          `${connectorRef}.circuit.json`,
          JSON.stringify(exportTscircuitCircuitJson(result.hir, connectorRef), null, 2) + "\n",
          io
        )
        return 0
      }
      writeOut(outDir, `contract-${connectorRef}.json`, contractJson(contract), io)
      return 0
    }

    case "release": {
      const file = positional[0]
      const eco = flags["eco"]
      const reason = flags["reason"]
      const date = flags["date"]
      if (file === undefined || eco === undefined || reason === undefined || date === undefined) return usage(io)
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      let previous
      if (flags["against"] !== undefined) {
        try {
          const prevRelease = JSON.parse(readFileSync(resolve(flags["against"]), "utf8"))
          const prevDir = resolve(flags["against"], "..")
          const prevHir = decodeHir(JSON.parse(readFileSync(join(prevDir, "harness.json"), "utf8")))
          previous = { hir: prevHir, releaseId: prevRelease.releaseId }
        } catch (cause) {
          io.err(`Failed to load previous release: ${cause instanceof Error ? cause.message : String(cause)}`)
          return 2
        }
      }
      try {
        const release = createRelease(result.hir, {
          eco: { id: eco, reason, ...(flags["author"] !== undefined ? { author: flags["author"] } : {}) },
          createdAt: date,
          ...(previous !== undefined ? { previous } : {})
        })
        const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
        writeOut(outDir, "harness.json", JSON.stringify(result.hir, null, 2) + "\n", io)
        writeOut(outDir, `release-${result.hir.harness.revision}.json`, releaseJson(release), io)
        io.out(
          `Release ${release.releaseId} (${eco}) — fingerprint ${release.hirFingerprint}` +
            (release.impact !== undefined
              ? ` — impact: ${release.impact.riskScore} (${release.impact.risk}), ${release.impact.pinoutChanges} pinout / ${release.impact.wireChanges} wire change(s)`
              : "")
        )
        return 0
      } catch (cause) {
        if (cause instanceof ReleaseBlockedError) {
          io.err(cause.message)
          return 1
        }
        throw cause
      }
    }

    case "record": {
      const file = positional[0]
      const releasePath = flags["release"]
      const serial = flags["serial"]
      const operator = flags["operator"]
      const date = flags["date"]
      const resultsPath = flags["results"]
      if (file === undefined || releasePath === undefined || serial === undefined || operator === undefined || date === undefined || resultsPath === undefined) {
        return usage(io)
      }
      const result = await compileOrExit(file, io)
      if (typeof result === "number") return result
      let release, measurements
      try {
        release = JSON.parse(readFileSync(resolve(releasePath), "utf8"))
        measurements = JSON.parse(readFileSync(resolve(resultsPath), "utf8"))
      } catch (cause) {
        io.err(`Failed to load inputs: ${cause instanceof Error ? cause.message : String(cause)}`)
        return 2
      }
      const record = createBuildRecord(result.hir, release, measurements, {
        serial,
        operator,
        buildDate: date,
        ...(flags["lot"] !== undefined ? { lot: flags["lot"] } : {}),
        ...(flags["workstation"] !== undefined ? { workstation: flags["workstation"] } : {})
      })
      const outDir = resolve(flags["out"] ?? result.config.outputDir ?? "dist")
      writeOut(outDir, `build-record-${serial}.json`, buildRecordJson(record), io)
      io.out(
        `${serial}: ${record.summary.pass} pass / ${record.summary.fail} fail / ${record.summary.notRun} not run → ${record.summary.status.toUpperCase()}`
      )
      return record.summary.status === "fail" ? 1 : 0
    }

    case "redline": {
      const sub = positional[0]
      if (sub === "add") {
        const file = positional[1]
        const target = flags["target"]
        const type = flags["type"]
        const description = flags["description"]
        if (file === undefined || target === undefined || type === undefined || description === undefined) return usage(io)
        const result = await compileOrExit(file, io)
        if (typeof result === "number") return result
        const invalid = validateRedlineTarget(result.hir, target)
        if (invalid !== undefined) {
          printDiagnostics([invalid], io)
          return 1
        }
        const redlinesPath = resolve(flags["file"] ?? "redlines.json")
        const existing = existsSync(redlinesPath)
          ? (JSON.parse(readFileSync(redlinesPath, "utf8")) as Array<unknown>)
          : []
        const redline = createRedline({
          id: `RL-${String(existing.length + 1).padStart(3, "0")}`,
          target,
          type: type as never,
          description,
          ...(flags["value"] !== undefined ? { proposedValue: flags["value"] } : {}),
          release: flags["release"] ?? `${result.hir.harness.id}@${result.hir.harness.revision}`,
          ...(flags["serial"] !== undefined ? { serial: flags["serial"] } : {}),
          ...(flags["by"] !== undefined ? { reportedBy: flags["by"] } : {})
        })
        writeFileSync(redlinesPath, JSON.stringify([...existing, redline], null, 2) + "\n")
        io.out(`Recorded ${redline.id} against ${target} in ${redlinesPath}`)
        return 0
      }
      if (sub === "resolve") {
        const redlinesPath = positional[1]
        const id = flags["id"]
        const reason = flags["reason"]
        const date = flags["date"]
        const accept = flags["accept"] === "true"
        const reject = flags["reject"] === "true"
        if (redlinesPath === undefined || id === undefined || reason === undefined || date === undefined || accept === reject) return usage(io)
        const redlines = JSON.parse(readFileSync(resolve(redlinesPath), "utf8")) as Array<never>
        const existing = redlines.find((r: { id: string }) => r.id === id)
        const index = redlines.findIndex((r: { id: string }) => r.id === id)
        if (existing === undefined) {
          io.err(`Redline ${id} not found in ${redlinesPath}.`)
          return 2
        }
        const resolved = resolveRedline(existing, {
          accept,
          reason,
          resolvedAt: date,
          ...(flags["by"] !== undefined ? { by: flags["by"] } : {})
        })
        const updated = [...redlines]
        updated[index] = resolved as never
        writeFileSync(resolve(redlinesPath), JSON.stringify(updated, null, 2) + "\n")
        io.out(`${id} ${resolved.status}.`)
        if (resolved.status === "accepted") {
          const patch = suggestPatch(resolved)
          if (patch !== undefined) {
            io.out("Structured patch (apply via variant() or edit the source):")
            io.out(JSON.stringify(patch, null, 2))
          }
        }
        return 0
      }
      return usage(io)
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
