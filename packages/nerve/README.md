# @grayhaven/nerve

The core of Grayhaven Nerve: the typed harness DSL (`harness` / `connector` / `wire` / `splice` / `cable` / `branch` / `label` / `variant`), the versioned HIR schema, deterministic `compileDesign`, diagnostics + the `rule()` API, `diffHir`, part-data providers (`resolvePart`, `staticProvider`), and `defineConfig`.

```ts
import { harness, connector, wire } from "@grayhaven/nerve"
import { MolexMicroFit } from "@grayhaven/nerve-connectors"

const j1 = connector("J1", MolexMicroFit["43025-0800"], {
  pins: { 1: "VBAT_24V", 2: "GND", 3: "CAN_H", 4: "CAN_L" },
})
// wire(), branch(), label() ... -> compileDesign() -> deterministic HIR
```

Part of [Grayhaven Nerve](https://github.com/tylergibbs1/nerve) — harnesses as code. [Live demo + docs](https://nerve-demo.vercel.app) · [llms.txt](https://nerve-demo.vercel.app/llms.txt) · Apache-2.0
