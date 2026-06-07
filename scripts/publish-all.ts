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
 *   bun scripts/publish-all.ts --pack   # dry: write tarballs to /tmp/packs
 */
import { spawnSync } from "node:child_process"
import { copyFileSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// Dependency order: dependencies publish before dependents.
const PACKAGES = [
  "nerve",
  "nerve-rules",
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
let failed = false

for (const name of PACKAGES) {
  const dir = join(import.meta.dirname, "..", "packages", name)
  const pkgPath = join(dir, "package.json")
  const backupPath = join(dir, "package.json.publish-backup")
  const original = readFileSync(pkgPath, "utf8")
  const pkg = JSON.parse(original) as Record<string, unknown>
  const publishConfig = (pkg["publishConfig"] ?? {}) as Record<string, unknown>

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
  try {
    const args = packOnly
      ? ["pm", "pack", "--destination", "/tmp/packs"]
      : ["publish", "--access", "public"]
    const r = spawnSync("bun", args, { cwd: dir, stdio: "inherit" })
    if (r.status !== 0) {
      console.error(`✗ ${name}: bun exited ${r.status}`)
      failed = true
    } else {
      console.log(`✓ ${name}`)
    }
  } finally {
    renameSync(backupPath, pkgPath)
  }
}

process.exit(failed ? 1 : 0)
