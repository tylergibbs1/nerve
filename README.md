# Grayhaven Nerve

**Harnesses as code for machines that need a nervous system.**

Nerve turns wiring-harness design into a version-controlled, type-safe workflow:

```
TypeScript DSL → compiler → HIR → validation → rendering → manufacturing outputs → test artifacts
```

See [`GOAL.md`](./GOAL.md) for the current milestone and [`docs/prd.md`](./docs/prd.md) for the full PRD.

## Status: roadmap complete ✅ — PRD §26 Definition of Done met, M0–M9 shipped

| Package | What it is |
| --- | --- |
| [`@grayhaven/nerve`](./packages/nerve) | Domain model, DSL (`harness`/`connector`/`wire`/`branch`/`label`/`splice`/`cable`/`variant`), versioned HIR schema (Effect Schema), deterministic `compileDesign`, diagnostics + `rule()` API, `diffHir`, `defineConfig` |
| [`@grayhaven/nerve-rules`](./packages/nerve-rules) | 14 built-in validation rules with stable `HK-*` codes (electrical, manufacturing, connectivity, documentation) |
| [`@grayhaven/nerve-compiler`](./packages/nerve-compiler) | `.harness.ts` loading, config discovery, Effect `CompilerService` + tagged errors, fail-closed gate |
| [`@grayhaven/nerve-exporters`](./packages/nerve-exporters) | DrawingIR → SVG/PDF; BOM / cut-list / label CSVs (§20), continuity + splice + no-short test plan (§9.9), schematic + harness-board views, assembly instructions, byte-deterministic PDF packet + zip |
| [`@grayhaven/nerve-wireviz`](./packages/nerve-wireviz) | WireViz YAML import/export adapter with fixture corpus (§27.2) |
| [`@grayhaven/nerve-cli`](./packages/nerve-cli) | `nerve init/compile/validate/render/export/import/diff/inspect` — deterministic, CI-ready exit codes |
| [`@grayhaven/nerve-web`](./packages/nerve-web) | Vite/React/TanStack editor: in-browser source authoring, diagram + board + data tables + diagnostics, compile in a Web Worker |
| [`@grayhaven/nerve-connectors`](./packages/nerve-connectors) | Verified connector library (Molex Micro-Fit 3.0 seed data) |
| [`examples/`](./examples) | Golden fixtures: PRD §9.1 motor-controller (verbatim) + variant, sensor-splice (splices/cables) |

## Quick start

```bash
pnpm install
pnpm test        # 57 tests: golden corpus, rules, compiler, exporters, CLI
pnpm typecheck   # strict TS across all packages

# CLI (from examples/motor-controller):
node ../../packages/nerve-cli/bin/nerve.js compile ./src/main.harness.ts
node ../../packages/nerve-cli/bin/nerve.js export  ./src/main.harness.ts   # full packet → dist/

# Web editor:
pnpm --filter @grayhaven/nerve-web dev
```

## Authoring style

```ts
import { harness, connector, wire } from "@grayhaven/nerve"
import { MolexMicroFit } from "@grayhaven/nerve-connectors"

const j1 = connector("J1", MolexMicroFit["43025-0800"], {
  pins: { 1: "VBAT_24V", 2: "GND", 3: "CAN_H", 4: "CAN_L" },
})
// ...wires, branches, labels — see examples/motor-controller
```

## Roadmap

- **M0 — Skeleton** ✅ monorepo, DSL, HIR schema, golden fixture
- **M1 — Compiler + rules** ✅ TypeScript loading, validation rules, CLI `compile`/`validate`
- **M2 — Exports** ✅ CSV BOM/cut-list/labels/test-plan, SVG schematic, zip packet
- **M3 — Web editor** ✅ Vite/React/TanStack, worker-based compile, diagnostics panel
- **M4 — DoD sprint** ✅ PDF manufacturing packet, harness-board view, `nerve diff` — **all PRD §26 items met**
- **M5 — Splices + cables** ✅ splice endpoints, cable grouping, splice-verification tests
- **M6 — Variants** ✅ `variant()` with lineage and diff-visible changes
- **M7 — WireViz** ✅ YAML import/export adapter, `nerve import`
- **M8 — In-browser authoring** ✅ Source tab, worker-sandboxed TS compile
- **M9 — Publish prep** ✅ tsup `dist` builds, CI workflow, MIT license, `publishConfig`
- **Future** (PRD §28–40): BOP/costing, Registry, shop-floor adapters, 1:1 formboard, analysis, ECO/release, Build Record, interface contracts, plugin SDK

> Publishing note: packages carry `publishConfig` but remain `private: true` —
> flip deliberately when ready to publish. Licensed under Apache-2.0.
