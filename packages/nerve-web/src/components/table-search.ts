import type { SortingState } from "@tanstack/react-table"

/** Translate a Table sorting updater into a router search-param navigation.
 * Lives apart from DataTable so route validateSearch (eager) never pulls
 * @tanstack/table-core — only the type, which erases. */
export const sortingToSearch = (
  updater: SortingState | ((old: SortingState) => SortingState),
  current: SortingState
): { sortBy?: string; desc?: true } => {
  const next = typeof updater === "function" ? updater(current) : updater
  const first = next[0]
  return {
    ...(first !== undefined ? { sortBy: first.id } : {}),
    ...(first?.desc === true ? { desc: true as const } : {})
  }
}

/** Parse tolerant sort search params. */
export const parseSortSearch = (
  s: Record<string, unknown>
): { sortBy?: string; desc?: true } => ({
  ...(typeof s["sortBy"] === "string" ? { sortBy: s["sortBy"] } : {}),
  // Router JSON-parses search values: ?desc=1 arrives as number 1,
  // ?desc=true as boolean true. Accept the string forms too.
  ...(s["desc"] === true || s["desc"] === 1 || s["desc"] === "1" || s["desc"] === "true"
    ? { desc: true as const }
    : {})
})
