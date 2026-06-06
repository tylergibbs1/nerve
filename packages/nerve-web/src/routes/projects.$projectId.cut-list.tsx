import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import type { HirWire } from "@grayhaven/nerve"
import { DataTable } from "../components/DataTable.js"
import { useCompile } from "../lib/compile-client.js"

export const Route = createFileRoute("/projects/$projectId/cut-list")({
  component: CutListView
})

const columns: ColumnDef<HirWire, string | number>[] = [
  { header: "Wire", accessorKey: "id" },
  { header: "Signal", accessorFn: (w) => w.signal ?? "" },
  { header: "Gauge", accessorFn: (w) => w.gauge ?? "" },
  { header: "Color", accessorFn: (w) => w.color ?? "" },
  { header: "Length", accessorFn: (w) => w.length ?? "—" },
  { header: "From", accessorFn: (w) => `${w.from.connector}.${w.from.pin}` },
  { header: "To", accessorFn: (w) => `${w.to.connector}.${w.to.pin}` },
  { header: "Twist", accessorFn: (w) => w.twistGroup ?? "" }
]

function CutListView() {
  const { projectId } = Route.useParams()
  const { data } = useCompile(projectId)
  if (data === undefined) return null
  return <DataTable data={data.hir.wires} columns={columns} />
}
