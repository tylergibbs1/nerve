import type { SortingState } from "@tanstack/react-table"

/** Translate a Table sorting updater into a router search-param navigation.
 * Lives apart from DataTable so route validateSearch (eager) never pulls
 * @tanstack/table-core — only the type, which erases. */
export const sortingToSearch = (
  updater: SortingState | ((old: SortingState) => SortingState),
  current: SortingState
): { sortBy: string | undefined; desc: true | undefined } => {
  const next = typeof updater === "function" ? updater(current) : updater
  const first = next[0]
  // @tanstack/react-router 1.170.18: navigate({ search }) MERGES the object
  // over the current search — a key that is merely absent is retained, not
  // cleared. Omitting `desc` on the desc -> asc/none steps therefore left
  // ?desc=true in the URL and the sort stuck on descending forever. Every key
  // this function owns is emitted on every call; `undefined` is what actually
  // drops a param (stringifySearch skips it).
  return {
    sortBy: first?.id,
    desc: first?.desc === true ? (true as const) : undefined
  }
}

/** Parse tolerant sort search params.
 * The keys are optional AND explicitly `| undefined`: this return type is the
 * route's search schema, so it is also what navigate() accepts. Optional keeps
 * plain <Link to=".../bom"> legal; the `| undefined` is what lets
 * sortingToSearch pass an explicit undefined to CLEAR a param under
 * exactOptionalPropertyTypes. */
export const parseSortSearch = (
  s: Record<string, unknown>
): { sortBy?: string | undefined; desc?: true | undefined } => ({
  ...(typeof s["sortBy"] === "string" ? { sortBy: s["sortBy"] } : {}),
  // Router JSON-parses search values: ?desc=1 arrives as number 1,
  // ?desc=true as boolean true. Accept the string forms too.
  ...(s["desc"] === true || s["desc"] === 1 || s["desc"] === "1" || s["desc"] === "true"
    ? { desc: true as const }
    : {})
})
