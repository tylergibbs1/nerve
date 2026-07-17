import { createFileRoute, Link } from "@tanstack/react-router"
import { PROJECTS } from "../lib/projects.js"

export const Route = createFileRoute("/projects/")({
  component: ProjectList
})

function ProjectList() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Projects</h1>
      </div>
      <Link
        className="project-card project-card-new"
        to="/projects/$projectId/diagram"
        params={{ projectId: "scratch" }}
      >
        <h3>Open a scratch harness</h3>
        <p>
          A blank canvas that compiles in your browser as you type. No sign-up. Use Share to keep
          it (the link is your save).
        </p>
      </Link>
      {PROJECTS.map((p) => (
        <Link
          key={p.id}
          className="project-card"
          to="/projects/$projectId/diagram"
          params={{ projectId: p.id }}
        >
          <h3>{p.name}</h3>
          <p>{p.description}</p>
        </Link>
      ))}
    </div>
  )
}
