/**
 * `nerve snapshot` (PRD §41 discipline as a user-facing feature): committed
 * visual snapshots for customer harness repos — the PR diff shows the
 * drawing changing, not just the TypeScript.
 *
 * Because every renderer is byte-deterministic, comparison is EXACT
 * (Buffer.equals) where tscircuit needs pixel tolerance. Snapshots are
 * `__snapshots__/<name>-<view>.snap.svg` next to each harness file:
 *
 *   nerve snapshot               # compare (files from config), exit 1 on drift
 *   nerve snapshot --update      # rewrite snapshots deliberately
 *   nerve snapshot --ci          # on drift, also write PNG diff artifacts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { Cause, Effect, Exit } from "effect"
import { compileFile } from "@grayhaven/nerve-compiler"
import { boardSvg, connectorFacesSvg, pinoutSvg, schematicSvg } from "@grayhaven/nerve-exporters"
import type { Io } from "./index.js"

const VIEWS = [
  ["schematic", schematicSvg],
  ["board", boardSvg],
  ["faces", connectorFacesSvg],
  ["pinout", pinoutSvg]
] as const

const snapName = (file: string): string =>
  basename(file).replace(/\.harness\.(ts|tsx|js)$/, "").replace(/\.(ts|tsx|js)$/, "")

/** Render both sides fonts-disabled (the cross-machine determinism key) and write a pixel diff. */
const writePngDiff = async (
  expectedSvg: string,
  actualSvg: string,
  outPath: string
): Promise<number | undefined> => {
  try {
    const { Resvg } = await import("@resvg/resvg-js")
    const { PNG } = await import("pngjs")
    const pixelmatch = (await import("pixelmatch")).default
    const render = (svg: string) =>
      PNG.sync.read(
        Buffer.from(
          new Resvg(svg, {
            font: { loadSystemFonts: false },
            fitTo: { mode: "width", value: 1200 }
          })
            .render()
            .asPng()
        )
      )
    const a = render(expectedSvg)
    const b = render(actualSvg)
    if (a.width !== b.width || a.height !== b.height) return undefined
    const diff = new PNG({ width: a.width, height: a.height })
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.05 })
    writeFileSync(outPath, PNG.sync.write(diff))
    return n
  } catch {
    return undefined
  }
}

export const runSnapshot = async (
  files: ReadonlyArray<string>,
  flags: Readonly<Record<string, string>>,
  io: Io
): Promise<number> => {
  const update = flags["update"] !== undefined
  const ci = flags["ci"] !== undefined
  let drifted = 0
  let written = 0
  let checked = 0

  for (const file of files) {
    const entry = resolve(file)
    // fresh: snapshot is a one-shot command, and embedders (tests, future
    // watch integrations) must never compare against a stale module.
    const exit = await Effect.runPromiseExit(compileFile(entry, { fresh: true }))
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      io.err(
        `CompileError: ${failure._tag === "Some" ? failure.value.message : Cause.pretty(exit.cause)}`
      )
      return 2
    }
    const { hir } = exit.value
    const snapDir = join(dirname(entry), "__snapshots__")
    const name = snapName(entry)

    for (const [view, render] of VIEWS) {
      const actual = render(hir)
      const snapPath = join(snapDir, `${name}-${view}.snap.svg`)
      const existed = existsSync(snapPath)
      // In --ci a MISSING snapshot is a failure, never a silent
      // write-and-pass: otherwise a CI repo that never committed
      // __snapshots__/ is green-by-creation forever (the gate enforces
      // nothing). Auto-write only on local / --update runs.
      if (!existed && ci && !update) {
        drifted += 1
        io.err(`✗ ${name}-${view}: no committed snapshot — run \`nerve snapshot\` locally and commit ${snapPath}`)
        continue
      }
      if (!existed || update) {
        mkdirSync(snapDir, { recursive: true })
        writeFileSync(snapPath, actual)
        written += 1
        io.out(`${existed ? "updated" : "wrote"} ${snapPath}`)
        continue
      }
      checked += 1
      const expected = readFileSync(snapPath)
      if (Buffer.from(actual).equals(expected)) continue
      drifted += 1
      io.err(`✗ ${name}-${view}: drawing changed vs ${snapPath}`)
      if (ci) {
        const diffPath = join(snapDir, `${name}-${view}.diff.png`)
        const pixels = await writePngDiff(expected.toString("utf8"), actual, diffPath)
        if (pixels !== undefined) io.err(`  ${pixels} pixels differ — inspect ${diffPath}`)
        else io.err(`  dimensions changed — render both sides to compare`)
      }
    }
  }

  if (drifted > 0) {
    io.err(`${drifted} snapshot(s) drifted or missing. If intentional, run with --update to fix.`)
    return 1
  }
  io.out(
    update || written > 0
      ? `${written} snapshot(s) written, ${checked} checked.`
      : `${checked} snapshot(s) match.`
  )
  return 0
}
