import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Landing
})

/** Minimal landing — the marketing surface lives inside the app now. */
function Landing() {
  return (
    <div className="landing">
      <span className="spec-tag">Interconnect Systems</span>
      <h1>Harnesses as code.</h1>
      <p className="landing-sub">
        Typed wiring harnesses, compiled: one source of truth emits the schematics, BOMs, cut
        lists, labels, continuity tests, and build records that ship the machine. Deterministic,
        validated, fail-closed.
      </p>
      <div className="landing-links">
        <Link to="/projects">Open the demo</Link>
        <span className="sep">/</span>
        <a href="https://github.com/tylergibbs1/nerve">Read the source</a>
        <span className="sep">/</span>
        <a href="https://www.npmjs.com/package/@grayhaven/nerve">npm i @grayhaven/nerve</a>
      </div>
    </div>
  )
}
