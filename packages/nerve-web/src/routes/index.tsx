import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Landing
})

/** Landing for the open verification substrate and its inspectable corpus proof. */
function Landing() {
  return (
    <div className="landing">
      <section className="landing-copy">
        <span className="spec-tag">Open harness verification compiler</span>
        <h1>Check a harness before it reaches the floor.</h1>
        <p className="landing-sub">
          Nerve turns existing harness data into stable findings and reproducible review evidence.
          Keep the source tool. Add the gate.
        </p>
        <div className="landing-links">
          <Link to="/showcase" className="landing-cta">
            Inspect the rover proof
          </Link>
          <span className="sep">/</span>
          <Link to="/projects">Open the workspace</Link>
          <span className="sep">/</span>
          <Link to="/docs">Run a review</Link>
        </div>
      </section>

      <Link to="/showcase" className="landing-proof" aria-label="Inspect the NASA/JPL rover harness proof">
        <div className="landing-proof-head">
          <span>Open corpus / proof 01</span>
          <span>NASA/JPL source ↗</span>
        </div>
        <h2>WireViz → Nerve</h2>
        <p>Six real rover harnesses. Original YAML in. Review evidence out.</p>
        <div className="landing-proof-flow" aria-hidden="true">
          <span>source.yml</span>
          <i />
          <strong>34×</strong>
          <i />
          <span>review gate</span>
        </div>
        <dl>
          <div>
            <dt>Import</dt>
            <dd>0 errors</dd>
          </div>
          <div>
            <dt>Front encoder</dt>
            <dd>2 findings</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd>22 files</dd>
          </div>
        </dl>
      </Link>
    </div>
  )
}
