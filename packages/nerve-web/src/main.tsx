import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"
import "./styles.css"

// Every query in this app is a deterministic Web Worker compile: failures
// don't heal on retry, and "offline" must not pause local compilation.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: "always", retry: false },
    mutations: { networkMode: "always", retry: false }
  }
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Compiles are deterministic; don't re-run the loader on every hover —
  // the query's own staleTime governs freshness via ensureQueryData.
  defaultPreloadStaleTime: 30_000,
  scrollRestoration: true
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
