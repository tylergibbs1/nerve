/**
 * Publish every public package with publishConfig field overrides ACTUALLY
 * applied. `publishConfig.exports` is a pnpm feature — bun and npm ignore
 * it, which shipped every release through v0.5.0 with exports pointing at
 * ./src/index.ts (absent from tarballs): inter-package imports and the CLI
 * bin were broken for all consumers.
 *
 * This script temp-rewrites each package.json (merging publishConfig file
 * mappings into the root), runs `bun publish`, and restores the original —
 * dev resolution (exports -> src) stays untouched.
 *
 *   bun scripts/publish-all.ts          # publish (interactive npm auth)
 *   bun scripts/publish-all.ts --pack   # dry: write tarballs to $PACK_DEST (default /tmp/packs)
 */
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// Dependency order: dependencies publish before dependents.
const PACKAGES = [
  "nerve",
  "nerve-rules",
  "nerve-eval",
  "nerve-importers",
  "nerve-compiler",
  "nerve-exporters",
  "nerve-wireviz",
  "nerve-connectors",
  "nerve-react",
  "nerve-cli"
]

// npm-recognized publishConfig keys that must NOT be merged into the root.
const NPM_KEYS = new Set(["access", "registry", "tag", "provenance"])

const packOnly = process.argv.includes("--pack")
const packDest = process.env["PACK_DEST"] ?? "/tmp/packs"
if (packOnly) {
  // Stale tarballs from a previous run must never satisfy a smoke test.
  rmSync(packDest, { recursive: true, force: true })
  mkdirSync(packDest, { recursive: true })
}
let failed = false

for (const name of PACKAGES) {
  const dir = join(import.meta.dirname, "..", "packages", name)
  const pkgPath = join(dir, "package.json")
  const backupPath = join(dir, "package.json.publish-backup")
  const original = readFileSync(pkgPath, "utf8")
  const pkg = JSON.parse(original) as Record<string, unknown>
  const publishConfig = (pkg["publishConfig"] ?? {}) as Record<string, unknown>

  // Idempotency: skip anything the registry already has at this exact
  // version, so re-running after a mid-list failure just publishes the
  // remainder — no more hand-editing the PACKAGES prefix. Only a positive
  // registry confirmation skips; a network error (or 404) falls through to
  // the publish attempt, which fails loudly on a real conflict anyway.
  if (!packOnly) {
    const npmName = pkg["name"] as string
    const version = pkg["version"] as string
    const view = spawnSync("bun", ["pm", "view", `${npmName}@${version}`, "version"], {
      encoding: "utf8"
    })
    if (view.status === 0 && view.stdout.trim() === version) {
      console.log(`↷ ${name}: ${npmName}@${version} already published — skipping`)
      continue
    }
  }

  if (publishConfig["exports"] === undefined) {
    console.error(`✗ ${name}: no publishConfig.exports — refusing to publish src-pointing exports`)
    failed = true
    continue
  }

  const transformed: Record<string, unknown> = { ...pkg }
  for (const [key, value] of Object.entries(publishConfig)) {
    if (!NPM_KEYS.has(key)) transformed[key] = value
  }
  delete transformed["publishConfig"]

  copyFileSync(pkgPath, backupPath)
  writeFileSync(pkgPath, JSON.stringify(transformed, null, 2) + "\n")
  let status: number | null
  try {
    // NB: no --tolerate-republish — in bun 1.3.x that flag 404s on a
    // version that doesn't already exist (it only no-ops re-publishing an
    // EXISTING version), which breaks every fresh release. The
    // abort-on-first-failure below is what actually keeps a partial
    // release from shipping phantom pins; a re-run after a partial failure
    // just skips the already-published prefix manually.
    const args = packOnly
      ? ["pm", "pack", "--destination", packDest]
      : ["publish", "--access", "public"]
    status = spawnSync("bun", args, { cwd: dir, stdio: "inherit" }).status
  } finally {
    renameSync(backupPath, pkgPath)
  }
  if (status !== 0) {
    console.error(`✗ ${name}: bun exited ${status}`)
    failed = true
    // PACKAGES is dependencies-first. In PUBLISH mode, never publish a
    // dependent past a failed dependency — that ships exactly the
    // phantom-internal-pin breakage this script exists to prevent. Stop
    // now; to resume, comment out the already-published prefix and re-run.
    // (--pack accumulates so a local dry run reports every failure at once.)
    if (!packOnly) break
  } else {
    console.log(`✓ ${name}`)
  }
}

process.exit(failed ? 1 : 0)
