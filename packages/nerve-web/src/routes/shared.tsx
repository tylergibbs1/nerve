import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
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
    <div className="status">
      {bad ? (
        <>
          This share link is malformed or empty. <Link to="/projects">Back to projects</Link>
        </>
      ) : (
        "Opening shared harness…"
      )}
    </div>
  )
}
