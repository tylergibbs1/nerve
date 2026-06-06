import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { compileQueryOptions, useDiagnosticCounts } from "../lib/compile-client.js"
import { DiagnosticsPanel } from "../components/DiagnosticsPanel.js"
import { isDirty } from "../lib/sources.js"
import { PROJECTS } from "../lib/projects.js"

export const Route = createFileRoute("/projects/$projectId")({
  beforeLoad: ({ params }) => {
    if (!PROJECTS.some((p) => p.id === params.projectId)) throw notFound()
  },
  // Intent preloading (hover a project card) compiles in the worker
  // before the click; staleTime: Infinity makes the preload stick.
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(compileQueryOptions(params.projectId)),
  pendingComponent: () => <div className="status">Compiling in worker…</div>,
  errorComponent: ({ error }) => (
    <div className="status error">Compile failed: {String(error)}</div>
  ),
  notFoundComponent: () => (
    <div className="status error">
      No such project. <Link to="/projects">Back to projects</Link>
    </div>
  ),
  component: ProjectWorkspace
})

const TABS = [
  { to: "/projects/$projectId/source", label: "Source" },
  { to: "/projects/$projectId/diagram", label: "Diagram" },
  { to: "/projects/$projectId/board", label: "Board" },
  { to: "/projects/$projectId/bom", label: "BOM" },
  { to: "/projects/$projectId/cut-list", label: "Cut list" },
  { to: "/projects/$projectId/labels", label: "Labels" },
  { to: "/projects/$projectId/tests", label: "Tests" }
] as const

function ProjectWorkspace() {
  const { projectId } = Route.useParams()
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))
  const { data: counts } = useDiagnosticCounts(projectId)
  const errors = counts?.errors ?? 0
  const warnings = counts?.warnings ?? 0

  return (
    <div className="workspace">
      <div className="workspace-header">
        <h2>{data.hir.harness.id}</h2>
        <span className="meta">
          rev {data.hir.harness.revision} · {data.hir.connectors.length} connectors ·{" "}
          {data.hir.wires.length} wires
        </span>
        <span className={`badge ${errors > 0 ? "err" : warnings > 0 ? "warn" : "ok"}`}>
          {errors > 0
            ? `${errors} error${errors === 1 ? "" : "s"}`
            : warnings > 0
              ? `${warnings} warning${warnings === 1 ? "" : "s"}`
              : "valid"}
        </span>
        <nav className="tabs">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ projectId }}
              activeProps={{ className: "active" }}
            >
              {tab.label === "Source" && isDirty(projectId) ? "Source •" : tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="workspace-body">
        <Outlet />
      </div>
      <DiagnosticsPanel diagnostics={data.hir.diagnostics} />
    </div>
  )
}
