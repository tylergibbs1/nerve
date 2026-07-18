import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Button } from "../ui/button.js"
import { decodeShareFiles } from "../lib/share.js"
import { registerProjectFiles } from "../lib/sources.js"

export const Route = createFileRoute("/shared")({
  component: SharedLanding
})

/**
 * Share-link landing (zero backend): decode the gzip fragment into the
 * ephemeral "shared" project and continue into the normal workspace —
 * the existing worker path compiles it like any other edit. The fragment
 * never leaves the browser.
 */
function SharedLanding() {
  const navigate = useNavigate()
  const [bad, setBad] = useState(false)

  useEffect(() => {
    const files = decodeShareFiles(window.location.hash)
    if (files === undefined || Object.values(files).every((s) => s.trim() === "")) {
      setBad(true)
      return
    }
    registerProjectFiles("shared", files)
    void navigate({
      to: "/projects/$projectId/diagram",
      params: { projectId: "shared" },
      replace: true
    })
  }, [navigate])

  return (
    bad ? (
      <div className="status error">
        <span className="status-title">This share link didn&rsquo;t open</span>
        <p className="status-detail">
          A share link carries the whole harness in the part of the URL after the #, so it breaks
          if it was truncated in transit. Ask for the full link, or start from a harness here.
        </p>
        <span className="status-actions">
          <Button variant="secondary" size="xs" asChild>
            <Link to="/projects">All harnesses</Link>
          </Button>
        </span>
      </div>
    ) : (
      <div className="status">Opening shared harness…</div>
    )
  )
}
