import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { oneDark } from "@codemirror/theme-one-dark"
import { compileSource } from "../lib/compile-client.js"
import { getSource, setSource } from "../lib/sources.js"

export const Route = createFileRoute("/projects/$projectId/source")({
  component: SourceView
})

function SourceView() {
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()
  const [source, setLocalSource] = useState(() => getSource(projectId))

  const compile = useMutation({
    mutationFn: (text: string) => compileSource(projectId, text),
    onSuccess: (result) => {
      // Every other tab (diagram, board, tables, diagnostics) reads this key.
      queryClient.setQueryData(["compile", projectId], result)
    }
  })

  const onChange = (text: string) => {
    setLocalSource(text)
    setSource(projectId, text)
  }

  return (
    <div className="source-pane">
      <div className="source-toolbar">
        <button
          className="compile-button"
          disabled={compile.isPending}
          onClick={() => compile.mutate(source)}
        >
          {compile.isPending ? "Compiling…" : "Compile (updates all tabs)"}
        </button>
        {compile.isError && (
          <span className="compile-error">{String(compile.error.message)}</span>
        )}
        {compile.isSuccess && !compile.isError && (
          <span className="compile-ok">
            Compiled — {compile.data.hir.diagnostics.filter((d) => d.severity === "error").length}{" "}
            error(s),{" "}
            {compile.data.hir.diagnostics.filter((d) => d.severity === "warning").length} warning(s)
          </span>
        )}
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
