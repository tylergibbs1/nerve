> Grayhaven Nerve docs index: https://nerve-demo.vercel.app/llms.txt. Fetch it to discover all pages before exploring further.

# One compile, every output.

`nerve export` emits the complete set. Determinism is load-bearing: the same source produces byte-identical bytes (drawings, CSVs, the PDF, even the zip), so artifacts diff cleanly in review and hash-verify in CI.

| File | Contents |
| --- | --- |
| `harness.json` | Canonical HIR: versioned schema, the single source every other artifact derives from. |
| `schematic.svg` | Connection diagram: connectors, pins, wires with gauge/color annotations. |
| `board.svg` | Harness-board (nailboard) view at real lengths for the build fixture. |
| `connector-faces.svg` | Cavity layouts per connector: FRONT (mating side, mirrored) and REAR views, population state, wire colors, orientation markers. |
| `pinout.svg` | Per-connector pinout tables: each cavity's pin, signal, wire, gauge, terminal, and seal, with crossing-free leaders to the cavity grid. |
| `schematic.html` | Self-contained interactive viewer: hover a net to trace it, zoom, pan. Opens anywhere, no app needed. |
| `bom.csv` | Rolled-up bill of materials with MPNs, quantities, and design-object references. |
| `cut-list.csv` | Per-wire cut lengths, gauges, colors, strip specs. |
| `labels.csv` | Label schedule: text, position, wire/branch reference. |
| `test-plan.csv` | Continuity, splice-verification, and no-short tests derived from the net list. |
| `assembly.md` | Ordered build instructions generated from the design graph. |
| `manufacturing-packet.pdf` | The build book: every drawing and table in one reviewed, printable document. |
| `graph.json` | Connectivity graph: nodes, edges, and computed nets for external tooling. |
| `render-layout.json` | The exact DrawingIR each renderer consumed, so geometry is diffable and re-renderable outside Nerve. |
| `bom.json` / `cut-list.json` / `label-schedule.json` / `diagnostics.json` | Machine-readable twins of the tables, keyed by column. |
| `packet.zip` | Everything above, zipped byte-identically (fixed timestamps) for release archival. |

PNG previews render on demand: `nerve render --format png` (views: `schematic`, `board`, `faces`).

The renderer never owns truth: every line in every artifact traces back to a design object in the HIR.
