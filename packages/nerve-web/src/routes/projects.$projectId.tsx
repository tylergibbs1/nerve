import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { useCompile } from "../lib/compile-client.js"
import { DiagnosticsPanel } from "../components/DiagnosticsPanel.js"
import { PROJECTS } from "../lib/projects.js"

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectWorkspace
})

const TABS = [
  { to: "/projects/$projectId/diagram", label: "Diagram" },
  { to: "/projects/$projectId/board", label: "Board" },
  { to: "/projects/$projectId/bom", label: "BOM" },
  { to: "/projects/$projectId/cut-list", label: "Cut list" },
  { to: "/projects/$projectId/labels", label: "Labels" },
  { to: "/projects/$projectId/tests", label: "Tests" }
] as const

function ProjectWorkspace() {
  const { projectId } = Route.useParams()
  const meta = PROJECTS.find((p) => p.id === projectId)
  const { data, isPending, isError, error } = useCompile(projectId)

  const errors = data?.hir.diagnostics.filter((d) => d.severity === "error").length ?? 0
  const warnings = data?.hir.diagnostics.filter((d) => d.severity === "warning").length ?? 0

  return (
    <div className="workspace">
      <div className="workspace-header">
        <h2>{data?.hir.harness.id ?? meta?.name ?? projectId}</h2>
        {data !== undefined && (
          <>
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
          </>
        )}
        <nav className="tabs">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ projectId }}
              activeProps={{ className: "active" }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="workspace-body">
        {isPending && <div className="status">Compiling in worker…</div>}
        {isError && <div className="status error">Compile failed: {String(error)}</div>}
        {data !== undefined && <Outlet />}
      </div>
      {data !== undefined && <DiagnosticsPanel diagnostics={data.hir.diagnostics} />}
    </div>
  )
}
