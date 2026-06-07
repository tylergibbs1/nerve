/**
 * Compile worker (PRD §9.5, §13, §14): compilation, validation, and
 * render-prep run off the main thread so the UI stays responsive.
 *
 * Two modes:
 *  - bundled: compile a statically bundled example design,
 *  - source (§9.6): transform user-authored TypeScript with sucrase and
 *    evaluate it here — inside the worker, away from the DOM — with a
 *    require() shim that only exposes the Nerve libraries.
 */
// sucrase (~200KB) loads lazily on the first source-mode compile; the
// bundled-example path never pays for it.
import {
  branch,
  cable,
  Codes,
  compileDesign,
  connector,
  defineConfig,
  definePlugin,
  DiagnosticSeverity,
  diffHir,
  endpointLabel,
  formatDiff,
  harness,
  hasErrors,
  HIR_SCHEMA_VERSION,
  isEmptyDiff,
  isNervePlugin,
  isPinEndpoint,
  label,
  refs,
  rule,
  runRules,
  splice,
  variant,
  wire,
  type HarnessDesign
} from "@grayhaven/nerve"
import * as connectorsModule from "@grayhaven/nerve-connectors"
import { builtinRules } from "@grayhaven/nerve-rules"
import { boardSvg, generateTestPlan, schematicSvg } from "@grayhaven/nerve-exporters"
import motorController from "@grayhaven/example-motor-controller"
import sensorSplice from "@grayhaven/example-sensor-splice"
import robotPlatform from "@grayhaven/example-robot-platform"
import type { CompileRequest, CompileResponse } from "../lib/compile-types.js"

const designs: Readonly<Record<string, HarnessDesign>> = {
  "motor-controller": motorController,
  "sensor-splice": sensorSplice,
  "robot-platform": robotPlatform
}

/** Modules visible to editor-authored code. The nerve surface is a curated
 * named-import object (not `import *`): a namespace import would mark the
 * barrel's Effect Schema codecs as used and drag ~160KB of effect into the
 * worker. Everything except decodeHir/encodeHir/Hir codecs is exposed. */
const SANDBOX_MODULES: Readonly<Record<string, unknown>> = {
  "@grayhaven/nerve": {
    branch,
    cable,
    Codes,
    compileDesign,
    connector,
    defineConfig,
    definePlugin,
    DiagnosticSeverity,
    diffHir,
    endpointLabel,
    formatDiff,
    harness,
    hasErrors,
    HIR_SCHEMA_VERSION,
    isEmptyDiff,
    isNervePlugin,
    isPinEndpoint,
    label,
    refs,
    rule,
    runRules,
    splice,
    variant,
    wire
  },
  "@grayhaven/nerve-connectors": connectorsModule
}

const isHarnessDesign = (value: unknown): value is HarnessDesign =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "harness"

const evaluateSource = async (source: string): Promise<HarnessDesign> => {
  const { transform } = await import("sucrase")
  const { code } = transform(source, { transforms: ["typescript", "imports"] })
  const mod = { exports: {} as Record<string, unknown> }
  const sandboxRequire = (name: string): unknown => {
    const m = SANDBOX_MODULES[name]
    if (m === undefined) {
      throw new Error(
        `Module "${name}" is not available in the editor sandbox. Available: ${Object.keys(SANDBOX_MODULES).join(", ")}`
      )
    }
    return m
  }
  new Function("require", "module", "exports", code)(sandboxRequire, mod, mod.exports)
  const design = mod.exports["default"]
  if (!isHarnessDesign(design)) {
    throw new Error("The source must default-export harness(...).")
  }
  return design
}

// Async handler: overlapping requests may complete out of order, which is
// safe because compile-client matches responses by id.
self.onmessage = async (event: MessageEvent<CompileRequest>) => {
  const { id, projectId, source } = event.data
  let design: HarnessDesign | undefined
  try {
    design = source !== undefined ? await evaluateSource(source) : designs[projectId]
  } catch (cause) {
    self.postMessage({
      id,
      error: cause instanceof Error ? cause.message : String(cause)
    } satisfies CompileResponse)
    return
  }
  if (design === undefined) {
    self.postMessage({
      id,
      error: `Unknown project: ${projectId}`
    } satisfies CompileResponse)
    return
  }
  const { hir, diagnostics: structural } = compileDesign(design)
  const ruleDiagnostics = runRules(hir, builtinRules)
  const diagnostics = [...structural, ...ruleDiagnostics]
  const fullHir = { ...hir, diagnostics }
  self.postMessage({
    id,
    result: {
      hir: fullHir,
      svg: schematicSvg(fullHir),
      boardSvg: boardSvg(fullHir),
      testPlan: generateTestPlan(fullHir)
    }
  } satisfies CompileResponse)
}
