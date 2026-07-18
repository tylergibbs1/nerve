import { createFileRoute } from "@tanstack/react-router"
// Extracted at build time by scripts/gen-llms.ts from the shipped
// connector library (importing the package here would pull the effect
// runtime into this route chunk).
import partsMeta from "../docs/parts-meta.json"

export const Route = createFileRoute("/docs/library")({
  head: () => ({ meta: [{ title: "Part library · Grayhaven Nerve" }] }),
  component: LibraryReference
})

interface PartRow {
  readonly spec?: string
  readonly mpn: string
  readonly family?: string
  readonly description?: string
  readonly pinCount: number
  readonly gender?: string
  readonly verification?: string
}

function LibraryReference() {
  const rows = partsMeta as ReadonlyArray<PartRow>
  const specCount = rows.filter((r) => r.spec !== undefined).length
  return (
    <>
      <span className="spec-tag">Part Library</span>
      <h1>
        {rows.length} connectors, {specCount}+ compact specs.
      </h1>
      <p>
        Reach parts with <code>part("spec")</code> — compact specs beat memorizing MPNs — or any
        raw MPN (case-insensitive; common vendor spellings normalize). This table renders
        extracted at build time from <code>@grayhaven/nerve-connectors</code>.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Spec</th>
            <th>MPN</th>
            <th>Family</th>
            <th>Pins</th>
            <th>Gender</th>
            <th>Verification</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mpn}>
              <td className="cell-code">{r.spec ?? ""}</td>
              <td className="cell-code">{r.mpn}</td>
              <td className="cell-text">{r.family ?? ""}</td>
              <td className="cell-text">{r.pinCount}</td>
              <td className="cell-text">{r.gender ?? ""}</td>
              <td className="cell-text">{r.verification ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Verification states come from part provenance (PRD §30): <code>verified</code> passed a
        datasheet review; <code>inspired-by</code> is seed data awaiting one.
      </p>
    </>
  )
}
