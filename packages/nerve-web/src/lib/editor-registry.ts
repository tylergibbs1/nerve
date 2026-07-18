/**
 * The one place the live CodeMirror view is shared: SourcePane registers it,
 * the Inspector and diagnostics jump-to-source consume it. The window
 * global remains only as a thin automation shim for e2e (see SourcePane).
 */
import type { EditorView } from "@codemirror/view"

let view: EditorView | null = null

export const registerEditor = (v: EditorView | null): void => {
  view = v
}

export const getEditor = (): EditorView | null => view

/** Select the first quoted occurrence of an id in the source and focus. */
export const jumpToSource = (id: string): void => {
  if (view === null) return
  const idx = view.state.doc.toString().indexOf(`"${id}"`)
  if (idx === -1) return
  view.dispatch({
    selection: { anchor: idx + 1, head: idx + 1 + id.length },
    scrollIntoView: true
  })
  view.focus()
}
