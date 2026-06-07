import {
  createRootRouteWithContext,
  Link,
  Outlet,
  type ErrorComponentProps
} from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { Button } from "../ui/button.js"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootError
})

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="status error">
      <p>{error instanceof Error ? error.message : String(error)}</p>
      <div className="flex gap-3">
        <Button variant="outline" size="xs" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="outline" size="xs" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  )
}

function RootLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          GRAYHAVEN NERVE
        </Link>
        <span className="tagline">harnesses as code</span>
        <nav className="topnav">
          <Link to="/projects" activeProps={{ className: "active" }}>
            Projects
          </Link>
          <Link to="/docs" activeProps={{ className: "active" }}>
            Docs
          </Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
