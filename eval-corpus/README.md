# Public evaluation corpus

This directory tests whether Nerve emits specific findings for known fixtures. It is a software regression corpus, not evidence of field accuracy.

Every case declares its provenance. The public repository currently contains synthetic and datasheet-derived cases only. The runtime decoder accepts `field-verified` provenance only when the case records a reviewer role and review date.

The manifest format is described by [`manifest.schema.json`](./manifest.schema.json). The CLI also validates it at runtime before loading any fixture module.

Run:

```bash
bun run nerve eval ./eval-corpus/manifest.json --out ./dist/eval
```

An evaluation assertion names the finding that must or must not appear. Other diagnostics are recorded as `unassertedFindings`. They are not automatically called false positives because that judgment requires an engineering reviewer.
