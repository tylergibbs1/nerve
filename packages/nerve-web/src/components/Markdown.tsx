import { marked } from "marked"

/** Render trusted, first-party markdown (the docs source files). */
export function Markdown({ src }: { src: string }) {
  return <div dangerouslySetInnerHTML={{ __html: marked.parse(src, { async: false }) }} />
}
