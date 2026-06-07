# The design surface.

Everything imports from `@grayhaven/nerve`. The DSL builds a typed design graph; `compileDesign` lowers it to the versioned HIR that every exporter and rule consumes.

## harness(id, options)

```ts
harness(id, { revision, units, connectors, wires, branches?, labels?, splices?, cables? })
```

The root design object. `revision` and `units` are required; releases fail closed without them.

## connector(id, part, { pins })

Place a connector from a part definition. `pins` maps pin numbers to signal names; parts declare `pinCount`, `gender`, and `wireGaugeRange`, and the rules hold wires to them.

## wire(id, from, to, options)

```ts
wire(id, from, to, { gauge, color, length, twistGroup?, current? })
```

Point-to-point conductor. Endpoints are `connector.pin(n)` references or splice ids. Gauge strings like `"20AWG"` are checked against ampacity and the connector range.

## splice(id, { type, notes? })

A junction node (`"crimp"`, `"solder"`, `"ultrasonic"`). Wires may terminate on a splice; nets are computed across it and splice-verification tests are generated.

## cable(id, { conductors, shield? })

Groups wires into a multi-conductor cable, optionally shielded. Shield drains must land on a pin or the rules flag it.

## branch(id, { from, to, length })

Physical bundle segment for the board view and cut-length math.

## label(id, { text, position })

Printed label on the loom; exported to the label schedule CSV.

## variant(base, overrides)

Derive a configuration from a base harness: add/remove wires per option code without forking the file.

## rule(name, run, { code })

Author a custom validation rule; `report()` diagnostics with a stable code. Plug in via `defineConfig({ rules })`.
