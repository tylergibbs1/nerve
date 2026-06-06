import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import type { HirLabel } from "@grayhaven/nerve"
import { DataTable } from "../components/DataTable.js"
import { useCompile } from "../lib/compile-client.js"

export const Route = createFileRoute("/projects/$projectId/labels")({
  component: LabelsView
})

const columns: ColumnDef<HirLabel, string | number>[] = [
  { header: "Label", accessorKey: "id" },
  { header: "Text", accessorKey: "text" },
  { header: "Qty", accessorFn: (l) => l.quantity ?? 1 },
  { header: "Target", accessorKey: "attachTo" },
  {
    header: "Placement",
    accessorFn: (l) =>
      l.offsetFrom !== undefined && l.distance !== undefined
        ? `${l.distance} from ${l.offsetFrom}`
        : (l.distance ?? "")
  }
]

function LabelsView() {
  const { projectId } = Route.useParams()
  const { data } = useCompile(projectId)
  if (data === undefined) return null
  return <DataTable data={data.hir.labels} columns={columns} />
}
