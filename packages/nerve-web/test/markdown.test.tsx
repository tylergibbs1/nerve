// @vitest-environment jsdom
/**
 * Docs markdown rendering: ts code blocks share the editor's grammar
 * (lezer token spans), other languages stay plain, and raw HTML in code
 * is escaped (the docs are first-party, but escaping is still load-bearing
 * for code SAMPLES containing markup).
 */
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { Markdown } from "../src/components/Markdown.js"

describe("Markdown code blocks", () => {
  it("highlights ts blocks with lezer token classes", () => {
    const { container } = render(
      <Markdown src={'```ts\nconst x = wire("W1", a, b)\n```'} />
    )
    expect(container.querySelectorAll("pre code span[class*='tok-']").length).toBeGreaterThan(2)
    expect(container.querySelector(".tok-keyword")?.textContent).toBe("const")
    expect(container.querySelector(".tok-string")?.textContent).toBe('"W1"')
  })

  it("leaves unknown languages plain and escapes markup", () => {
    const { container } = render(<Markdown src={"```bash\nnerve export <file>\n```"} />)
    const code = container.querySelector("pre code")!
    expect(code.querySelector("span")).toBeNull()
    expect(code.textContent).toContain("nerve export <file>")
    expect(container.innerHTML).not.toContain("<file>") // escaped, not parsed
  })
})
