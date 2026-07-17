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
            <span className="showcase-kicker">Input / WireViz YAML</span>
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
            <span className="showcase-kicker">Output / Nerve review gate</span>
            <h2>Inspectable evidence</h2>
          </div>
          <span className={`showcase-gate ${proof.releaseReady ? "gate-clear" : "gate-blocked"}`}>
            {proof.releaseReady ? "Gate clear" : "Review blocked"}
          </span>
        </div>

        <div className="showcase-ledger">
          <div>
            <span>Import integrity</span>
            <strong>{importErrors} errors</strong>
            <small>{proof.hir.wires.length} conductors normalized</small>
          </div>
          <div>
            <span>Rule review</span>
            <strong>{reviewErrors} findings</strong>
            <small>{JPL_SHOWCASE_SUMMARY.ruleCount} stable checks evaluated</small>
          </div>
          <div>
            <span>Release identity</span>
            <strong>{proof.fingerprint.slice(0, 8)}</strong>
            <small>versioned HIR fingerprint</small>
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
            <strong>No rule findings on the supplied facts.</strong>
            <p>The design still requires the normal engineering review and source-data checks.</p>
          </div>
        )}

        <details className="showcase-import-notes">
          <summary>{importWarnings} transparent import note{importWarnings === 1 ? "" : "s"}</summary>
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
    <div className="showcase-table-wrap" tabIndex={0} role="region" aria-label="Imported conductor data">
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
      link.download = `${proof.hir.harness.id}-evidence-packet.zip`
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
        <span className="showcase-kicker">What Nerve adds</span>
        <h2>One source becomes a review surface and a build packet.</h2>
        <p>
          These are generated from the normalized design—not manually prepared examples. The packet
          carries the findings with it, even when the release gate is blocked.
        </p>
      </div>
      <div className="showcase-artifact-rail">
        <div>
          <span>Inspect</span>
          <strong>HIR · diagnostics · graph</strong>
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
          <strong>SVG · HTML · PDF · machine JSON</strong>
        </div>
      </div>
      <div className="showcase-export">
        <Button onClick={() => void downloadPacket()} disabled={exportState === "building"}>
          {exportState === "building"
            ? "Building packet…"
            : exportState === "done"
              ? "Packet downloaded ✓"
              : "Download 22-file evidence packet"}
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
        <span className="spec-tag">Open corpus / proof 01</span>
        <h1>
          WireViz describes it.
          <br />
          <span>Nerve makes it reviewable.</span>
        </h1>
        <p>
          Six real harness designs from the NASA/JPL Open Source Rover, imported from their original
          WireViz YAML. No re-entry. No cleaned-up demo data. Every finding remains visible.
        </p>
        <div className="showcase-provenance">
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            View pinned upstream source ↗
          </a>
          <span>{JPL_SOURCE.license}</span>
          <span>commit {JPL_SOURCE.commit.slice(0, 8)}</span>
          <span>{JPL_SHOWCASE_SUMMARY.conductors} conductors across the corpus</span>
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
        <div className="showcase-section-head">
          <span className="showcase-kicker">Normalized drawing</span>
          <h2>The same facts, now traceable.</h2>
          <p>Hover a conductor to follow it. The SVG is generated directly from Nerve’s versioned HIR.</p>
        </div>
        <SchematicSheet
          svg={proof.schematic}
          filename={`${proof.hir.harness.id}-schematic.svg`}
          hir={proof.hir}
          kind="schematic"
        />
      </section>

      <section className="showcase-conductors">
        <div className="showcase-section-head">
          <span className="showcase-kicker">Preserved manufacturing facts</span>
          <h2>Pin by pin. Conductor by conductor.</h2>
          <p>
            The importer retains endpoints, signals, gauges, colors, and explicit length units so the
            review evidence can be checked against the original YAML.
          </p>
        </div>
        <ConductorTable proof={proof} />
      </section>

      <ArtifactRail proof={proof} />

      <section className="showcase-difference">
        <div className="showcase-section-head">
          <span className="showcase-kicker">Different jobs, one workflow</span>
          <h2>WireViz is the source. Nerve is the downstream review gate.</h2>
          <p>
            This is not a replacement pitch. WireViz gives engineers concise wiring documentation and
            diagrams. Nerve ingests those facts and adds deterministic review and release evidence.
          </p>
        </div>
        <div className="showcase-comparison" role="table" aria-label="WireViz and Nerve comparison">
          <div className="comparison-head" role="row">
            <span role="columnheader">WireViz</span>
            <span role="columnheader">Nerve adds</span>
          </div>
          <div role="row">
            <span role="cell">Readable YAML for connectors, cables, and connections</span>
            <span role="cell">Versioned HIR with a stable content fingerprint</span>
          </div>
          <div role="row">
            <span role="cell">Wiring diagrams and source-level documentation</span>
            <span role="cell">34 stable HK checks with explicit review blockers</span>
          </div>
          <div role="row">
            <span role="cell">A strong design description</span>
            <span role="cell">BOM, cut list, labels, test plan, PDF, and machine artifacts</span>
          </div>
          <div role="row">
            <span role="cell">The facts the author supplied</span>
            <span role="cell">A review record that says what was checked and what remains unknown</span>
          </div>
        </div>
      </section>

      <footer className="showcase-caveat">
        <strong>What this proof does—and does not—say.</strong>
        <p>
          Nerve imported the pinned open-source corpus and evaluated the supplied semantics. Findings are
          deterministic review prompts, not a claim that the physical rover harness is unsafe, not a
          certification, and not an endorsement by NASA or JPL. For example, <code>G</code> versus{" "}
          <code>GND</code> may be an intentional alias that an engineer should explicitly disposition.
        </p>
      </footer>
    </article>
  )
}
