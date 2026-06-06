import {
  createRootRouteWithContext,
  Link,
  Outlet,
  type ErrorComponentProps
} from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"

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
      <p style={{ display: "flex", gap: 12 }}>
        <button className="compile-button" onClick={() => reset()}>
          Try again
        </button>
        <button className="compile-button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </p>
    </div>
  )
}

function RootLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/projects" className="brand">
          GRAYHAVEN NERVE
        </Link>
        <span className="tagline">harnesses as code</span>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
