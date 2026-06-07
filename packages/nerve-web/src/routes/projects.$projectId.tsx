import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router"
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels"
import { useSuspenseQuery } from "@tanstack/react-query"
import { compileQueryOptions, countDiagnostics } from "../lib/compile-client.js"
import { DiagnosticsPanel } from "../components/DiagnosticsPanel.js"
import { SourcePane } from "../components/SourcePane.js"
import { AiPane } from "../components/AiPane.js"
import { isDirty } from "../lib/sources.js"
import { PROJECTS } from "../lib/projects.js"
import { Badge } from "../ui/badge.js"

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

// PRD §11.1 split workspace: source on the left, the selected render view
// on the right. Tabs switch only the right pane.
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
  const workspaceLayout = useDefaultLayout({ id: "nerve-workspace-3", panelIds: ["ai", "source", "render"] })
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))
  const { errors, warnings } = countDiagnostics(data.hir.diagnostics)

  return (
    <div className="workspace">
      <div className="workspace-header">
        <h2>
          {data.hir.harness.id}
          {isDirty(projectId) ? " •" : ""}
        </h2>
        <span className="meta">
          rev {data.hir.harness.revision} · {data.hir.connectors.length} connectors ·{" "}
          {data.hir.wires.length} wires
        </span>
        <Badge variant={errors > 0 ? "destructive" : warnings > 0 ? "accent" : "default"}>
          {errors > 0
            ? `${errors} error${errors === 1 ? "" : "s"}`
            : warnings > 0
              ? `${warnings} warning${warnings === 1 ? "" : "s"}`
              : "valid"}
        </Badge>
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
      {/* Datum-style resizable split; layout persisted to localStorage. */}
      <Group
        orientation="horizontal"
        className="workspace-split"
        {...workspaceLayout}
      >
        <Panel id="ai" defaultSize="22%" minSize="220px" maxSize="34%" collapsible>
          <AiPane projectId={projectId} />
        </Panel>
        <Separator className="pane-handle" />
        <Panel id="source" defaultSize="38%" minSize="300px" maxSize="60%" collapsible>
          <SourcePane projectId={projectId} />
        </Panel>
        <Separator className="pane-handle" />
        <Panel id="render" minSize="25%">
          <div className="render-pane">
            <Outlet />
          </div>
        </Panel>
      </Group>
      <DiagnosticsPanel diagnostics={data.hir.diagnostics} />
    </div>
  )
}
