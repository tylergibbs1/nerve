/**
 * Main-thread client for the compile worker, exposed as a TanStack Query
 * hook. One worker instance, request/response correlation by id.
 */
import { useQuery } from "@tanstack/react-query"
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
  }
  return worker
}

export const compileProject = (projectId: string): Promise<CompileResult> =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, projectId } satisfies CompileRequest)
  })

export const compileQueryOptions = (projectId: string) => ({
  queryKey: ["compile", projectId] as const,
  queryFn: () => compileProject(projectId)
})

export const useCompile = (projectId: string) =>
  useQuery(compileQueryOptions(projectId))
