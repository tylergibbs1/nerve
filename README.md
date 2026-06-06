# Grayhaven Nerve

**Harnesses as code for machines that need a nervous system.**

Nerve turns wiring-harness design into a version-controlled, type-safe workflow:

```
TypeScript DSL → compiler → HIR → validation → rendering → manufacturing outputs → test artifacts
```

See [`GOAL.md`](./GOAL.md) for the current milestone and [`docs/prd.md`](./docs/prd.md) for the full PRD.

## Status: M0 — skeleton ✅

| Package | What it is |
| --- | --- |
| [`@grayhaven/nerve`](./packages/nerve) | Domain model, DSL builders (`harness`, `connector`, `wire`, `branch`, `label`), versioned HIR schema (Effect Schema), deterministic `compileDesign`, diagnostics primitives |
| [`@grayhaven/nerve-connectors`](./packages/nerve-connectors) | Verified connector library (Molex Micro-Fit 3.0 seed data) |
| [`examples/motor-controller`](./examples/motor-controller) | Golden fixture: the PRD §9.1 example harness, verbatim |

## Quick start

```bash
pnpm install
pnpm test        # golden corpus + structural diagnostics
pnpm typecheck   # strict TS across all packages
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
- **M1 — Compiler + rules**: TypeScript loading, 10+ validation rules, CLI `compile`/`validate`
- **M2 — Exports**: CSV BOM/cut-list/labels/test-plan, SVG schematic
- **M3 — Web editor**: Vite/React/TanStack, worker-based compile, diagnostics panel
