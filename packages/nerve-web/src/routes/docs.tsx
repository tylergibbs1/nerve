import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router"

export const Route = createFileRoute("/docs")({
  component: DocsLayout
})

// Diátaxis grouping: learning, reference, and explanation read differently —
// the nav says which mode each page is in.
const GROUPS = [
  { label: "Learn", items: [{ to: "/docs", label: "Quickstart", exact: true }] },
  {
    label: "Reference",
    items: [
      { to: "/docs/dsl", label: "DSL" },
      { to: "/docs/rules", label: "Validation Rules" },
      { to: "/docs/cli", label: "CLI" },
      { to: "/docs/artifacts", label: "Artifacts" }
    ]
  },
  { label: "Concepts", items: [{ to: "/docs/ai", label: "AI Copilot" }] }
] as const

// Route path → agent-readable markdown mirror (generated at build).
const MD_SLUGS: Record<string, string> = {
  "/docs": "quickstart",
  "/docs/dsl": "dsl",
  "/docs/rules": "rules",
  "/docs/cli": "cli",
  "/docs/artifacts": "artifacts",
  "/docs/ai": "ai"
}

function DocsLayout() {
  const { pathname } = useLocation()
  const slug = MD_SLUGS[pathname.replace(/\/$/, "") || "/docs"]

  return (
    <div className="docs">
      <nav className="docs-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="docs-group">
            <span className="docs-group-label">{group.label}</span>
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: "exact" in item && item.exact }}
                activeProps={{ className: "active" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <a className="docs-llms" href="/llms.txt">
          llms.txt
        </a>
      </nav>
      <article className="docs-body">
        {slug !== undefined && (
          <a className="docs-md-link" href={`/docs/${slug}.md`}>
            View as Markdown
          </a>
        )}
        <Outlet />
      </article>
    </div>
  )
}
