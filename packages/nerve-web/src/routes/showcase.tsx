import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { isPinEndpoint, type Diagnostic, type HirEndpoint } from "@grayhaven/nerve"
import { SchematicSheet } from "../components/SchematicSheet.js"
import {
  JPL_HARNESSES,
  JPL_SHOWCASE_SUMMARY,
  JPL_SOURCE,
  type JplHarnessProof
} from "../showcase/jpl-rover.js"
import { Button } from "../ui/button.js"

export const Route = createFileRoute("/showcase")({
  component: RoverShowcase
})

const sourceUrl = `${JPL_SOURCE.repository}/tree/${JPL_SOURCE.commit}/${JPL_SOURCE.path}`

const endpoint = (value: HirEndpoint): string =>
  isPinEndpoint(value) ? `${value.connector}.${value.pin}` : `splice:${value.splice}`

const diagnosticCount = (diagnostics: ReadonlyArray<Diagnostic>, severity: string): number =>
  diagnostics.filter((diagnostic) => diagnostic.severity === severity).length

function Finding({ diagnostic }: { diagnostic: Diagnostic }) {
  return (
    <li className={`showcase-finding finding-${diagnostic.severity}`}>
      <div className="showcase-finding-code">
        <span>{diagnostic.code}</span>
        <span>{diagnostic.severity}</span>
      </div>
      <p>{diagnostic.message}</p>
      {diagnostic.target !== undefined && <code>{diagnostic.target}</code>}
    </li>
  )
}

function ProofStage({ proof }: { proof: JplHarnessProof }) {
  const importErrors = diagnosticCount(proof.importDiagnostics, "error")
  const importWarnings = diagnosticCount(proof.importDiagnostics, "warning")
  const reviewErrors = diagnosticCount(proof.reviewDiagnostics, "error")

  return (
    <section className="showcase-stage" aria-label="WireViz to Nerve comparison">
      <div className="showcase-source">
        <div className="showcase-panel-head">
          <div>
            <span className="showcase-kicker">WireViz source</span>
            <h2>{proof.title}</h2>
          </div>
          <span className="showcase-file">{proof.slug.replaceAll("-", "_")}.yml</span>
        </div>
        <pre tabIndex={0} aria-label={`${proof.name} WireViz source`}>
          <code>{proof.source}</code>
        </pre>
        <div className="showcase-source-foot">
          <span>+ shared templates.yml</span>
          <span>{proof.source.split("\n").length} source lines</span>
        </div>
      </div>

      <div className="showcase-transform" aria-hidden="true">
        <span>Imported</span>
        <div />
        <strong>→</strong>
      </div>

      <div className="showcase-evidence">
        <div className="showcase-panel-head">
          <div>
            <span className="showcase-kicker">Nerve review</span>
            <h2>What the review found</h2>
          </div>
          <span className={`showcase-gate ${proof.releaseReady ? "gate-clear" : "gate-blocked"}`}>
            {proof.releaseReady ? "No blockers" : "Release blocked"}
          </span>
        </div>

        <div className="showcase-ledger">
          <div>
            <span>Import</span>
            <strong>{importErrors} errors</strong>
            <small>{proof.hir.wires.length} wires imported</small>
          </div>
          <div>
            <span>Checks</span>
            <strong>{reviewErrors} findings</strong>
            <small>{JPL_SHOWCASE_SUMMARY.ruleCount} checks run</small>
          </div>
          <div>
            <span>Fingerprint</span>
            <strong>{proof.fingerprint.slice(0, 8)}</strong>
            <small>stable ID for this exact design</small>
          </div>
        </div>

        {proof.reviewDiagnostics.length > 0 ? (
          <ol className="showcase-findings">
            {proof.reviewDiagnostics.map((diagnostic, index) => (
              <Finding key={`${diagnostic.code}-${diagnostic.target ?? index}`} diagnostic={diagnostic} />
            ))}
          </ol>
        ) : (
          <div className="showcase-no-findings">
            <strong>No checks flagged anything in this design.</strong>
            <p>It still needs a normal engineering review of the design and its source data.</p>
          </div>
        )}

        <details className="showcase-import-notes">
          <summary>{importWarnings} import note{importWarnings === 1 ? "" : "s"}</summary>
          <ul>
            {proof.importDiagnostics
              .filter((diagnostic) => diagnostic.severity === "warning")
              .map((diagnostic, index) => (
                <li key={`${diagnostic.message}-${index}`}>{diagnostic.message}</li>
              ))}
          </ul>
        </details>
      </div>
    </section>
  )
}

function ConductorTable({ proof }: { proof: JplHarnessProof }) {
  return (
    <div className="showcase-table-wrap" tabIndex={0} role="region" aria-label="Imported wire data">
      <table className="showcase-wire-table">
        <thead>
          <tr>
            <th>Wire</th>
            <th>Signal</th>
            <th>From</th>
            <th>To</th>
            <th>Gauge</th>
            <th>Color</th>
            <th>Cut length</th>
          </tr>
        </thead>
        <tbody>
          {proof.hir.wires.map((wire) => (
            <tr key={wire.id}>
              <td>{wire.id}</td>
              <td>{wire.signal ?? "—"}</td>
              <td>{endpoint(wire.from)}</td>
              <td>{endpoint(wire.to)}</td>
              <td>{wire.gauge ?? "—"}</td>
              <td>
                <span className="showcase-color">
                  <i style={{ backgroundColor: wire.color ?? "transparent" }} />
                  {wire.color ?? "—"}
                </span>
              </td>
              <td>{wire.length === undefined ? "—" : `${wire.length} mm`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ArtifactRail({ proof }: { proof: JplHarnessProof }) {
  const [exportState, setExportState] = useState<"idle" | "building" | "done" | "error">("idle")

  const downloadPacket = async () => {
    setExportState("building")
    try {
      const { buildPacket } = await import("@grayhaven/nerve-exporters")
      const packet = await buildPacket(proof.hir)
      const bytes = new Uint8Array(packet.zip)
      const url = URL.createObjectURL(new Blob([bytes.buffer], { type: "application/zip" }))
      const link = document.createElement("a")
      link.href = url
      link.download = `${proof.hir.harness.id}-packet.zip`
      link.click()
      URL.revokeObjectURL(url)
      setExportState("done")
    } catch {
      setExportState("error")
    }
  }

  return (
    <section className="showcase-artifacts">
      <div className="showcase-section-head">
        <h2>One source file becomes a review page and a build packet.</h2>
        <p>
          Everything here is generated from the imported design, not prepared by hand. The packet
          carries the findings with it, even when release is blocked.
        </p>
      </div>
      <div className="showcase-artifact-rail">
        <div>
          <span>Inspect</span>
          <strong>design data · findings · graph</strong>
        </div>
        <div>
          <span>Build</span>
          <strong>BOM · cut list · labels · instructions</strong>
        </div>
        <div>
          <span>Test</span>
          <strong>{proof.testPlan.tests.length} continuity + isolation steps</strong>
        </div>
        <div>
          <span>Communicate</span>
          <strong>SVG · HTML · PDF · machine-readable JSON</strong>
        </div>
      </div>
      <div className="showcase-export">
        <Button onClick={() => void downloadPacket()} disabled={exportState === "building"}>
          {exportState === "building"
            ? "Building packet…"
            : exportState === "done"
              ? "Packet downloaded ✓"
              : "Download the packet (22 files)"}
        </Button>
        <span>
          {exportState === "error"
            ? "Packet generation failed. Try again."
            : "Generated locally in your browser. Nothing is uploaded."}
        </span>
      </div>
    </section>
  )
}

function RoverShowcase() {
  const [selectedSlug, setSelectedSlug] = useState(JPL_HARNESSES[0]!.slug)
  const proof = JPL_HARNESSES.find((candidate) => candidate.slug === selectedSlug) ?? JPL_HARNESSES[0]!

  return (
    <article className="showcase">
      <header className="showcase-hero">
        <span className="spec-tag">Real harnesses from the NASA JPL open-source rover</span>
        <h1>
          WireViz describes it.
          <br />
          <span>Nerve makes it reviewable.</span>
        </h1>
        <p>
          Six real harness designs from the NASA/JPL Open Source Rover, imported from their original
          WireViz YAML. Nothing retyped. No cleaned-up demo data. Every finding remains visible.
        </p>
        <div className="showcase-provenance">
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            View the original files ↗
          </a>
          <span>{JPL_SHOWCASE_SUMMARY.conductors} wires across six harnesses</span>
        </div>
      </header>

      <nav className="showcase-picker" aria-label="Choose a rover harness">
        {JPL_HARNESSES.map((candidate) => (
          <button
            key={candidate.slug}
            type="button"
            aria-pressed={candidate.slug === proof.slug}
            onClick={() => setSelectedSlug(candidate.slug)}
          >
            <span>{candidate.name}</span>
            <small>
              {candidate.hir.wires.length} wires · {candidate.reviewDiagnostics.length} findings
            </small>
          </button>
        ))}
      </nav>

      <ProofStage proof={proof} />

      <section className="showcase-drawing">
        <div className="showcase-subhead">
          <h2>The same facts, now traceable.</h2>
          <p>Hover a wire to follow it. The SVG is generated straight from the imported design data.</p>
        </div>
        <SchematicSheet
          svg={proof.schematic}
          filename={`${proof.hir.harness.id}-schematic.svg`}
          hir={proof.hir}
          kind="schematic"
        />
      </section>

      <section className="showcase-conductors">
        <div className="showcase-subhead">
          <h2>Pin by pin. Wire by wire.</h2>
          <p>
            The importer keeps endpoints, signals, gauges, colors, and lengths so everything can be
            checked against the original YAML.
          </p>
        </div>
        <ConductorTable proof={proof} />
      </section>

      <ArtifactRail proof={proof} />

      <section className="showcase-difference">
        <div className="showcase-section-head">
          <h2>WireViz is the source. Nerve is the review step after it.</h2>
          <p>
            This is not a replacement pitch. WireViz gives engineers concise wiring docs and
            diagrams. Nerve reads those files and adds repeatable checks and a reviewable record.
          </p>
        </div>
        <table className="showcase-comparison" aria-label="WireViz and Nerve comparison">
          <thead>
            <tr className="comparison-head">
              <th scope="col">WireViz</th>
              <th scope="col">Nerve adds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Readable YAML for connectors, cables, and connections</td>
              <td>A typed model of the design with a stable fingerprint</td>
            </tr>
            <tr>
              <td>Wiring diagrams and source-level documentation</td>
              <td>{JPL_SHOWCASE_SUMMARY.ruleCount} repeatable checks that can block a release</td>
            </tr>
            <tr>
              <td>A strong design description</td>
              <td>BOM, cut list, labels, test plan, PDF, and machine-readable files</td>
            </tr>
            <tr>
              <td>The facts the author supplied</td>
              <td>A review record that says what was checked and what remains unknown</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="showcase-caveat">
        <strong>What this does and does not say.</strong>
        <p>
          Nerve imported the original open-source files exactly as published and checked what they
          state. Findings are prompts for an engineer to review, not a claim that the physical rover
          harness is unsafe, not a certification, and not an endorsement by NASA or JPL. For example,{" "}
          <code>G</code> versus <code>GND</code> may be an intentional alias that an engineer should
          confirm and record. Source: {JPL_SOURCE.license}, commit {JPL_SOURCE.commit.slice(0, 8)}.
        </p>
      </footer>
    </article>
  )
}
