import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { endpointLabel, type HirWire } from "@grayhaven/nerve"
import { DataTable, parseSortSearch, sortingToSearch } from "../components/DataTable.js"
import { compileQueryOptions } from "../lib/compile-client.js"

export const Route = createFileRoute("/projects/$projectId/cut-list")({
  validateSearch: parseSortSearch,
  component: CutListView
})

const columns: ColumnDef<HirWire, string | number>[] = [
  { id: "id", header: "Wire", accessorKey: "id" },
  { id: "signal", header: "Signal", accessorFn: (w) => w.signal ?? "" },
  { id: "gauge", header: "Gauge", accessorFn: (w) => w.gauge ?? "" },
  { id: "color", header: "Color", accessorFn: (w) => w.color ?? "" },
  {
    id: "length",
    header: "Length",
    // Numeric accessor keeps sort semantics; presentation lives in `cell`.
    accessorFn: (w) => w.length ?? 0,
    cell: (ctx) => ctx.row.original.length ?? "—"
  },
  { id: "from", header: "From", accessorFn: (w) => endpointLabel(w.from) },
  { id: "to", header: "To", accessorFn: (w) => endpointLabel(w.to) },
  { id: "twist", header: "Twist", accessorFn: (w) => w.twistGroup ?? "" },
  { id: "cable", header: "Cable", accessorFn: (w) => w.cable ?? "" }
]

function CutListView() {
  const { projectId } = Route.useParams()
  const { sortBy, desc } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))

  const sorting: SortingState = sortBy !== undefined ? [{ id: sortBy, desc: desc === true }] : []
  return (
    <DataTable
      data={data.hir.wires}
      columns={columns}
      sorting={sorting}
      onSortingChange={(updater) =>
        navigate({ search: sortingToSearch(updater, sorting), replace: true })
      }
    />
  )
}
