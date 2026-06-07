import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { decodeShareHash } from "../lib/share.js"
import { setSource } from "../lib/sources.js"

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
    const source = decodeShareHash(window.location.hash)
    if (source === undefined || source.trim() === "") {
      setBad(true)
      return
    }
    setSource("shared", source)
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
