# Changelog

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
