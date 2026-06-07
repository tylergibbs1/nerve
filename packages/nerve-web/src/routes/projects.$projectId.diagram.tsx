import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { compileQueryOptions } from "../lib/compile-client.js"
import { SchematicSheet } from "../components/SchematicSheet.js"

export const Route = createFileRoute("/projects/$projectId/diagram")({
  component: DiagramView
})

function DiagramView() {
  const { projectId } = Route.useParams()
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))
  return <SchematicSheet svg={data.svg} filename={`${projectId}-schematic.svg`} />
}
