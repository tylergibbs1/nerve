# @grayhaven/nerve-rules

21 built-in validation rules with stable `HK-*` codes: missing ground returns, untwisted differential pairs (CAN/RS-485/USB, bus-indexed), ampacity vs. gauge, terminal/seal compatibility, reserved pins, bend radius, bundle-vs-sleeve capacity, voltage ratings, and more — each one a field failure caught at compile time. Includes a derived numeric code mapping for tooling.

```ts
import { builtinRules } from "@grayhaven/nerve-rules"
import { compileDesign, runRules } from "@grayhaven/nerve"

const diagnostics = runRules(compileDesign(design).hir, builtinRules)
```

Part of [Grayhaven Nerve](https://github.com/tylergibbs1/nerve) — harnesses as code. [Live demo + docs](https://nerve-demo.vercel.app) · [llms.txt](https://nerve-demo.vercel.app/llms.txt) · Apache-2.0
