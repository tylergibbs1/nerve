> Grayhaven Nerve docs index: https://nerve-demo.vercel.app/llms.txt. Fetch it to discover all pages before exploring further.

# The TypeScript SDK.

Everything the CLI does is a library call. Use the packages directly to embed harness compilation in your own tools: CI checks, generators, PLM integrations, or a build step.

## Compile and validate

`compileDesign` is pure and deterministic: same design in, same HIR out. Run the rule set against the result and gate on errors exactly like `nerve validate` does.

```ts
import { compileDesign, runRules, hasErrors } from "@grayhaven/nerve"
import { builtinRules } from "@grayhaven/nerve-rules"
import design from "./src/main.harness.js"

const { hir } = compileDesign(design)
const diagnostics = runRules(hir, builtinRules)

if (hasErrors(diagnostics)) {
  for (const d of diagnostics) console.error(`${d.code} ${d.severity}: ${d.message}`)
  process.exit(1)
}
```

Severities are tunable per rule without forking it: `runRules(hir, builtinRules, { missingWireColor: "error", spliceMissingNotes: "off" })`.

## Generate artifacts

Every exporter is a function from HIR to bytes or strings. Pick what you need:

```ts
import {
  bomCsv, cutListCsv, labelScheduleCsv,
  schematicSvg, boardSvg,
  generateTestPlan, testPlanCsv,
  assemblyInstructions, manufacturingPacketPdf, buildPacket,
} from "@grayhaven/nerve-exporters"

const bom = bomCsv(hir)                      // string
const schematic = schematicSvg(hir)          // string (SVG)
const tests = testPlanCsv(generateTestPlan(hir))
const pdf = await manufacturingPacketPdf(hir)  // Uint8Array, byte-deterministic
const packet = await buildPacket(hir)          // the whole dist/ set + zip
```

## Diff two revisions

```ts
import { diffHir, formatDiff, isEmptyDiff } from "@grayhaven/nerve"

const diff = diffHir(previousHir, currentHir)
if (!isEmptyDiff(diff)) console.log(formatDiff(diff))
// → "wire W1: gauge 20AWG -> 16AWG", down to a single pin swap
```

## Custom rules

A rule is a named function over the HIR with a stable code. Ship your shop's policy as a package:

```ts
import { rule } from "@grayhaven/nerve"

export const maxBundleLength = rule(
  "maxBundleLength",
  (ctx) => {
    for (const b of ctx.hir.branches) {
      if (b.length > 2000) {
        ctx.report({
          severity: "error",
          target: `branch:${b.id}`,
          message: `Branch ${b.id} is ${b.length}mm; shop limit is 2000mm.`,
        })
      }
    }
  },
  { code: "SHOP-001" },
)
```

Wire it in via `nerve.config.ts` and the CLI picks it up; severities live in the same config:

```ts
import { defineConfig } from "@grayhaven/nerve"
import { maxBundleLength } from "./rules/shop-rules.js"

export default defineConfig({
  plugins: [{ rules: [maxBundleLength] }],
  rules: { missingWireColor: "error" },
})
```

## The HIR is a schema, not a guess

`harness.json` round-trips through a versioned Effect Schema: decode untrusted input, encode canonically:

```ts
import { decodeHir, encodeHir, HIR_SCHEMA_VERSION } from "@grayhaven/nerve"

const hir = decodeHir(JSON.parse(fileContents))  // throws on schema mismatch
const canonical = encodeHir(hir)                 // stable field order, diffs cleanly
```

Types for every node (`HirWire`, `HirConnector`, `HirEndpoint`, and the rest) ship with the package, so downstream tools are typed end to end.

## Loading .harness.ts files

The CLI loads design files through `@grayhaven/nerve-compiler` (jiti under the hood, no build step needed). Use it when your tool takes a file path rather than an imported module; everything in this page works in any bundler, Node 20+, or Bun.
