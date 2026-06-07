import { describe, expect, it } from "vitest"
import { parseSortSearch, sortingToSearch } from "../src/components/table-search.js"

describe("sort search params", () => {
  it("parses every form the router can deliver desc in", () => {
    expect(parseSortSearch({ sortBy: "qty", desc: true })).toEqual({ sortBy: "qty", desc: true })
    expect(parseSortSearch({ sortBy: "qty", desc: 1 })).toEqual({ sortBy: "qty", desc: true })
    expect(parseSortSearch({ sortBy: "qty", desc: "1" })).toEqual({ sortBy: "qty", desc: true })
    expect(parseSortSearch({ sortBy: "qty", desc: "true" })).toEqual({ sortBy: "qty", desc: true })
    expect(parseSortSearch({ sortBy: "qty" })).toEqual({ sortBy: "qty" })
    expect(parseSortSearch({ sortBy: 7 })).toEqual({})
    expect(parseSortSearch({})).toEqual({})
  })

  it("round-trips through sortingToSearch", () => {
    expect(sortingToSearch([{ id: "mpn", desc: true }], [])).toEqual({ sortBy: "mpn", desc: true })
    expect(sortingToSearch([{ id: "mpn", desc: false }], [])).toEqual({ sortBy: "mpn" })
    expect(sortingToSearch([], [{ id: "mpn", desc: true }])).toEqual({})
    expect(sortingToSearch((old) => old, [{ id: "x", desc: false }])).toEqual({ sortBy: "x" })
  })
})
