# @grayhaven/nerve-connectors

The verified connector library: 5 families / 21 parts (Molex Micro-Fit 3.0 + Mega-Fit, JST PH + XH, TE Deutsch DT, AMASS XT60) with cavity layouts, mating pairs, gauge ranges, crimp tooling, and dated provenance — plus compact specs and the bundled `PartProvider`.

```ts
import { part, nerveConnectorsProvider } from "@grayhaven/nerve-connectors"

part("microfit-2x8")  // -> Molex 43025-1600, full verified record
part("dt-4s")         // -> Deutsch DT06-4S
```

Part of [Grayhaven Nerve](https://github.com/tylergibbs1/nerve) — harnesses as code. [Live demo + docs](https://nerve.grayhavenindustries.com) · [llms.txt](https://nerve.grayhavenindustries.com/llms.txt) · Apache-2.0
