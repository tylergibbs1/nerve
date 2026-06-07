/**
 * Docs code highlighting from the SAME grammar that powers the editor
 * (@lezer/javascript) — docs and SourcePane can never disagree on
 * tokenization, and the grayscale doctrine carries over via CSS classes.
 * (Shiki was evaluated and rejected: a second grammar + theme system for
 * an output we can derive from what's already shipped.)
 */
import { parser } from "@lezer/javascript"
import { classHighlighter, highlightTree } from "@lezer/highlight"

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export const highlightTs = (code: string): string => {
  const tree = parser.configure({ dialect: "ts" }).parse(code)
  let out = ""
  let last = 0
  highlightTree(tree, classHighlighter, (from, to, classes) => {
    if (from > last) out += escapeHtml(code.slice(last, from))
    out += `<span class="${classes}">${escapeHtml(code.slice(from, to))}</span>`
    last = to
  })
  out += escapeHtml(code.slice(last))
  return out
}
