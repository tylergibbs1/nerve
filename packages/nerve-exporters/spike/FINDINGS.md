# ELK layout spike — findings (2026-06-06)

Side-by-side of legacy (two-column bezier) vs elkjs layered/orthogonal on
all three examples (`bun spike/compare.ts` → /tmp/elk-compare.html).

## Verdict: do not adopt now

- **Small harnesses (motor-controller, sensor-splice): legacy wins.** The
  two-column layout is compact and readable; ELK as-configured bundled
  parallel wires into a single overhead channel with stacked labels.
- **Large harness (robot-platform): nobody wins.** Legacy is genuine wire
  spaghetti at 65 wires; ELK produced a sparse, oversized canvas, and
  midpoint-placed annotations overlap in shared orthogonal channels. ELK
  needs its REAL edge-label support (ElkLabel on edges, label placement
  options), port-ordering tuning, and channel-density options before it
  beats legacy — a project, not a config flag.

## Adoption costs found by the spike

- elkjs is **async** (Promise-based, worker-backed): adopting it means the
  whole `schematicSvg` pipeline goes async (CLI, worker protocol, tests).
- **~1.4MB** engine: would balloon the 41KB compile worker we just shrank,
  unless layout runs only at export time (plausible split: live view keeps
  legacy, packet export uses ELK).
- bun interop: the bundled entry's fake worker doesn't load under bun; a
  real Web Worker (`workerUrl` + `workerFactory`) is required.

## When to revisit

When large-harness readability becomes a priority: budget for ELK edge
labels, FIXED_ORDER ports with computed sides, layered spacing tuning,
and an async export pipeline. The spike code here is a working starting
point (deterministic, byte-stable given pinned elkjs).
