/**
 * Main-thread client for the compile worker, exposed through a
 * `queryOptions()` factory (the t3code pattern) so the router loader, route
 * components, and the source editor all share one cache entry.
 *
 * Key decisions:
 * - The queryFn compiles whatever `getSource(projectId)` currently returns —
 *   edited and bundled state unify, so a background refetch can never revert
 *   an editor compile.
 * - Compiles are deterministic per source, so `staleTime: Infinity` is the
 *   honest model; the editor writes results through `setCompileResult`.
 * - The worker RPC honors Query's abort signal, and a worker crash rejects
 *   every pending request instead of stranding queries in `pending` forever.
 */
import {
  queryOptions,
  useQuery,
  type QueryClient
} from "@tanstack/react-query"
import { getSource, isDirty } from "./sources.js"
import type { CompileRequest, CompileResponse, CompileResult } from "./compile-types.js"

let worker: Worker | undefined
let nextId = 0
const pending = new Map<
  number,
  { resolve: (r: CompileResult) => void; reject: (e: Error) => void }
>()

const getWorker = (): Worker => {
  if (worker === undefined) {
    worker = new Worker(new URL("../worker/compile.worker.ts", import.meta.url), {
      type: "module"
    })
    worker.onmessage = (event: MessageEvent<CompileResponse>) => {
      const { id, result, error } = event.data
      const entry = pending.get(id)
      if (entry === undefined) return
      pending.delete(id)
      if (result !== undefined) entry.resolve(result)
      else entry.reject(new Error(error ?? "Compile failed"))
    }
    worker.onerror = () => {
      for (const [, entry] of pending) {
        entry.reject(new Error("Compile worker crashed; it will be respawned."))
      }
      pending.clear()
      worker?.terminate()
      worker = undefined
    }
  }
  return worker
}

/** Compile TypeScript source in the worker (§9.6). Abortable. */
export const compileSource = (
  projectId: string,
  source: string | undefined,
  signal?: AbortSignal
): Promise<CompileResult> =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    signal?.addEventListener("abort", () => {
      if (pending.delete(id)) {
        reject(
          signal.reason instanceof Error ? signal.reason : new Error("Compile aborted")
        )
      }
    })
    getWorker().postMessage({
      id,
      projectId,
      ...(source !== undefined ? { source } : {})
    } satisfies CompileRequest)
  })

export const compileKeys = {
  all: ["compile"] as const,
  project: (projectId: string) => ["compile", projectId] as const
}

export const compileQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: compileKeys.project(projectId),
    // Compiles the *current* state: edited source when dirty (isDirty is
    // re-evaluated at refetch time, so a refetch can never revert an editor
    // compile), undefined otherwise so the worker uses its bundled design
    // and skips loading the sucrase transform entirely.
    queryFn: ({ signal }) =>
      compileSource(projectId, isDirty(projectId) ? getSource(projectId) : undefined, signal),
    staleTime: Infinity
  })

/** Editor → cache writer: a successful editor compile becomes the truth everywhere. */
export const setCompileResult = (
  queryClient: QueryClient,
  projectId: string,
  result: CompileResult
): void => {
  queryClient.setQueryData(compileQueryOptions(projectId).queryKey, result)
}

export const useCompile = (projectId: string) =>
  useQuery(compileQueryOptions(projectId))

export interface DiagnosticCounts {
  readonly errors: number
  readonly warnings: number
  readonly total: number
}

/** Single pass, no intermediate arrays (vercel-react js-combine-iterations). */
export const countDiagnostics = (
  diagnostics: ReadonlyArray<{ readonly severity: string }>
): DiagnosticCounts => {
  let errors = 0
  let warnings = 0
  for (const d of diagnostics) {
    if (d.severity === "error") errors++
    else if (d.severity === "warning") warnings++
  }
  return { errors, warnings, total: diagnostics.length }
}

// Module-scope selector: the stable reference lets Query memoize the
// select result instead of recomputing on every render.
const selectCounts = (r: CompileResult): DiagnosticCounts =>
  countDiagnostics(r.hir.diagnostics)

/** Selector-based subscription for components that need only the counts. */
export const useDiagnosticCounts = (projectId: string) =>
  useQuery({ ...compileQueryOptions(projectId), select: selectCounts })
