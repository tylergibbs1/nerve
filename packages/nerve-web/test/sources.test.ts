// @vitest-environment jsdom
/**
 * Source store semantics: dirty tracking, reset, subscription origin flag
 * (the AI pane relies on "local"; remote-tab messages must recompile).
 */
import { afterEach, describe, expect, it } from "vitest"
import { getSource, isDirty, resetSource, setSource, subscribeSource } from "../src/lib/sources.js"

const PROJECT = "motor-controller"

afterEach(() => {
  resetSource(PROJECT)
})

describe("sources store", () => {
  it("setSource marks dirty; resetSource restores the bundled example", () => {
    const bundled = getSource(PROJECT)
    expect(isDirty(PROJECT)).toBe(false)
    setSource(PROJECT, bundled + "\n// edit")
    expect(isDirty(PROJECT)).toBe(true)
    expect(resetSource(PROJECT)).toBe(bundled)
    expect(isDirty(PROJECT)).toBe(false)
  })

  it("notifies subscribers synchronously with origin 'local'", () => {
    const seen: Array<[string, string]> = []
    const unsub = subscribeSource((id, origin) => seen.push([id, origin]))
    setSource(PROJECT, "// new source")
    expect(seen).toEqual([[PROJECT, "local"]])
    unsub()
    setSource(PROJECT, "// another")
    expect(seen).toHaveLength(1) // unsubscribed
  })
})
