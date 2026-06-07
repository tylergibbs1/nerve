# nerve: deterministic, CI-ready.

Run via `npx --package=@grayhaven/nerve-cli nerve <command>`. Every command exits nonzero on validation errors, and every artifact is byte-identical for the same input.

| Command | Does |
| --- | --- |
| `nerve init` | Scaffold a harness project (nerve.config.ts, src/main.harness.ts). |
| `nerve compile` | Compile to HIR; print diagnostics; nonzero exit on errors. |
| `nerve validate` | Compile + rules only, the CI gate. Exit code mirrors severity. |
| `nerve render` | Schematic / board SVG from the HIR. |
| `nerve export` | Everything: HIR, drawings, CSVs, test plan, assembly steps, PDF packet + zip. |
| `nerve import` | WireViz YAML → Nerve harness source. |
| `nerve diff` | Semantic diff between two revisions, down to a single pin swap. |
| `nerve inspect` | Query the HIR (nets, pins, wires) from the terminal. |
| `nerve quote` | Cost roll-up from the BOM with a pricing model. |
| `nerve analyze` | Electrical analysis: voltage drop, current per wire. |
| `nerve machine` | Machine-readable exports for cutting/marking equipment. |
| `nerve contract` | Manufacturing contract bundle for an external shop. |
| `nerve release` | Cut a release: fail-closed validation + frozen artifact set. |
| `nerve record` | Build record for a completed unit (serials, operators, results). |
| `nerve redline` | Capture as-built deviations against the released design. |

## CI example

```yaml
- name: Validate harness
  run: npx --package=@grayhaven/nerve-cli nerve validate ./src/main.harness.ts
# Exit 1 on any HK-* error; the release gate fails closed.
```
