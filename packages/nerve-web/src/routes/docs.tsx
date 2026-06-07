import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router"
import { Button } from "../ui/button.js"

export const Route = createFileRoute("/docs")({
  component: DocsLayout
})

type DocPath = "/docs" | "/docs/dsl" | "/docs/rules" | "/docs/cli" | "/docs/artifacts" | "/docs/ai"
interface DocItem {
  readonly to: DocPath
  readonly label: string
  readonly exact?: boolean
}
interface DocGroup {
  readonly label: string
  readonly items: ReadonlyArray<DocItem>
}

// Diátaxis grouping: learning, reference, and explanation read differently —
// the nav says which mode each page is in.
const GROUPS: ReadonlyArray<DocGroup> = [
  { label: "Learn", items: [{ to: "/docs", label: "Quickstart", exact: true }] },
  {
    label: "Reference",
    items: [
      { to: "/docs/dsl", label: "DSL" },
      { to: "/docs/rules", label: "Validation Rules" },
      { to: "/docs/cli", label: "CLI" },
      { to: "/docs/artifacts", label: "Artifacts" }
    ]
  },
  { label: "Concepts", items: [{ to: "/docs/ai", label: "AI Copilot" }] }
]

const FLAT = GROUPS.flatMap((g) => g.items)

// Route path → agent-readable markdown mirror (generated at build).
const MD_SLUGS: Record<string, string> = {
  "/docs": "quickstart",
  "/docs/dsl": "dsl",
  "/docs/rules": "rules",
  "/docs/cli": "cli",
  "/docs/artifacts": "artifacts",
  "/docs/ai": "ai"
}

/** Copy the page's agent-readable markdown mirror to the clipboard. */
function CopyMarkdown({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const copy = async () => {
    try {
      const res = await fetch(`/docs/${slug}.md`)
      await navigator.clipboard.writeText(await res.text())
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard denied or fetch failed — the View link still works
    }
  }

  return (
    <Button variant="ghost" size="xs" className="docs-action" onClick={() => void copy()}>
      {copied ? "Copied ✓" : "Copy Markdown"}
    </Button>
  )
}

/** Fumadocs-style AI page actions: hand this page to an assistant. */
function AiActions({ slug }: { slug: string }) {
  const mdUrl = `${window.location.origin}/docs/${slug}.md`
  const q = encodeURIComponent(`Read ${mdUrl} so I can ask questions about it.`)
  return (
    <>
      <Button variant="ghost" size="xs" className="docs-action" asChild>
        <a href={`https://claude.ai/new?q=${q}`} target="_blank" rel="noreferrer">
          Open in Claude
        </a>
      </Button>
      <span className="sep">/</span>
      <Button variant="ghost" size="xs" className="docs-action" asChild>
        <a href={`https://chatgpt.com/?hints=search&q=${q}`} target="_blank" rel="noreferrer">
          Open in ChatGPT
        </a>
      </Button>
    </>
  )
}

function DocsLayout() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, "") || "/docs"
  const slug = MD_SLUGS[path]
  const idx = FLAT.findIndex((i) => i.to === path)
  const prev = idx > 0 ? FLAT[idx - 1] : undefined
  const next = idx >= 0 && idx < FLAT.length - 1 ? FLAT[idx + 1] : undefined
  const bodyRef = useRef<HTMLElement>(null)

  // Per-code-block copy buttons (Fumadocs CodeBlock pattern, minimal voice).
  useEffect(() => {
    const body = bodyRef.current
    if (body === null) return
    const buttons: HTMLButtonElement[] = []
    for (const pre of body.querySelectorAll("pre")) {
      const btn = document.createElement("button")
      btn.className = "pre-copy"
      btn.textContent = "Copy"
      btn.addEventListener("click", () => {
        void navigator.clipboard.writeText(pre.textContent ?? "").then(() => {
          btn.textContent = "Copied ✓"
          setTimeout(() => (btn.textContent = "Copy"), 2000)
        })
      })
      pre.appendChild(btn)
      buttons.push(btn)
    }
    return () => buttons.forEach((b) => b.remove())
  }, [pathname])

  return (
    <div className="docs">
      <nav className="docs-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="docs-group">
            <span className="docs-group-label">{group.label}</span>
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact === true }}
                activeProps={{ className: "active" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <a className="docs-llms" href="/llms.txt">
          llms.txt
        </a>
      </nav>
      <article className="docs-body" ref={bodyRef}>
        <div className="docs-content">
        {slug !== undefined && (
          <div className="docs-md-actions">
            <CopyMarkdown slug={slug} />
            <span className="sep">/</span>
            <Button variant="ghost" size="xs" className="docs-action" asChild>
              <a href={`/docs/${slug}.md`}>View Markdown</a>
            </Button>
            <span className="sep">/</span>
            <AiActions slug={slug} />
          </div>
        )}
        <Outlet />
        <footer className="docs-pager">
          {prev !== undefined ? (
            <Link to={prev.to} className="pager-link prev">
              <span className="pager-dir">← Previous</span>
              {prev.label}
            </Link>
          ) : (
            <span />
          )}
          {next !== undefined ? (
            <Link to={next.to} className="pager-link next">
              <span className="pager-dir">Next →</span>
              {next.label}
            </Link>
          ) : (
            <span />
          )}
        </footer>
        </div>
      </article>
    </div>
  )
}
