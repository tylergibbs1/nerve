import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/dsl")({
  component: DslReference
})

const ENTRIES = [
  {
    sig: 'harness(id, { revision, units, connectors, wires, branches?, labels?, splices?, cables? })',
    body: "The root design object. revision and units are required — releases fail closed without them."
  },
  {
    sig: "connector(id, part, { pins })",
    body: "Place a connector from a part definition. pins maps pin numbers to signal names; parts declare pinCount, gender, and wireGaugeRange, and the rules hold wires to them."
  },
  {
    sig: "wire(id, from, to, { gauge, color, length, twistGroup?, current? })",
    body: 'Point-to-point conductor. Endpoints are connector.pin(n) references or splice ids. Gauge strings like "20AWG" are checked against ampacity and the connector range.'
  },
  {
    sig: 'splice(id, { type, notes? })',
    body: 'A junction node ("crimp", "solder", "ultrasonic"). Wires may terminate on a splice; nets are computed across it and splice-verification tests are generated.'
  },
  {
    sig: "cable(id, { conductors, shield? })",
    body: "Groups wires into a multi-conductor cable, optionally shielded. Shield drains must land on a pin or the rules flag it."
  },
  {
    sig: "branch(id, { from, to, length })",
    body: "Physical bundle segment for the board view and cut-length math."
  },
  {
    sig: "label(id, { text, position })",
    body: "Printed label on the loom; exported to the label schedule CSV."
  },
  {
    sig: "variant(base, overrides)",
    body: "Derive a configuration from a base harness — add/remove wires per option code without forking the file."
  },
  {
    sig: "rule(name, run, { code })",
    body: "Author a custom validation rule; report() diagnostics with a stable code. Plug in via defineConfig({ rules })."
  }
] as const

function DslReference() {
  return (
    <>
      <span className="spec-tag">DSL Reference</span>
      <h1>The design surface.</h1>
      <p>
        Everything imports from <code>@grayhaven/nerve</code>. The DSL builds a typed design
        graph; <code>compileDesign</code> lowers it to the versioned HIR that every exporter
        and rule consumes.
      </p>
      {ENTRIES.map((e) => (
        <section key={e.sig} className="doc-entry">
          <pre className="doc-code">{e.sig}</pre>
          <p>{e.body}</p>
        </section>
      ))}
    </>
  )
}
