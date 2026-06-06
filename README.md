# Grayhaven Nerve

**Harnesses as code for machines that need a nervous system.**

Nerve turns wiring-harness design into a version-controlled, type-safe workflow:

```
TypeScript DSL → compiler → HIR → validation → rendering → manufacturing outputs → test artifacts
```

See [`GOAL.md`](./GOAL.md) for the current milestone and [`docs/prd.md`](./docs/prd.md) for the full PRD.

## Status: M0–M3 complete ✅ (first milestone shipped)

| Package | What it is |
| --- | --- |
| [`@grayhaven/nerve`](./packages/nerve) | Domain model, DSL builders (`harness`, `connector`, `wire`, `branch`, `label`), versioned HIR schema (Effect Schema), deterministic `compileDesign`, diagnostics + `rule()` API, `defineConfig` |
| [`@grayhaven/nerve-rules`](./packages/nerve-rules) | 13 built-in validation rules with stable `HK-*` codes (electrical, manufacturing, connectivity, documentation) |
| [`@grayhaven/nerve-compiler`](./packages/nerve-compiler) | `.harness.ts` loading, config discovery, Effect `CompilerService` + tagged errors, fail-closed gate |
| [`@grayhaven/nerve-exporters`](./packages/nerve-exporters) | BOM / cut-list / label CSVs (PRD §20), continuity + no-short test plan (§9.9), deterministic SVG schematic, byte-deterministic zip packet |
| [`@grayhaven/nerve-cli`](./packages/nerve-cli) | `nerve init/compile/validate/render/export/inspect` — deterministic, CI-ready exit codes |
| [`@grayhaven/nerve-web`](./packages/nerve-web) | Vite/React/TanStack editor: diagram + data tables + diagnostics, compile in a Web Worker |
| [`@grayhaven/nerve-connectors`](./packages/nerve-connectors) | Verified connector library (Molex Micro-Fit 3.0 seed data) |
| [`examples/motor-controller`](./examples/motor-controller) | Golden fixture: the PRD §9.1 example harness, verbatim |

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
- **M1 — Compiler + rules** ✅ TypeScript loading, 13 validation rules, CLI `compile`/`validate`
- **M2 — Exports** ✅ CSV BOM/cut-list/labels/test-plan, SVG schematic, zip packet
- **M3 — Web editor** ✅ Vite/React/TanStack, worker-based compile, diagnostics panel
- **Next** (see [`GOAL.md`](./GOAL.md)): harness-board view, `nerve diff`, PDF packet, WireViz import, in-browser authoring, variants
