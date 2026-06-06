import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout
})

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
