import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useDebouncedValue } from "@tanstack/react-pacer"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { oneDark } from "@codemirror/theme-one-dark"
import {
  compileKeys,
  compileSource,
  countDiagnostics,
  setCompileResult
} from "../lib/compile-client.js"
import { getSource, isDirty, resetSource, setSource } from "../lib/sources.js"

export const Route = createFileRoute("/projects/$projectId/source")({
  component: SourceView
})

function SourceView() {
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()
  const [source, setLocalSource] = useState(() => getSource(projectId))
  const [autoCompile, setAutoCompile] = useState(true)
  const lastCompiled = useRef<string | undefined>(undefined)

  const compile = useMutation({
    mutationFn: (text: string) => compileSource(projectId, text),
    onSuccess: (result, compiledText) => {
      // Supersession guard: a newer edit exists — drop this stale result.
      if (compiledText !== getSource(projectId)) return
      lastCompiled.current = compiledText
      // Every other tab (diagram, board, tables, diagnostics) reads this key.
      setCompileResult(queryClient, projectId, result)
    }
  })

  // Compile-on-type: debounce the editor text, feed the existing mutation.
  const [debouncedSource] = useDebouncedValue(source, { wait: 600 })
  useEffect(() => {
    if (!autoCompile) return
    if (debouncedSource === lastCompiled.current) return
    compile.mutate(debouncedSource)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSource, autoCompile])

  // Close the stale window (tanstack-query qk-include-dependencies): if the
  // editor unmounts with uncompiled edits — tab switch inside the debounce
  // window, or auto turned off — invalidate so other tabs recompile the
  // current source (the queryFn always reads getSource).
  useEffect(() => {
    return () => {
      if (getSource(projectId) !== lastCompiled.current) {
        void queryClient.invalidateQueries({ queryKey: compileKeys.project(projectId) })
      }
    }
  }, [projectId, queryClient])

  const onToggleAuto = (enabled: boolean) => {
    setAutoCompile(enabled)
    if (!enabled && getSource(projectId) !== lastCompiled.current) {
      void queryClient.invalidateQueries({ queryKey: compileKeys.project(projectId) })
    }
  }

  const onChange = (text: string) => {
    setLocalSource(text)
    setSource(projectId, text)
  }

  // Keep the status span mounted; animate visibility (make-interfaces rule 4).
  const status = compile.isError
    ? { kind: "error" as const, text: String(compile.error.message) }
    : compile.isSuccess
      ? {
          kind: "ok" as const,
          text: (() => {
            const { errors, warnings } = countDiagnostics(compile.data.hir.diagnostics)
            return `Compiled — ${errors} error(s), ${warnings} warning(s)`
          })()
        }
      : undefined
  const lastStatus = useRef(status)
  if (status !== undefined) lastStatus.current = status
  const shown = status ?? lastStatus.current

  return (
    <div className="source-pane">
      <div className="source-toolbar">
        <button
          className="compile-button"
          disabled={compile.isPending}
          onClick={() => compile.mutate(source)}
        >
          {compile.isPending ? "Compiling…" : "Compile"}
        </button>
        <label className="auto-toggle">
          <input
            type="checkbox"
            checked={autoCompile}
            onChange={(e) => onToggleAuto(e.target.checked)}
          />
          auto
        </label>
        {isDirty(projectId) && (
          <button
            className="compile-button ghost"
            onClick={() => {
              const text = resetSource(projectId)
              setLocalSource(text)
              compile.mutate(text)
            }}
          >
            Reset to example
          </button>
        )}
        <span
          className={`toolbar-status ${shown?.kind === "error" ? "compile-error" : "compile-ok"} ${status !== undefined ? "visible" : ""}`}
        >
          {shown?.text ?? ""}
        </span>
      </div>
      <CodeMirror
        value={source}
        height="100%"
        extensions={[javascript({ typescript: true })]}
        theme={oneDark}
        onChange={onChange}
        style={{ flex: 1, minHeight: 0, overflow: "auto", fontSize: 13 }}
      />
    </div>
  )
}
