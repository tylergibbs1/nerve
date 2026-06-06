import { createFileRoute, Link } from "@tanstack/react-router"
import { PROJECTS } from "../lib/projects.js"

export const Route = createFileRoute("/projects/")({
  component: ProjectList
})

function ProjectList() {
  return (
    <div className="page">
      <h1>Projects</h1>
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
