import { createFileRoute, Link, notFound, Outlet, retainSearchParams } from "@tanstack/react-router"
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels"
import { useSuspenseQuery } from "@tanstack/react-query"
import { compileQueryOptions, exportPacket } from "../lib/compile-client.js"
import { useRef, useState } from "react"
import { Button } from "../ui/button.js"
import { Input } from "../ui/input.js"
import { SearchBox } from "../components/SearchBox.js"
import { DiagnosticsPanel } from "../components/DiagnosticsPanel.js"
import { SourcePane } from "../components/SourcePane.js"
import { RenderErrorBoundary } from "../components/RenderErrorBoundary.js"
import { AiPane } from "../components/AiPane.js"
import { useIsDirty } from "../lib/useSources.js"
import { projectMeta } from "../lib/projects.js"

export const Route = createFileRoute("/projects/$projectId")({
  search: {
    // Sorting a table then visiting Diagram and back keeps the sort.
    middlewares: [retainSearchParams(["sortBy", "desc"])]
  },
  beforeLoad: ({ params }) => {
    if (projectMeta(params.projectId) === undefined) throw notFound()
  },
  head: ({ params }) => ({ meta: [{ title: `${params.projectId} · Grayhaven Nerve` }] }),
  // Intent preloading (hover a project card) compiles in the worker
  // before the click; staleTime: Infinity makes the preload stick.
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(compileQueryOptions(params.projectId)),
  pendingComponent: () => <div className="status">Compiling…</div>,
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
  { to: "/projects/$projectId/connectors", label: "Connectors" },
  { to: "/projects/$projectId/board", label: "Board" },
  { to: "/projects/$projectId/bom", label: "BOM" },
  { to: "/projects/$projectId/cut-list", label: "Cut list" },
  { to: "/projects/$projectId/labels", label: "Labels" },
  { to: "/projects/$projectId/tests", label: "Tests" }
] as const

function ExportButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const run = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const zip = await exportPacket(projectId)
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `${projectId}-packet.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant="secondary" size="xs" disabled={busy} onClick={() => void run()}>
        {busy ? "Exporting…" : "Export packet"}
      </Button>
      {failed && <span className="compile-error">Export failed. Try again.</span>}
    </>
  )
}

/** Copy a zero-backend share link: the source gzipped into the fragment. */
function ShareButton({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | undefined>(undefined)
  const run = async () => {
    const [{ shareUrl }, { getFiles }] = await Promise.all([
      import("../lib/share.js"),
      import("../lib/sources.js")
    ])
    // Encode the whole project so multi-file projects don't lose their
    // extra files; single-entry projects still get a compact v1 link.
    const url = shareUrl(getFiles(projectId))
    try {
      await navigator.clipboard.writeText(url)
      setFallbackUrl(undefined)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Safari can reject writeText once the user-gesture window expires
      // during the awaits above; show the link for manual copy instead.
      setFallbackUrl(url)
    }
  }
  return (
    <>
      <Button variant="secondary" size="xs" onClick={() => void run()}>
        {copied ? "Link copied ✓" : "Share"}
      </Button>
      {fallbackUrl !== undefined && (
        <Input
          readOnly
          value={fallbackUrl}
          aria-label="Share link"
          className="h-7 w-56 text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </>
  )
}

/** Tab strip with a hover pill that slides between tabs (hover as preview). */
function WorkspaceTabs({ projectId }: { projectId: string }) {
  const listRef = useRef<HTMLElement>(null)
  const [hover, setHover] = useState<{ x: number; w: number } | null>(null)
  const onEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const list = listRef.current
    if (list === null) return
    const item = e.currentTarget.getBoundingClientRect()
    setHover({ x: item.left - list.getBoundingClientRect().left, w: item.width })
  }
  return (
    <nav className="tabs" ref={listRef} onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <span
          className="tab-hover-pill"
          style={{ translate: `${hover.x}px 0`, width: hover.w }}
          aria-hidden="true"
        />
      )}
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          params={{ projectId }}
          activeProps={{ className: "active" }}
          onMouseEnter={onEnter}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

function ProjectWorkspace() {
  const { projectId } = Route.useParams()
  const workspaceLayout = useDefaultLayout({ id: "nerve-workspace-3", panelIds: ["ai", "source", "render"] })
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))
  const dirty = useIsDirty(projectId)

  return (
    <div className="workspace">
      <div className="workspace-header">
        <h2>
          {data.hir.harness.id}
          {dirty ? " •" : ""}
        </h2>
        <span className="meta">rev {data.hir.harness.revision}</span>
        <SearchBox hir={data.hir} projectId={projectId} />
        <ShareButton projectId={projectId} />
        <ExportButton projectId={projectId} />
        <WorkspaceTabs projectId={projectId} />
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
            <RenderErrorBoundary resetKey={projectId}>
              <Outlet />
            </RenderErrorBoundary>
          </div>
        </Panel>
      </Group>
      <DiagnosticsPanel diagnostics={data.hir.diagnostics} />
    </div>
  )
}
