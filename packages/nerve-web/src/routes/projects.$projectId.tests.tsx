import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import type { HarnessTest } from "@grayhaven/nerve-exporters"
import { DataTable } from "../components/DataTable.js"
import { useSuspenseQuery } from "@tanstack/react-query"
import { compileQueryOptions } from "../lib/compile-client.js"

export const Route = createFileRoute("/projects/$projectId/tests")({
  component: TestsView
})

const columns: ColumnDef<HarnessTest, string | number>[] = [
  { header: "Test", accessorKey: "id" },
  { header: "Type", accessorKey: "type" },
  { header: "From", accessorFn: (t) => `${t.from.connector}.${t.from.pin}` },
  { header: "To", accessorFn: (t) => `${t.to.connector}.${t.to.pin}` },
  { header: "Expected", accessorKey: "expected" },
  { header: "Net", accessorFn: (t) => t.net ?? "" },
  { header: "Wire", accessorFn: (t) => t.wire ?? "" }
]

function TestsView() {
  const { projectId } = Route.useParams()
  const { data } = useSuspenseQuery(compileQueryOptions(projectId))
  return <DataTable data={data.testPlan.tests} columns={columns} />
}
