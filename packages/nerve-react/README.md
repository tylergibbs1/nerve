# @grayhaven/nerve-react

Experimental JSX authoring for Nerve harnesses. A 2KB custom JSX runtime — no React, no fiber: elements are plain functions over the typed DSL, so the JSX form compiles to **byte-identical HIR** vs. the function style (proven in tests).

```tsx
/** @jsxImportSource @grayhaven/nerve-react */
import { Connector, Harness, Wire } from "@grayhaven/nerve-react"

export default (
  <Harness id="drop" revision="A" units="mm">
    <Connector ref="J1" part={part("ph-4")} pins={{ 1: "V5", 2: "GND" }} />
    <Wire id="W1" from="J1.1" to="M1.1" gauge="24AWG" color="red" length={120} />
  </Harness>
)
```

Part of [Grayhaven Nerve](https://github.com/tylergibbs1/nerve) — harnesses as code. [Live demo + docs](https://nerve.grayhavenindustries.com) · [llms.txt](https://nerve.grayhavenindustries.com/llms.txt) · Apache-2.0
