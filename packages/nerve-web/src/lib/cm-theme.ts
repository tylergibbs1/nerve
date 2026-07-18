/**
 * Grayscale CodeMirror theme on the tokenbase tokens: code renders as
 * foreground-on-card with no syntax hues — emphasis comes from weight and
 * gray steps. Surfaces mirror the app's luminance ladder (card -> muted),
 * and the two lint hues are the shared warning/destructive tokens.
 */
import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"

const grayscaleHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.moduleKeyword, tags.operatorKeyword], color: "#ededed", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string)], color: "#bfbfbf" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "#8f8f8f" },
  { tag: [tags.number, tags.bool, tags.null], color: "#d9d9d9" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#ededed" },
  { tag: [tags.typeName, tags.className], color: "#d9d9d9" },
  { tag: [tags.propertyName, tags.variableName, tags.definition(tags.variableName)], color: "#ededed" },
  { tag: [tags.punctuation, tags.bracket, tags.operator], color: "#9a9a9a" }
])

const grayscaleEditor = EditorView.theme(
  {
    "&": { backgroundColor: "#191919", color: "#ededed" },
    ".cm-content": { caretColor: "#ededed" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#ededed" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground":
      { backgroundColor: "rgb(255 255 255 / 0.25)" },
    ".cm-activeLine": { backgroundColor: "#242424" },
    ".cm-gutters": {
      backgroundColor: "#191919",
      color: "#8f8f8f",
      border: "none",
      borderRight: "1px solid #2a2a2a"
    },
    ".cm-activeLineGutter": { backgroundColor: "#242424", color: "#ededed" },
    ".cm-matchingBracket": { backgroundColor: "rgb(255 255 255 / 0.15)", outline: "none" },
    // basicSetup's selection-match highlight defaults to light green;
    // grayscale doctrine: a quiet white step.
    ".cm-selectionMatch": { backgroundColor: "rgb(255 255 255 / 0.12)" },
    ".cm-tooltip": {
      backgroundColor: "#1f1f1f",
      border: "1px solid #2a2a2a",
      borderRadius: "8px",
      color: "#ededed",
      fontFamily: '"Geist Mono Variable", monospace',
      fontSize: "11px"
    },
    ".cm-lintRange-error": { textDecoration: "underline wavy #f32e40 1px" },
    ".cm-lintRange-warning": { textDecoration: "underline wavy #ed9a00 1px" }
  },
  { dark: true }
)

export const grayscaleTheme = [grayscaleEditor, syntaxHighlighting(grayscaleHighlight)]
