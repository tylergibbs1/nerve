import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/artifacts")({
  component: Artifacts
})

const ARTIFACTS = [
  ["harness.json", "Canonical HIR — versioned schema, the single source every other artifact derives from."],
  ["schematic.svg", "Connection diagram: connectors, pins, wires with gauge/color annotations."],
  ["board.svg", "Harness-board (nailboard) view at real lengths for the build fixture."],
  ["bom.csv", "Rolled-up bill of materials with MPNs, quantities, and design-object references."],
  ["cut-list.csv", "Per-wire cut lengths, gauges, colors, strip specs."],
  ["labels.csv", "Label schedule: text, position, wire/branch reference."],
  ["test-plan.csv", "Continuity, splice-verification, and no-short tests derived from the net list."],
  ["assembly.md", "Ordered build instructions generated from the design graph."],
  ["manufacturing-packet.pdf", "The build book: every drawing and table in one reviewed, printable document."],
  ["packet.zip", "Everything above, zipped byte-identically (fixed timestamps) for release archival."]
] as const

function Artifacts() {
  return (
    <>
      <span className="spec-tag">Artifacts</span>
      <h1>One compile, every output.</h1>
      <p>
        <code>nerve export</code> emits the complete set. Determinism is load-bearing: the same
        source produces byte-identical bytes — drawings, CSVs, the PDF, even the zip — so
        artifacts diff cleanly in review and hash-verify in CI.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>File</th>
            <th>Contents</th>
          </tr>
        </thead>
        <tbody>
          {ARTIFACTS.map(([file, contents]) => (
            <tr key={file}>
              <td className="cell-code">{file}</td>
              <td className="cell-text">{contents}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The renderer never owns truth — every line in every artifact traces back to a design
        object in the HIR.
      </p>
    </>
  )
}
