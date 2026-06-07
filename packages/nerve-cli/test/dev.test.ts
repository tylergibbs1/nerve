import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { startDev } from "@grayhaven/nerve-cli"

const FIXTURE = join(
  import.meta.dirname,
  "../../../examples/motor-controller/src/main.harness.ts"
)

// Inside the repo tree so @grayhaven/nerve resolves through the workspace.
const dir = mkdtempSync(join(import.meta.dirname, "tmp-dev-"))
mkdirSync(join(dir, "src"), { recursive: true })
const harnessPath = join(dir, "src", "main.harness.ts")
writeFileSync(harnessPath, readFileSync(FIXTURE, "utf8"))

const sink = () => {
  const lines: Array<string> = []
  return { lines, out: (l: string) => lines.push(l), err: (l: string) => lines.push(l) }
}

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe("nerve dev server", () => {
  it("serves live views, reports state, and picks up edits (fresh module cache)", async () => {
    const io = sink()
    const dev = await startDev(harnessPath, { io, port: 0 })
    try {
      const state1 = (await (await fetch(`${dev.url}/state.json`)).json()) as {
        fingerprint: string
        errors: number
      }
      expect(state1.fingerprint).not.toBe("")
      expect(state1.errors).toBe(0)

      // Every view serves a complete self-contained document with the
      // reload poller injected.
      for (const path of ["/", "/board", "/faces", "/pinout"]) {
        const html = await (await fetch(`${dev.url}${path}`)).text()
        expect(html, path).toContain("<!doctype html>")
        expect(html, path).toContain("state.json")
      }
      expect((await fetch(`${dev.url}/nope`)).status).toBe(404)

      // Edit the harness (bump the revision) and rebuild: the jiti module
      // cache MUST not serve the stale design — the known watch-mode trap.
      writeFileSync(
        harnessPath,
        readFileSync(harnessPath, "utf8").replace('revision: "A"', 'revision: "B"')
      )
      await dev.rebuild()
      const state2 = (await (await fetch(`${dev.url}/state.json`)).json()) as {
        fingerprint: string
      }
      expect(state2.fingerprint).not.toBe(state1.fingerprint)
      const html = await (await fetch(`${dev.url}/`)).text()
      expect(html).toContain("rev B")
    } finally {
      await dev.close()
    }
  }, 30000)

  it("keeps the last good render when a compile fails", async () => {
    const io = sink()
    const dev = await startDev(harnessPath, { io, port: 0 })
    try {
      const good = (await (await fetch(`${dev.url}/state.json`)).json()) as {
        fingerprint: string
      }
      const source = readFileSync(harnessPath, "utf8")
      writeFileSync(harnessPath, source + "\nthis is not typescript at all (")
      await dev.rebuild()
      const state = (await (await fetch(`${dev.url}/state.json`)).json()) as {
        fingerprint: string
        compileError?: string
      }
      expect(state.compileError).toBeDefined()
      // Last good render stays up.
      expect(state.fingerprint).toBe(good.fingerprint)
      expect((await fetch(`${dev.url}/`)).status).toBe(200)
      // Recovery: restore the file, rebuild, error clears.
      writeFileSync(harnessPath, source)
      await dev.rebuild()
      const recovered = (await (await fetch(`${dev.url}/state.json`)).json()) as {
        compileError?: string
      }
      expect(recovered.compileError).toBeUndefined()
    } finally {
      await dev.close()
    }
  }, 30000)
})
