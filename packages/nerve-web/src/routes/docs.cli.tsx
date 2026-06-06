import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/cli")({
  component: CliReference
})

const COMMANDS = [
  ["init", "Scaffold a harness project (nerve.config.ts, src/main.harness.ts)."],
  ["compile", "Compile to HIR; print diagnostics; nonzero exit on errors."],
  ["validate", "Compile + rules only — the CI gate. Exit code mirrors severity."],
  ["render", "Schematic / board SVG from the HIR."],
  ["export", "Everything: HIR, drawings, CSVs, test plan, assembly steps, PDF packet + zip."],
  ["import", "WireViz YAML → Nerve harness source."],
  ["diff", "Semantic diff between two revisions, down to a single pin swap."],
  ["inspect", "Query the HIR (nets, pins, wires) from the terminal."],
  ["quote", "Cost roll-up from the BOM with a pricing model."],
  ["analyze", "Electrical analysis: voltage drop, current per wire."],
  ["machine", "Machine-readable exports for cutting/marking equipment."],
  ["contract", "Manufacturing contract bundle for an external shop."],
  ["release", "Cut a release: fail-closed validation + frozen artifact set."],
  ["record", "Build record for a completed unit (serials, operators, results)."],
  ["redline", "Capture as-built deviations against the released design."]
] as const

function CliReference() {
  return (
    <>
      <span className="spec-tag">CLI</span>
      <h1>nerve — deterministic, CI-ready.</h1>
      <p>
        Run via <code>npx --package=@grayhaven/nerve-cli nerve &lt;command&gt;</code>. Every
        command exits nonzero on validation errors, and every artifact is byte-identical for
        the same input.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Command</th>
            <th>Does</th>
          </tr>
        </thead>
        <tbody>
          {COMMANDS.map(([cmd, does]) => (
            <tr key={cmd}>
              <td className="cell-code">nerve {cmd}</td>
              <td className="cell-text">{does}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
