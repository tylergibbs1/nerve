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

### Success criteria — ALL MET ✅

- [x] The PRD §9.1 example harness compiles unmodified (`examples/motor-controller`, golden fixture + snapshot).
- [x] HIR is an Effect `Schema`-validated, versioned JSON document (`schemaVersion: "0.1.0"`) — round-trip tested without executing user code.
- [x] 13 built-in validation rules + 6 structural checks, all with stable `HK-*` codes (`@grayhaven/nerve-rules`, severity-configurable, custom `rule()` API).
- [x] Same input ⇒ byte-identical HIR, CSVs, SVG, and zip (determinism tests at every layer; authoring order never changes output).
- [x] SVG schematic renders connectors, pins, wires, colors, gauges, twist annotations, and error highlighting from HIR only.
- [x] CSV exporters for BOM, cut list, label schedule, continuity test plan (PRD §20 columns; §9.9 plan covers every wired net).
- [x] Web editor: `/projects/$projectId/{diagram,bom,cut-list,labels,tests}` routes, TanStack Table views, diagnostics panel, Web Worker compile — verified in Chrome.

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

1. ✅ **M0 — Skeleton**: pnpm monorepo, core domain types + DSL builders, HIR Schema, golden fixture from PRD example.
2. ✅ **M1 — Compiler + rules**: deterministic HIR emit, 13 rules, diagnostics with stable codes, CLI `compile`/`validate`.
3. ✅ **M2 — Exports**: CSV BOM/cut-list/labels/test-plan, SVG schematic, zip packet, CLI `render`/`export`/`inspect`/`init`.
4. ✅ **M3 — Web editor**: project view, schematic canvas, data tables, diagnostics panel, worker-based compile.

**First milestone complete (2026-06-06).**

5. ✅ **M4 — Definition-of-Done sprint** (2026-06-06): every PRD §26 item now met.
   - PDF manufacturing packet (DoD #6, §9.8): cover, schematic + board pages, BOM/cut-list/labels/tests tables, assembly instructions (§20.4) — byte-deterministic via pdf-lib with pinned metadata.
   - Harness-board/nailboard view (DoD #3, §9.5.3): branch trunks, endpoints, sleeve/length callouts, label flags — in SVG, PDF, web Board tab, and `nerve render --view board`.
   - `nerve diff` (DoD #9, §21): connectors/pinouts/wires/branches/labels/BOM changes across harness.json, `.harness.ts`, or revision dirs; git-style exit codes; `--json`.
   - DrawingIR (§27.4): one deterministic layout feeding both SVG and PDF renderers.

6. ✅ **M5 — Splice + cable depth** (§9.2): SpliceRef endpoints, cable grouping, HK-SPLICE/HK-CABLE checks, splice symbols in schematic/board, splice-verification tests, net computation across splices; `examples/sensor-splice` fixture.
7. ✅ **M6 — Variants** (§8.4): `variant(base, mods)` with add/remove/override, lineage metadata, diff-visible differences, consistent validation; `variants/long.ts` example.
8. ✅ **M7 — WireViz adapter** (§27.2): YAML subset import with diagnostics for unmapped concepts, export with round-trip test, fixture corpus, `nerve import` / `nerve export --target wireviz`.
9. ✅ **M8 — In-browser authoring** (§9.6): Source tab (CodeMirror), sucrase TS compile in the worker sandbox, edits update every tab live.
10. ✅ **M9 — Publish prep**: tsup `dist` builds with types for all 7 library packages, GitHub Actions CI, Apache-2.0 license (user-confirmed 2026-06-06) + NOTICE, `publishConfig` ready (packages stay `private: true` until a deliberate publish).

**Roadmap complete (2026-06-06).** Future direction lives in the PRD: BOP/costing (§28–29),
Registry + verified component data (§30), shop-floor adapters (§31), formboard 1:1 printing (§33),
engineering analysis (§34), ECO/release workflow (§35), Build Record (§36), interface contracts (§37),
redlines (§39), plugin SDK (§40).
