import { marked } from "marked"
import { highlightTs } from "../lib/highlight-code.js"

const renderer = new marked.Renderer()
renderer.code = ({ text, lang }) => {
  // ts/js blocks share the editor's grammar; other languages stay plain.
  const body = lang === "ts" || lang === "typescript" || lang === "js" ? highlightTs(text) : undefined
  return `<pre><code>${body ?? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
}

/** Render trusted, first-party markdown (the docs source files). */
export function Markdown({ src }: { src: string }) {
  return <div dangerouslySetInnerHTML={{ __html: marked.parse(src, { async: false, renderer }) }} />
}
