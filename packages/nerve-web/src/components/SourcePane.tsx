import { useEffect, useEffectEvent, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useDebouncedValue } from "@tanstack/react-pacer"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { lintGutter, setDiagnostics } from "@codemirror/lint"
import { autocompletion } from "@codemirror/autocomplete"
import { dslCompletions } from "../lib/dsl-completions.js"
import { toEditorDiagnostics } from "../lib/editor-lint.js"
import { grayscaleTheme } from "../lib/cm-theme.js"
import { useMinimumLoading } from "../lib/useMinimumLoading.js"
import {
  compileKeys,
  compileSource,
  countDiagnostics,
  setCompileResult
} from "../lib/compile-client.js"
import { getSource, isDirty, resetSource, setSource, subscribeSource } from "../lib/sources.js"
import { Button } from "../ui/button.js"

/**
 * Persistent source editor (PRD §11.1 left pane). Auto-compiles on type;
 * successful compiles write through the query cache so the render pane on
 * the right updates live.
 */
export function SourcePane({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [source, setLocalSource] = useState(() => getSource(projectId))
  const [autoCompile, setAutoCompile] = useState(true)
  const lastCompiled = useRef<string | undefined>(undefined)
  const viewRef = useRef<EditorView | null>(null)

  // Push HK diagnostics into the lint gutter whenever a compile lands.
  const publishDiagnostics = (text: string, diags: ReadonlyArray<{ readonly code: string; readonly severity: string; readonly message: string; readonly target?: string | undefined }>) => {
    const view = viewRef.current
    if (view === null) return
    view.dispatch(setDiagnostics(view.state, toEditorDiagnostics(text, diags)))
  }

  // Re-seed when switching projects (the pane persists across them).
  useEffect(() => {
    setLocalSource(getSource(projectId))
    lastCompiled.current = undefined
  }, [projectId])

  // Reflect writes made elsewhere (the AI pane applying a verified patch).
  // AI edits arrive already compiled, so mark them as lastCompiled to keep
  // the auto-compile effect from re-running the same text.
  useEffect(
    () =>
      subscribeSource((changed, origin) => {
        if (changed !== projectId) return
        const text = getSource(projectId)
        setLocalSource((local) => {
          if (local === text) return local
          // Same-tab external writes (AI pane) arrive compile-verified;
          // remote-tab keystrokes do not — let auto-compile pick them up.
          if (origin === "local") lastCompiled.current = text
          return text
        })
      }),
    [projectId]
  )

  const compile = useMutation({
    mutationFn: (text: string) => compileSource(projectId, text),
    onSuccess: (result, compiledText) => {
      // Supersession guard: a newer edit exists — drop this stale result.
      if (compiledText !== getSource(projectId)) return
      lastCompiled.current = compiledText
      publishDiagnostics(compiledText, result.hir.diagnostics)
      setCompileResult(queryClient, projectId, result)
    }
  })

  // Compile-on-type: debounce the editor text, feed the existing mutation.
  // useEffectEvent reads the latest mutation without being a reactive dep —
  // the effect re-runs only on the values that should trigger a compile.
  const runCompile = useEffectEvent((text: string) => compile.mutate(text))
  const [debouncedSource] = useDebouncedValue(source, { wait: 600 })
  useEffect(() => {
    if (!autoCompile) return
    if (debouncedSource === lastCompiled.current) return
    if (debouncedSource !== getSource(projectId)) return // project just switched
    runCompile(debouncedSource)
  }, [debouncedSource, autoCompile, projectId])

  // Close the stale window (tanstack-query qk-include-dependencies): if the
  // pane unmounts or switches projects with uncompiled edits, invalidate so
  // the render pane recompiles the current source.
  useEffect(() => {
    return () => {
      if (getSource(projectId) !== lastCompiled.current) {
        void queryClient.invalidateQueries({ queryKey: compileKeys.project(projectId) })
      }
    }
  }, [projectId, queryClient])

  // Busy cue: 150ms delay before showing, 300ms minimum once shown —
  // fast compiles never flash the label.
  const showBusy = useMinimumLoading(compile.isPending)

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

  // Keep the status span mounted; animate visibility.
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
        <Button size="xs" disabled={compile.isPending} onClick={() => compile.mutate(source)}>
          {showBusy ? "Compiling…" : "Compile"}
        </Button>
        <label className="auto-toggle">
          <input
            type="checkbox"
            checked={autoCompile}
            onChange={(e) => onToggleAuto(e.target.checked)}
          />
          auto
        </label>
        {isDirty(projectId) && (
          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              const text = resetSource(projectId)
              setLocalSource(text)
              compile.mutate(text)
            }}
          >
            Reset
          </Button>
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
        extensions={[
          javascript({ typescript: true }),
          lintGutter(),
          autocompletion({ override: [dslCompletions] }),
          // axe: role=textbox needs an accessible name.
          EditorView.contentAttributes.of({ "aria-label": "Harness source editor" })
        ]}
        theme={grayscaleTheme}
        onCreateEditor={(view) => {
          viewRef.current = view
          // Automation hook: e2e tests and agent tooling drive real editor
          // transactions through this instead of poking minified internals.
          ;(window as unknown as { __nerveEditor?: EditorView }).__nerveEditor = view
        }}
        onChange={onChange}
        style={{ flex: 1, minHeight: 0, overflow: "auto", fontSize: 13 }}
      />
    </div>
  )
}
