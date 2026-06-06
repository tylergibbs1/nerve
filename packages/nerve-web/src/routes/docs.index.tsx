import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/")({
  component: Quickstart
})

function Quickstart() {
  return (
    <>
      <span className="spec-tag">Quickstart</span>
      <h1>Harnesses are programs.</h1>
      <p>
        A Nerve harness is a TypeScript module. You describe connectors, wires, splices, and
        cables once; the compiler validates the design against electrical and manufacturing
        rules, then emits every artifact a build needs — deterministically.
      </p>

      <h2>Install</h2>
      <pre className="doc-code">{`npm install @grayhaven/nerve @grayhaven/nerve-connectors @grayhaven/nerve-cli

npx --package=@grayhaven/nerve-cli nerve init .
npx --package=@grayhaven/nerve-cli nerve compile ./src/main.harness.ts
npx --package=@grayhaven/nerve-cli nerve export  ./src/main.harness.ts`}</pre>

      <h2>First harness</h2>
      <pre className="doc-code">{`import { harness, connector, wire } from "@grayhaven/nerve"
import { MolexMicroFit } from "@grayhaven/nerve-connectors"

const controller = connector("J1", MolexMicroFit["43025-0800"], {
  pins: { 1: "VBAT_24V", 2: "GND", 3: "CAN_H", 4: "CAN_L" },
})

export default harness("motor-controller-harness", {
  revision: "A",
  units: "mm",
  connectors: [controller, motor],
  wires: [
    wire("W1", controller.pin(1), motor.pin(1), {
      gauge: "20AWG", color: "red", length: 420,
    }),
  ],
})`}</pre>

      <p>
        <code>nerve export</code> writes <code>dist/</code>: the canonical{" "}
        <code>harness.json</code> (HIR), schematic and board SVGs, BOM / cut-list / label CSVs,
        a continuity test plan, assembly instructions, and the PDF manufacturing packet — all
        byte-identical across runs.
      </p>
      <p>
        Or skip the install entirely: <Link to="/projects">the editor in this app</Link>{" "}
        compiles in your browser as you type.
      </p>
    </>
  )
}
