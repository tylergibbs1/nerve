> Grayhaven Nerve docs index: https://nerve-demo.vercel.app/llms.txt — fetch it to discover all pages before exploring further.

# 17 built-in validation rules.

Stable `HK-*` codes, suitable for CI gating and waivers. This table is generated from the shipped `builtinRules` array in `@grayhaven/nerve-rules` — it cannot drift from the code. Custom rules use the same `rule()` API and get their own codes.

| Code | Rule | Checks |
| --- | --- | --- |
| `HK-DOC-001` | `missingRevision` | Harness must declare a revision — releases fail closed without one. |
| `HK-DOC-002` | `branchMissingLabel` | Bundle branches should carry a printed label. |
| `HK-DOC-003` | `spliceMissingNotes` | Splices should document their joint (type/notes) for the build book. |
| `HK-MFG-001` | `missingWireLength` | Every wire should declare a length; cut lists need real numbers. |
| `HK-MFG-002` | `missingWireColor` | Every wire should declare a color for the cut list and loom work. |
| `HK-MFG-003` | `missingWireGauge` | Every wire must declare a gauge. |
| `HK-MFG-004` | `gaugeOutsideConnectorRange` | Wire gauge must sit inside the connector part's wireGaugeRange. |
| `HK-WIRE-004` | `gaugeCurrentMismatch` | Wire gauge must carry the declared or estimated current (ampacity table). |
| `HK-ELEC-001` | `differentialPairNotTwisted` | Differential pairs (CAN_H/CAN_L…) must share a twist group. |
| `HK-ELEC-002` | `twistGroupTooSmall` | A twist group needs at least two wires. |
| `HK-ELEC-003` | `missingGroundReturn` | Power signals need a ground return path in the same harness. |
| `HK-ELEC-004` | `shieldDrainUnconnected` | Cable shields must land their drain on a pin. |
| `HK-CONN-010` | `unconnectedAssignedPin` | A pin assigned a signal must be touched by at least one wire. |
| `HK-CONN-011` | `wireSignalMismatch` | A wire's endpoints must agree on the signal it carries. |
| `HK-CONN-012` | `terminalIncompatible` | Terminal part must accept the wire gauge crimped into it. |
| `HK-CONN-013` | `missingSeal` | Sealed connector families require a seal part on each wired cavity. |
| `HK-CONN-014` | `sealIncompatible` | Seal part must match the wire gauge it seals. |

## Example diagnostic

```
HK-CONN-011 Error  connector:P1.pin:1
  Wire W2 carries V5 but pin P1.1 is assigned V9.
```

Severity drives exit codes: errors fail `nerve validate` (exit 1), warnings pass with notice. Releases fail closed on any error.
