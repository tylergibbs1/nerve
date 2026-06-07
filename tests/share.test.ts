/**
 * Share-link codec: gzip → base64url fragment, decoded entirely client-side
 * (the fragment never reaches a server). Deterministic: same source, same
 * link — which is what makes a share link a bug report.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeShareHash, encodeShareHash } from "../packages/nerve-web/src/lib/share.js"

const MOTOR = readFileSync(
  join(import.meta.dirname, "..", "examples", "motor-controller", "src", "main.harness.ts"),
  "utf8"
)

describe("share-link codec", () => {
  it("round-trips a real harness source", () => {
    const hash = encodeShareHash(MOTOR)
    expect(decodeShareHash(hash)).toBe(MOTOR)
    expect(decodeShareHash(`#${hash}`)).toBe(MOTOR) // with the leading '#'
  })

  it("is deterministic and URL-safe", () => {
    const a = encodeShareHash(MOTOR)
    expect(encodeShareHash(MOTOR)).toBe(a)
    expect(a).toMatch(/^v1\.[A-Za-z0-9_-]+$/) // base64url, no padding
  })

  it("stays comfortably inside URL limits for a real harness", () => {
    // ~2KB gzipped for the PRD example; browsers handle fragments far
    // larger, but keep an eye on growth.
    expect(encodeShareHash(MOTOR).length).toBeLessThan(8000)
  })

  it("rejects malformed or foreign payloads", () => {
    expect(decodeShareHash("")).toBeUndefined()
    expect(decodeShareHash("v1.!!!not-base64!!!")).toBeUndefined()
    expect(decodeShareHash("v2.AAAA")).toBeUndefined() // unknown version
    expect(decodeShareHash("v1.AAAA")).toBeUndefined() // not gzip
  })
})
