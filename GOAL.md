# Grayhaven Nerve — Project Goal

> Source PRD: `~/Downloads/grayhaven_nerve_prd.md`
> Stack validated against current docs (Context7, 2026-06): Effect (Layer services, Data.TaggedError, Schema), TanStack Router v1 (file-based routing via `@tanstack/router-plugin/vite`), TanStack Query v5, Vite.

## North Star

A small hardware team can replace their spreadsheet-plus-drawing workflow for one real
harness: author it in TypeScript, compile it, fix validation errors, and hand the
generated packet to a technician. (PRD §25 "critical product test", §26 Definition of Done.)

## The Goal (first milestone — vertical slice)

**Compile the PRD's example `motor-controller-harness` end-to-end:**

```
TypeScript DSL  →  HIR (harness.json)  →  validation diagnostics  →  SVG schematic
                                        →  bom.csv, cut-list.csv, labels.csv, tests.csv
```

…runnable two ways:

1. `nerve compile ./src/main.harness.ts` — CLI, deterministic output, nonzero exit on errors.
2. A Vite/React web editor showing the schematic + data tables for the same project.

### Success criteria

- [ ] The PRD §9.1 example harness compiles unmodified (same API surface: `harness`, `connector`, `wire`, `branch`, `label`).
- [ ] HIR is an Effect `Schema`-validated, versioned JSON document (`schemaVersion: "0.1.0"`) — reloadable without executing user code.
- [ ] ≥10 built-in validation rules from PRD §9.4 (duplicate wire ID, gauge-vs-current, missing color/length, untwisted CAN pair, etc.) with stable `HK-*` diagnostic codes.
- [ ] Same input + lockfile ⇒ byte-identical HIR (determinism, PRD §9.3).
- [ ] SVG schematic renders connectors, pins, wires, colors, gauges from HIR only.
- [ ] CSV exporters for BOM, cut list, label schedule, continuity test plan (PRD §20 column specs).
- [ ] Web editor: `/projects/$projectId/{diagram,bom,cut-list,labels,tests}` routes, TanStack Table views, diagnostics panel.

## Architecture commitments (from PRD §10 + current library docs)

- **Monorepo** (pnpm workspaces): `@grayhaven/nerve` (domain + HIR types), `nerve-compiler`,
  `nerve-rules`, `nerve-exporters`, `nerve-cli`, `nerve-web`.
- **Effect**: services as `Effect.Service`/Layers (`CompilerService`, `ValidationService`,
  `ExportService`…), typed errors via `Data.TaggedError` (`CompileError`, `ValidationError`,
  `ExportError`), HIR codec via Effect `Schema` (`Schema.validate` / decode at every boundary).
- **Web**: Vite + React, file-based routing with `tanstackRouter({ target: 'react' })` plugin,
  `createRouter` with `queryClient` in context, `defaultPreload: 'intent'`; compile runs in a
  Web Worker, TanStack Query manages worker job state; TanStack Table for all data views.
- **Renderers consume HIR, never user TypeScript** (PRD §6.3, §9.3).

## Explicitly deferred (don't build yet)

PDF packet, harness-board/nailboard view, WireViz import, variants/diff, BOP/costing,
Registry, Build Record, AI features, plugin SDK. (PRD §7.2, §25 — wedge first.)

## Milestones

1. **M0 — Skeleton**: pnpm monorepo, core domain types + DSL builders, HIR Schema, golden fixture from PRD example.
2. **M1 — Compiler + rules**: deterministic HIR emit, 10+ rules, diagnostics with stable codes, CLI `compile`/`validate`.
3. **M2 — Exports**: CSV BOM/cut-list/labels/test-plan, SVG schematic, CLI `render`/`export`.
4. **M3 — Web editor**: project view, schematic canvas, data tables, diagnostics panel, worker-based compile.
