# @grayhaven/nerve-importers

Deterministic migration adapters that turn existing wire lists into reviewable Nerve source. CSV and XLSX inputs are parsed into a plain table, mapped through a reusable column map, and converted into generated TypeScript plus an in-memory design. Every row is accounted for in the import report: accepted rows become wires, rejected rows carry stable `HK-IMPORT-*` diagnostic codes with the source row and column. Imported connector parts are marked `verification: "unverified"` so downstream review is forced.

```bash
npm install @grayhaven/nerve-importers
```

```ts
import { readFileSync } from "node:fs"
import { importWireList, parseCsvWireList } from "@grayhaven/nerve-importers"

const table = parseCsvWireList(readFileSync("legacy.csv", "utf8"))
const result = importWireList(
  table,
  { fromConnector: "From", fromPin: "From Pin", toConnector: "To", toPin: "To Pin" },
  { harnessId: "migrated", sourceName: "legacy.csv" }
)

result.source // generated Nerve TypeScript, ready for review
result.report // every row accounted for, accepted or rejected with codes
```

`parseXlsxWireList` reads a workbook (with an optional sheet name) through the same converter, and `normalizeWireListColumnMap` / `wireListColumnMapJson` validate and serialize a reusable column map. See the [docs](https://nerve.grayhavenindustries.com/docs) for the full column map and diagnostic reference.

Part of [Grayhaven Nerve](https://github.com/tylergibbs1/nerve) — harnesses as code. [Live demo + docs](https://nerve.grayhavenindustries.com) · [llms.txt](https://nerve.grayhavenindustries.com/llms.txt) · Apache-2.0
