/**
 * DSL completion source for the editor. Curated to match the worker
 * sandbox surface (compile.worker.ts SANDBOX_MODULES) — the rules-property
 * suite guards the underlying API, and the editor teaches it.
 */
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete"

const fn = (label: string, detail: string, info: string): Completion => ({
  label,
  type: "function",
  detail,
  info
})

const FUNCTIONS: ReadonlyArray<Completion> = [
  fn("harness", "(id, options)", "Root design object. revision and units are required; releases fail closed without them."),
  fn("connector", "(id, part, { pins })", "Place a connector from a part definition. pins maps pin numbers to signal names."),
  fn("wire", "(id, from, to, options)", "Point-to-point conductor. Endpoints are connector.pin(n) or a splice. gauge/color/length feed the rules."),
  fn("splice", "(id, { type, notes? })", 'Junction node ("crimp" | "solder" | "ultrasonic"). Wires may terminate on it; nets compute across it.'),
  fn("cable", "(id, { conductors, shield? })", "Group wires into a multi-conductor cable; shield drains must land on a pin."),
  fn("branch", "(id, { path, nominalLength })", "Physical bundle segment for the board view and cut-length math."),
  fn("label", "(id, { text, attachTo })", "Printed loom label; exported to the label schedule."),
  fn("variant", "(base, overrides)", "Derive a configuration from a base harness without forking the file."),
  fn("rule", "(name, run, { code })", "Author a custom validation rule with a stable diagnostic code."),
  fn("defineConfig", "(config)", "Project config: plugins, rule severity overrides."),
  fn("compileDesign", "(design)", "Pure, deterministic compile to HIR."),
  fn("runRules", "(hir, rules, config?)", "Run rules; returns canonically ordered diagnostics."),
  fn("diffHir", "(before, after)", "Semantic diff between two revisions.")
]

const OPTIONS: ReadonlyArray<Completion> = [
  "gauge", "color", "length", "signal", "twistGroup", "currentEstimate",
  "revision", "units", "connectors", "wires", "branches", "labels", "splices", "cables",
  "pins", "mpn", "pinCount", "wireGaugeRange", "type", "notes", "shield", "conductors",
  "path", "nominalLength", "text", "attachTo"
].map((label) => ({ label, type: "property" as const }))

export const dslCompletions = (ctx: CompletionContext): CompletionResult | null => {
  const word = ctx.matchBefore(/[A-Za-z_]\w*/)
  if (word === null || (word.from === word.to && !ctx.explicit)) return null
  return {
    from: word.from,
    options: [...FUNCTIONS, ...OPTIONS],
    validFor: /^\w*$/
  }
}
