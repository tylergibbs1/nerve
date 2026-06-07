import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { compileQueryOptions } from "../lib/compile-client.js"
import { SchematicSheet } from "../components/SchematicSheet.js"

export const Route = createFileRoute("/projects/$projectId/board")({
  component: BoardView
})

function BoardView() {
  const { projectId } = Route.useParams()
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))
  return <SchematicSheet svg={data.boardSvg} hir={data.hir} kind="board" filename={`${projectId}-board.svg`} />
}
