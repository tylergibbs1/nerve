import { createFileRoute, Link, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/docs")({
  component: DocsLayout
})

const NAV = [
  { to: "/docs", label: "Quickstart", exact: true },
  { to: "/docs/dsl", label: "DSL Reference" },
  { to: "/docs/rules", label: "Validation Rules" },
  { to: "/docs/cli", label: "CLI" },
  { to: "/docs/artifacts", label: "Artifacts" },
  { to: "/docs/ai", label: "AI Copilot" }
] as const

function DocsLayout() {
  return (
    <div className="docs">
      <nav className="docs-nav">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: "exact" in item && item.exact }}
            activeProps={{ className: "active" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <article className="docs-body">
        <Outlet />
      </article>
    </div>
  )
}
