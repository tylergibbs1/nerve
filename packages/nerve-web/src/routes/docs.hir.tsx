import { createFileRoute } from "@tanstack/react-router"
import { Markdown } from "../components/Markdown.js"
import { docsContent } from "../docs/content.js"

export const Route = createFileRoute("/docs/hir")({
  head: () => ({ meta: [{ title: "HIR schema · Grayhaven Nerve" }] }),
  component: Page
})

// Generated from the live Effect schema by scripts/gen-llms.ts (into
// docs-content/hir.md + /docs/hir.md + llms-full.txt) — it cannot drift.
function Page() {
  return (
    <>
      <span className="spec-tag">HIR Schema</span>
      <Markdown src={docsContent("hir")} />
    </>
  )
}
