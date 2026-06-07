# The production lifecycle, end to end.

Design is half the product. The other half is what happens after: releases, build records, technician feedback, and the next revision. Every step below is a real command with its real output, run against the robot-platform example installed from npm.

## 1. Release revision A

A release freezes the design with an ECO, a fingerprint, and fail-closed validation (errors block the export).

```bash
nerve release ./src/main.harness.ts --eco ECO-001 \
  --reason "initial production release" --author tyler \
  --date 2026-06-07 --out dist/releases/A
```

```text
Release robot-platform-harness@A (ECO-001) — fingerprint 2c6a854c9edddae8
```

The fingerprint is a content hash of the HIR: byte-identical inputs always produce it, so anyone can verify a packet matches its release.

## 2. Export the manufacturing packet

```bash
nerve export ./src/main.harness.ts --out dist/packet-A
```

Fifteen files: the PDF build book, schematic / connector-face / board SVGs (+ interactive HTML), BOM / cut-list / label CSVs with JSON twins, `graph.json`, `render-layout.json`, the continuity test plan, and assembly instructions. Hand the zip to the floor.

## 3. Record the build

The tester (or a technician with a multimeter) produces measurements keyed to the generated test plan. The build record ties serial number, operator, lot, and results to the release.

```bash
nerve record ./src/main.harness.ts \
  --release dist/releases/A/release-A.json \
  --serial SN-0001 --operator "j.alvarez" --date 2026-06-07 \
  --lot LOT-26W23 --results dist/results-SN-0001.json --out dist/builds
```

```text
SN-0001: 362 pass / 0 fail / 0 not run → PASS
```

A failing measurement exits nonzero and names the wire, endpoints, and expected state.

## 4. Technician feedback as a redline

On the assembled chassis, `W_BUMP_L_RTN` comes up short. Instead of a PDF markup that dies in a drawer, the technician records it against the design object:

```bash
nerve redline add ./src/main.harness.ts \
  --target wire:W_BUMP_L_RTN --type length \
  --description "W_BUMP_L_RTN arrives 30mm short of the bumper bracket" \
  --value 550 --serial SN-0001 --by "j.alvarez" --file dist/redlines.json
```

```text
Recorded RL-001 against wire:W_BUMP_L_RTN in dist/redlines.json
```

The target is validated — a redline against a wire that doesn't exist is rejected. The engineer reviews and accepts:

```bash
nerve redline resolve dist/redlines.json --id RL-001 \
  --accept true --reason "confirmed against chassis rev3 mounting" \
  --by tyler --date 2026-06-08
```

Acceptance emits a structured patch suggestion; rejection is retained with its reason.

## 5. Revision B

The engineer applies the change in source — `length: 520` becomes `550`, `revision: "A"` becomes `"B"` — and releases against revision A:

```bash
nerve release ./src/main.harness.ts --eco ECO-002 \
  --reason "RL-001: lengthen W_BUMP_L_RTN per chassis rev3" \
  --author tyler --date 2026-06-08 \
  --against dist/releases/A/release-A.json --out dist/releases/B
```

```text
Release robot-platform-harness@B (ECO-002) — fingerprint cef8b86602d8e746 — impact: 2 (low), 0 pinout / 1 wire change(s)
```

The impact analysis is computed from the semantic diff, not from prose: zero pinout changes, one wire change, low risk.

## 6. Review the diff

```bash
nerve diff dist/releases/A dist/releases/B
```

```text
harness:
  ~ revision: A -> B
wires:
  ~ wire:W_BUMP_L_RTN
      length: 520 -> 550
```

The loop is closed: a measurement on a real chassis became a tracked redline, an accepted change, a new fingerprinted release, and a reviewable diff — with the build record of every serial number pointing at exactly the revision it was built from.

That is the whole thesis. The spreadsheet never knew which harness was on which robot; the nervous system does.
