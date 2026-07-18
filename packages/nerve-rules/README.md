# @grayhaven/nerve-rules

43 generic validation rules with stable `HK-*` codes: missing ground returns, typed source/sink compatibility, voltage and protocol domains, differential-pair semantics, ampacity vs. gauge, terminal and seal compatibility, cable-conductor identity, continuity-test reachability, reserved pins, bend radius, bundle capacity, and more. Includes a derived numeric code mapping for tooling.

These checks operate on declared facts. They are not a standards certification or a field-validated failure corpus.

```ts
import { builtinRules } from "@grayhaven/nerve-rules"
import { compileDesign, runRules } from "@grayhaven/nerve"

const diagnostics = runRules(compileDesign(design).hir, builtinRules)
```

Part of [Grayhaven Nerve](https://github.com/tylergibbs1/nerve) — harnesses as code. [Live demo + docs](https://nerve.grayhavenindustries.com) · [llms.txt](https://nerve.grayhavenindustries.com/llms.txt) · Apache-2.0
