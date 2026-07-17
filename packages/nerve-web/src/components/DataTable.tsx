import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState
} from "@tanstack/react-table"

/** Per-column type treatment (reference admin tables): IDs/codes get mono,
 * numerics get sans + tabular-nums + muted, prose stays sans foreground. */
export type ColumnKind = "code" | "num" | "text"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    kind?: ColumnKind
  }
}

const cellClass = (kind: ColumnKind | undefined): string =>
  kind === "code" ? "cell-code" : kind === "num" ? "cell-num" : "cell-text"

export function DataTable<T>({
  data,
  columns,
  sorting,
  onSortingChange
}: {
  data: ReadonlyArray<T>
  columns: ColumnDef<T, string | number>[]
  /** Controlled sorting state — typically backed by the route's search params. */
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
}) {
  const sortable = sorting !== undefined && onSortingChange !== undefined
  const table = useReactTable({
    data: data as T[],
    columns,
    ...(sortable
      ? {
          state: { sorting },
          onSortingChange,
          getSortedRowModel: getSortedRowModel()
        }
      : {}),
    getCoreRowModel: getCoreRowModel()
  })

  if (table.getRowModel().rows.length === 0) {
    return <div className="table-empty">No rows — compile a harness that produces this artifact.</div>
  }

  return (
    <table className="data">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => {
              const canSort = sortable && header.column.getCanSort()
              const dir = header.column.getIsSorted()
              return (
                <th key={header.id} className={canSort ? "sortable" : undefined}>
                  {canSort ? (
                    <button
                      type="button"
                      className="th-sort"
                      onClick={header.column.getToggleSortingHandler()}
                      aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="sort-icons" aria-hidden="true">
                        <span className={`sort-icon${dir === "asc" ? " on" : ""}`}>▲</span>
                        <span className={`sort-icon abs${dir === "desc" ? " on" : ""}`}>▼</span>
                      </span>
                    </button>
                  ) : header.isPlaceholder ? null : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              )
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className={cellClass(cell.column.columnDef.meta?.kind)}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

