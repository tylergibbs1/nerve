/**
 * Compile worker (PRD §9.5, §14): compilation, validation, layout, and
 * render-prep run off the main thread so the UI stays responsive.
 *
 * The worker consumes the same pure pipeline as the CLI: design →
 * compileDesign → runRules → exporters. Designs are statically bundled for
 * now; in-browser authoring swaps this for a TS-compile step later.
 */
import { compileDesign, runRules, type HarnessDesign } from "@grayhaven/nerve"
import { builtinRules } from "@grayhaven/nerve-rules"
import { boardSvg, generateTestPlan, schematicSvg } from "@grayhaven/nerve-exporters"
import motorController from "@grayhaven/example-motor-controller"
import sensorSplice from "@grayhaven/example-sensor-splice"
import type { CompileRequest, CompileResponse } from "../lib/compile-types.js"

const designs: Readonly<Record<string, HarnessDesign>> = {
  "motor-controller": motorController,
  "sensor-splice": sensorSplice
}

self.onmessage = (event: MessageEvent<CompileRequest>) => {
  const { id, projectId } = event.data
  const design = designs[projectId]
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
