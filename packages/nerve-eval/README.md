# @grayhaven/nerve-eval

Provenance-aware evaluation and review-report primitives for Grayhaven Nerve. `decodeEvalManifest` validates an untrusted corpus manifest before any fixture module is executed, `evaluateCase` scores rule diagnostics against a case's expected and forbidden findings, and `createCorpusReport` summarizes results by provenance. Every case declares where it came from (synthetic, datasheet-derived, or field-verified); field-verified cases must name a reviewer role and date, and findings a case did not assert are surfaced for adjudication rather than labeled false positives.

```bash
npm install @grayhaven/nerve-eval
```

```ts
import { createCorpusReport, decodeEvalManifest, evaluateCase } from "@grayhaven/nerve-eval"

const manifest = decodeEvalManifest(JSON.parse(manifestJson))
const results = manifest.cases.map((evalCase) =>
  // diagnostics come from compileDesign + runRules on the case fixture
  evaluateCase(evalCase, diagnosticsFor(evalCase))
)
const report = createCorpusReport(results)

report.summary // total, passed, failed, and counts by provenance kind
```

`createReviewReport` packages a compiled harness and its diagnostics into a deterministic review report that records the engine, rule set, and an explicit disclaimer. See the [docs](https://nerve.grayhavenindustries.com/docs) for the manifest schema and report formats.

Part of [Grayhaven Nerve](https://github.com/tylergibbs1/nerve) — harnesses as code. [Live demo + docs](https://nerve.grayhavenindustries.com) · [llms.txt](https://nerve.grayhavenindustries.com/llms.txt) · Apache-2.0
