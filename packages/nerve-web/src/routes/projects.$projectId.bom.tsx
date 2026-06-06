import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import type { HirBomItem } from "@grayhaven/nerve"
import { DataTable } from "../components/DataTable.js"
import { useCompile } from "../lib/compile-client.js"

export const Route = createFileRoute("/projects/$projectId/bom")({
  component: BomView
})

const columns: ColumnDef<HirBomItem, string | number>[] = [
  { header: "#", cell: (ctx) => ctx.row.index + 1 },
  { header: "Qty", accessorKey: "quantity" },
  { header: "UoM", accessorKey: "unitOfMeasure" },
  { header: "Manufacturer", accessorFn: (r) => r.manufacturer ?? "" },
  { header: "MPN", accessorKey: "mpn" },
  { header: "Description", accessorFn: (r) => r.description ?? "" },
  { header: "Category", accessorFn: (r) => r.category ?? "" },
  { header: "Used by", accessorFn: (r) => r.usedBy.join(", ") }
]

function BomView() {
  const { projectId } = Route.useParams()
  const { data } = useCompile(projectId)
  if (data === undefined) return null
  return <DataTable data={data.hir.bom} columns={columns} />
}
