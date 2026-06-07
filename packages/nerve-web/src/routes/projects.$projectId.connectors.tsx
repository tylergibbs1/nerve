import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { compileQueryOptions } from "../lib/compile-client.js"
import { SchematicSheet } from "../components/SchematicSheet.js"

export const Route = createFileRoute("/projects/$projectId/connectors")({
  component: ConnectorsView
})

function ConnectorsView() {
  const { projectId } = Route.useParams()
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))
  return (
    <SchematicSheet
      svg={data.facesSvg}
      hir={data.hir}
      kind="faces"
      filename={`${projectId}-connector-faces.svg`}
    />
  )
}
