import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { endpointLabel, type HirWire } from "@grayhaven/nerve"
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
  { header: "From", accessorFn: (w) => endpointLabel(w.from) },
  { header: "To", accessorFn: (w) => endpointLabel(w.to) },
  { header: "Twist", accessorFn: (w) => w.twistGroup ?? "" },
  { header: "Cable", accessorFn: (w) => w.cable ?? "" }
]

function CutListView() {
  const { projectId } = Route.useParams()
  const { data } = useCompile(projectId)
  if (data === undefined) return null
  return <DataTable data={data.hir.wires} columns={columns} />
}
