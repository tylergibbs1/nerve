# Changelog

## 0.5.0 — 2026-06-07
(Supersedes the unpublished 0.4.0 tag; both changelogs ship together.)

### tscircuit interop (PRD §37, both directions)
- `importTscircuitPinout`: validate the harness against a tscircuit
  board's Circuit JSON (`nerve contract --against board.circuit.json`) —
  catches swapped pins across the PCB/harness seam.
- `exportTscircuitCircuitJson` + `nerve contract --format circuit-json`:
  hand tscircuit the harness side. Round-trip proven in tests.
- `validateContract` is mating-aware: a contract naming the harness
  part's `matingMpn` (what a board file contains) is correct, not a
  mismatch. `matingMpn` now flows into HIR.

### New package: @grayhaven/nerve-react (experimental)
- JSX authoring with a 2KB custom runtime (no React): `<Harness>`,
  `<Connector>`, `<Wire from="J1.1">` are pure function application over
  the typed DSL. Compiles to byte-identical HIR vs the function style.

### Library ergonomics
- Compact part specs: `part("microfit-2x8")`, `part("dt-4s")`,
  `part("xt60-f")` — 26 specs across all families, raw-MPN passthrough,
  unknown specs fail with the full menu.

## 0.4.0 — 2026-06-07
### Connector face views (PRD §9.5.2)
- New deterministic exporter: per connector, FRONT (mating side, mirrored) and
  REAR (wire side) cavity views with population state, wire colors, reserved
  cavities, orientation markers, and a pin/signal/gauge legend. In the packet
  (`connector-faces.svg` + a PDF page), the web workspace (Connectors tab with
  interactive HTML download), and `nerve render --view faces`.

### Rules (17 -> 21, + provider conflicts)
- `HK-ELEC-005` wire voltage rating below the signal's nominal volts.
- `HK-CONN-015` signal assigned to a part-reserved cavity.
- `HK-MFG-005` branch breakout tighter than its `minBendRadius`.
- `HK-MFG-006` estimated bundle diameter exceeds sleeve capacity (per-AWG
  insulated-OD table, hex-pack estimate).
- `HK-LIB-001` part-data providers disagree on load-bearing fields.

### Part-data providers + library (PRD §42/§30)
- `PartProvider` / `staticProvider` / `resolvePart` in `@grayhaven/nerve`:
  priority resolution with conflict diagnostics, never silent overwrites.
- `@grayhaven/nerve-connectors`: 5 families / 21 parts (Molex Micro-Fit 3.0
  incl. new 16-circuit housings, Mega-Fit, JST PH, JST XH, TE Deutsch DT,
  AMASS XT60) with cavity layouts, mating pairs, gauge ranges, provenance.
  `allParts` + `nerveConnectorsProvider` exports. Examples now import their
  parts from the library.

### HIR satellites + PNG (PRD §9.3/§9.8)
- `graph.json` (nodes/edges/nets), `render-layout.json` (DrawingIR per
  sheet), `diagnostics.json`, and JSON twins of the BOM/cut-list/label CSVs,
  all in the packet. `nerve render --format png`.

### Schema (additive)
- `ConnectorPart.reservedPins`, `BranchProps.minBendRadius`; `cavityLayout`
  now flows through to HIR connectors.

### Web
- Cross-view traceability: click any rendered object for a persistent
  highlight + inspector (with View Source jump); diagnostics rows select
  their target; workspace search across wires/signals/connectors/pins.
- AI copilot now uses OpenAI (gpt-5.5, Responses API), browser-direct.

## 0.3.0 — 2026-06-07
### Rules
- HK-ELEC-001 now recognizes bus-indexed differential pairs: `CAN1_H`/`CAN1_L`,
  `MOTOR_CAN2_H` pair correctly (previously skipped silently — untwisted
  multi-bus CAN shipped without a diagnostic).
- Ground classification is token-aware: `AGND`, `DGND`, `PGND`, `MOTOR_GND`
  classify as grounds, eliminating false HK-ELEC-003 errors. Power matching
  deliberately stays anchored so enable/sense lines (`EN_5V`) are not
  misclassified as rails.
- New numeric code API: `ruleCodeNumber` / `ruleCodeFromNumber` /
  `ruleCategory` / `codesToNumbers` / `RULE_CATEGORY_BANDS` — a derived
  (zero-maintenance) numeric view of `HK-*` codes for sorting, bitsets, and
  compact storage. String codes remain the public contract.
- Test suite: 22 -> 96 rule tests including property-based invariants
  (~1,750 generated designs per run via fast-check).

### Exporters
- Schematic and board SVGs carry deterministic, sorted `data-*` attributes
  (`data-wire`, `data-connector`, `data-pin`, `data-splice`): artifacts are
  now machine-addressable for tooling and interactive viewers. `DrawItem`
  types gain an optional `data` record.

## 0.2.1 — 2026-06-06
### Tree-shaking
- `@grayhaven/nerve` and `@grayhaven/nerve-exporters` declare `sideEffects: false`:
  bundlers now drop unused exporters (notably the pdf-lib manufacturing-packet
  machinery, ~418KB) from consumer bundles when only SVG/CSV/test-plan paths
  are imported. Verified: a worker importing only `schematicSvg`/`boardSvg`/
  `generateTestPlan` shrinks from 842KB to 41KB.
- Effect-free HIR values (`endpointLabel`, `isPinEndpoint`, `refs`,
  `HIR_SCHEMA_VERSION`) moved to a pure internal module so consumers that never
  decode/encode HIR no longer retain the Effect Schema runtime. Public API
  unchanged — everything still exports from the package root.

## 0.2.0 — 2026-06-06

The expansion release: from manufacturing packets to the full engineering →
manufacturing → test → feedback loop.

### Domain & compiler
- **Splices and cables** (PRD §9.2): wire endpoints are `PinRef | SpliceRef`;
  `splice()`/`cable()` builders; nets computed across splices; splice-verification
  tests; `HK-SPLICE-*`/`HK-CABLE-*` checks
- **Variants** (§8.4): `variant(base, mods)` with add/remove/override and
  `metadata.variantOf` lineage
- **Per-pin terminals and seals** (§30): `connector(..., { terminals, seals })`
  flow into HIR pins and BOM lines; compatibility rules `HK-CONN-012/013/014`;
  `requireApprovedParts` org-approval gate; `PartProvenance` + crimp/insertion
  tooling on parts
- **Plugin SDK** (§40): `definePlugin` rule packs loaded from `config.plugins`,
  HIR schema-version gating (`HK-PLUGIN-001`)
- **Verified library data**: Molex Micro-Fit 3.0 verified against catalog
  sources (20–30 AWG — the family does not accept 18 AWG; 8.5 A / 600 V)

### Manufacturing outputs
- **Bill of Process** (§28): sequenced operations with workstations, tooling,
  labor estimates, HIR-linked targets — `bop.csv`/`bop.json` + PDF page
- **Costing & quotes** (§29): `CostModel` in config; material + labor + scrap +
  yield rollup; long-lead / NRND / unpriced flags; `quoteDiff`; `nerve quote`
- **Formboard 1:1 tiling** (§33): mm-true SVG sheets with fiducials, stitch
  borders, and a calibration ruler — `nerve render --view formboard`
- **Shop-floor adapters** (§31): typed `MachineAdapter` boundary; generic
  cut/strip CSV, label-printer CSV, continuity-tester JSON — `nerve machine`
- **Engineering analysis** (§34): resistance, voltage drop, bundle diameters,
  splice current aggregation, weight totals — `nerve analyze`

### Workflow
- **WireViz adapter** (§27.2): YAML import with diagnostics for unmapped
  concepts; export with round-trip tests — `nerve import`
- **Interface contracts** (§37): connector pinout contracts, swapped-pin
  detection (`HK-IFC-*`) — `nerve contract`
- **ECO/releases** (§35): HIR fingerprint, impact + change-risk score vs the
  previous release, fail-closed — `nerve release`
- **Build Records** (§36): as-built evidence with measured-resistance verdicts
  replayed against the test plan — `nerve record`
- **Technician redlines** (§39): HIR-targeted feedback, accept/reject with
  retained reasons, accepted → `variant()`-shaped structured patch —
  `nerve redline`

### Web editor
- In-browser authoring (§9.6): Source tab with worker-sandboxed TS compile
- Board tab; three demo projects including the 22-connector robot platform
- Grayhaven monochrome brand

## 0.1.0 — 2026-06-06

Initial release: TypeScript DSL → deterministic compiler → versioned HIR →
validation rules with stable `HK-*` codes → schematic/board SVG → BOM, cut
list, label schedule, continuity test plan → PDF manufacturing packet →
`nerve` CLI → web editor.
