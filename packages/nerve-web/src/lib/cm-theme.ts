/**
 * Grayscale CodeMirror theme on the brand tokens. The reference renders
 * code as foreground-on-panel with no syntax hues ("color enters ONLY
 * through photography") — emphasis comes from weight and gray steps,
 * matching the landing page's .code sample: keywords bold white, strings
 * #BFBFBF (signal-dim), comments signature gray.
 */
import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"

const grayscaleHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.moduleKeyword, tags.operatorKeyword], color: "#ffffff", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string)], color: "#bfbfbf" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "hsl(0 0% 53%)" },
  { tag: [tags.number, tags.bool, tags.null], color: "#d9d9d9" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#ffffff" },
  { tag: [tags.typeName, tags.className], color: "#d9d9d9" },
  { tag: [tags.propertyName, tags.variableName, tags.definition(tags.variableName)], color: "#ffffff" },
  { tag: [tags.punctuation, tags.bracket, tags.operator], color: "hsl(0 0% 60%)" }
])

const grayscaleEditor = EditorView.theme(
  {
    "&": { backgroundColor: "#0a0a0a", color: "#ffffff" },
    ".cm-content": { caretColor: "#ffffff" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#ffffff" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground":
      { backgroundColor: "rgb(255 255 255 / 0.25)" },
    ".cm-activeLine": { backgroundColor: "#161616" },
    ".cm-gutters": {
      backgroundColor: "#0a0a0a",
      color: "hsl(0 0% 53%)",
      border: "none",
      borderRight: "1px solid hsl(0 0% 14%)"
    },
    ".cm-activeLineGutter": { backgroundColor: "#161616", color: "#ffffff" },
    ".cm-matchingBracket": { backgroundColor: "rgb(255 255 255 / 0.15)", outline: "none" },
    // basicSetup's selection-match highlight defaults to light green;
    // grayscale doctrine: a quiet white step.
    ".cm-selectionMatch": { backgroundColor: "rgb(255 255 255 / 0.12)" },
    ".cm-tooltip": {
      backgroundColor: "#161616",
      border: "1px solid hsl(0 0% 14%)",
      color: "#ffffff",
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: "11px"
    },
    ".cm-lintRange-error": { textDecoration: "underline wavy #f87171 1px" },
    ".cm-lintRange-warning": { textDecoration: "underline wavy #d4a017 1px" }
  },
  { dark: true }
)

export const grayscaleTheme = [grayscaleEditor, syntaxHighlighting(grayscaleHighlight)]
