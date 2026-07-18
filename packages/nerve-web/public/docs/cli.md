> Grayhaven Nerve docs index: https://nerve.grayhavenindustries.com/llms.txt. Fetch it to discover all pages before exploring further.

# Deterministic review from the command line

Run via `npx --package=@grayhaven/nerve-cli nerve <command>`. Every command exits nonzero on validation errors, and every artifact is byte-identical for the same input. With `entry` set in nerve.config.ts, the file argument is optional.

| Command | Does |
| --- | --- |
| `nerve init` | Scaffold a complete project: config, harness, package.json, tsconfig, .gitignore. |
| `nerve setup` | Write CI workflows: validate, snapshot, and byte-reproducibility gates. |
| `nerve compile` | Compile to HIR; print diagnostics; nonzero exit on errors. |
| `nerve dev` | Watch + recompile + live browser preview (schematic/board/faces/pinout). |
| `nerve snapshot` | Committed visual snapshots, byte-exact; `--update` to accept, `--ci` for pixel diffs. |
| `nerve validate` | Compile + rules only, the CI gate. Exit code mirrors severity. |
| `nerve review` | Write a versioned finding report with rule coverage, fingerprint, and limitations. |
| `nerve eval` | Evaluate a provenance-labeled rule corpus and write its scorecard. |
| `nerve render` | Schematic / board / faces / pinout SVG (or PNG) from the HIR. |
| `nerve export` | Everything: HIR, drawings, CSVs, test plan, assembly steps, PDF packet + zip. |
| `nerve import` | Import WireViz YAML or map CSV/Excel rows into reviewable Nerve output. |
| `nerve diff` | Semantic diff between two revisions, down to a single pin swap. |
| `nerve inspect` | Query the HIR (nets, pins, wires) from the terminal. |
| `nerve quote` | Cost roll-up from the BOM with a pricing model. |
| `nerve analyze` | Electrical analysis: voltage drop, current per wire. |
| `nerve machine` | Machine-readable exports for cutting/marking equipment. |
| `nerve contract` | Compare a harness connector with JSON, CSV, tscircuit, or a KiCad board. |
| `nerve release` | Cut a release: fail-closed validation + frozen artifact set. |
| `nerve record` | Build record for a completed unit (serials, operators, results). |
| `nerve redline` | Capture as-built deviations against the released design. |
| `nerve parts` | Browse the bundled connector library (specs, MPNs, limits; `--json`). |

WireViz imports accept `--prepend-file templates.yml` for projects that keep YAML anchors separately. Named template instances, pin/conductor labels, ranges, and explicit length units are normalized into HIR; lossy constructs remain visible as `HK-WV-001` diagnostics.

## CI example

```yaml
- name: Validate harness
  run: npx --package=@grayhaven/nerve-cli nerve validate ./src/main.harness.ts
# Exit 1 on any HK-* error; the release gate fails closed.
```
