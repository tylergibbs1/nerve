import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import type { HirBomItem } from "@grayhaven/nerve"
import { DataTable } from "../components/DataTable.js"
import { parseSortSearch, sortingToSearch } from "../components/table-search.js"
import { compileQueryOptions } from "../lib/compile-client.js"

export const Route = createFileRoute("/projects/$projectId/bom")({
  // Sorting lives in the URL: a BOM sorted by qty is a shareable link.
  validateSearch: parseSortSearch,
  component: BomView
})

const columns: ColumnDef<HirBomItem, string | number>[] = [
  { id: "idx", meta: { kind: "num" }, header: "#", cell: (ctx) => ctx.row.index + 1, enableSorting: false },
  { id: "qty", meta: { kind: "num" }, header: "Qty", accessorKey: "quantity" },
  { id: "uom", meta: { kind: "text" }, header: "UoM", accessorKey: "unitOfMeasure" },
  { id: "manufacturer", meta: { kind: "text" }, header: "Manufacturer", accessorFn: (r) => r.manufacturer ?? "" },
  { id: "mpn", meta: { kind: "code" }, header: "MPN", accessorKey: "mpn" },
  { id: "description", meta: { kind: "text" }, header: "Description", accessorFn: (r) => r.description ?? "" },
  { id: "category", meta: { kind: "text" }, header: "Category", accessorFn: (r) => r.category ?? "" },
  {
    id: "usedBy",
    meta: { kind: "code" },
    header: "Used by",
    accessorFn: (r) => r.usedBy.join(", "),
    enableSorting: false
  }
]

function BomView() {
  const { projectId } = Route.useParams()
  const { sortBy, desc } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))

  const sorting: SortingState = sortBy !== undefined ? [{ id: sortBy, desc: desc === true }] : []
  return (
    <DataTable
      data={data.hir.bom}
      columns={columns}
      sorting={sorting}
      onSortingChange={(updater) =>
        navigate({ search: sortingToSearch(updater, sorting), replace: true })
      }
    />
  )
}
