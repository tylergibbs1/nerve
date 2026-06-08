/**
 * Share-link codec: gzip → base64url fragment, decoded entirely client-side
 * (the fragment never reaches a server). Deterministic: same source, same
 * link — which is what makes a share link a bug report.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  decodeShareFiles,
  decodeShareHash,
  encodeShareFiles,
  encodeShareHash
} from "../packages/nerve-web/src/lib/share.js"

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

  it("encoding is byte-golden — an fflate bump that changes the bytes fails here", () => {
    // The gzip output (and thus the share URL) must be stable across
    // fflate versions, or old links would stop round-tripping. Snapshot
    // the encoded fragment; refresh intentionally with `vitest -u`.
    expect(encodeShareHash(MOTOR)).toMatchSnapshot()
  })

  it("stays comfortably inside URL limits for a real harness", () => {
    // ~2KB gzipped for the PRD example; browsers handle fragments far
    // larger, but keep an eye on growth.
    expect(encodeShareHash(MOTOR).length).toBeLessThan(8000)
  })

  it("rejects malformed or foreign payloads", () => {
    expect(decodeShareHash("")).toBeUndefined()
    expect(decodeShareHash("v1.!!!not-base64!!!")).toBeUndefined()
    expect(decodeShareHash("v2.AAAA")).toBeUndefined() // not v1
    expect(decodeShareHash("v1.AAAA")).toBeUndefined() // not gzip
  })

  it("v2 round-trips a multi-file project (no file dropped)", () => {
    const files = {
      "/main.harness.ts": MOTOR,
      "/variants/long.ts": `import base from "../main.harness.js"\nexport default base`
    }
    const hash = encodeShareFiles(files)
    expect(hash).toMatch(/^v2\./)
    expect(decodeShareFiles(`#${hash}`)).toEqual(files)
  })

  it("decodeShareFiles maps a legacy v1 link onto the entry path", () => {
    const v1 = encodeShareHash(MOTOR)
    expect(decodeShareFiles(v1)).toEqual({ "/main.harness.ts": MOTOR })
  })

  it("decodeShareFiles rejects malformed v2 (non-object, bad gzip)", () => {
    expect(decodeShareFiles("v2.!!!")).toBeUndefined()
    expect(decodeShareFiles("v3.AAAA")).toBeUndefined()
  })
})
