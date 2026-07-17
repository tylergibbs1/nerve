import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Landing
})

/** Minimal landing: the pitch on the left, the rover import on the right. */
function Landing() {
  return (
    <div className="landing">
      <section className="landing-copy">
        <h1>Check a harness before it reaches the floor.</h1>
        <p className="landing-sub">
          Nerve is an open-source compiler for wiring harnesses. Bring in a design and it produces
          the diagrams, parts lists, and checks a review needs. A review tool, not a certification
          service.
        </p>
        <div className="landing-links">
          <Link to="/showcase" className="landing-cta">
            See it on real harnesses
          </Link>
          <span className="sep">/</span>
          <Link to="/projects">Browse the examples</Link>
          <span className="sep">/</span>
          <Link to="/docs">Read the docs</Link>
        </div>
      </section>

      <Link to="/showcase" className="landing-proof" aria-label="See the NASA JPL rover harness import">
        <div className="landing-proof-head">
          <span>Real-world test</span>
          <span>NASA JPL open-source rover</span>
        </div>
        <h2>WireViz → Nerve</h2>
        <p>Six real rover harnesses, imported from their original files. Nothing retyped.</p>
        <div className="landing-proof-flow" aria-hidden="true">
          <span>source.yml</span>
          <i />
          <strong>34 checks</strong>
          <i />
          <span>review</span>
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
