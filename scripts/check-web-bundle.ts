// Post-build assertions for packages/nerve-web/dist. Run: bun scripts/check-web-bundle.ts
//
// 1. The landing page must not load the editor: fails if index.html
//    references a vendor-editor chunk (script/modulepreload) or if the
//    entry chunk statically imports one. The entry's __vite__mapDeps
//    array legitimately lists vendor-editor for lazy-route preloading,
//    so only real `import`/`from` statements count there.
// 2. Gzip budgets: every dist/assets/*.js chunk must gzip under 260 KB,
//    except vendor-editor and compile.worker which get 300 KB.
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { gzipSync } from "node:zlib"

const KB = 1024
const DEFAULT_BUDGET = 260 * KB
const LARGE_BUDGET = 300 * KB
const LARGE_CHUNKS = /^(vendor-editor|compile\.worker)-/

const distDir = resolve(import.meta.dirname, "../packages/nerve-web/dist")
const assetsDir = join(distDir, "assets")
const errors: string[] = []

if (!existsSync(distDir) || !existsSync(assetsDir)) {
  console.error(`FAIL: ${distDir} not found — build nerve-web first (cd packages/nerve-web && bun run build)`)
  process.exit(1)
}

// --- Check 1: vendor-editor must not load with the landing page ---

const indexHtml = readFileSync(join(distDir, "index.html"), "utf8")
const htmlRefs = [...new Set(indexHtml.match(/vendor-editor-[\w-]+\.js/g) ?? [])]
if (htmlRefs.length > 0) {
  errors.push(`index.html references ${htmlRefs.join(", ")} — the editor chunk is being preloaded on the landing page`)
}

const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
const entryFiles = jsFiles.filter((f) => /^index-[\w-]+\.js$/.test(f))
if (entryFiles.length !== 1) {
  errors.push(`expected exactly one entry chunk (assets/index-*.js), found ${entryFiles.length}: ${entryFiles.join(", ") || "none"}`)
}
for (const entry of entryFiles) {
  const text = readFileSync(join(assetsDir, entry), "utf8")
  const staticImports = [...new Set(
    [...text.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/(vendor-editor-[\w-]+\.js)["']/g)].map((m) => m[1])
  )]
  if (staticImports.length > 0) {
    errors.push(`entry chunk ${entry} statically imports ${staticImports.join(", ")} — the editor loads on the landing page`)
  }
}

// --- Check 2: per-chunk gzip budgets ---

const rows = jsFiles
  .map((file) => {
    const gzip = gzipSync(readFileSync(join(assetsDir, file))).length
    const budget = LARGE_CHUNKS.test(file) ? LARGE_BUDGET : DEFAULT_BUDGET
    return { file, gzip, budget }
  })
  .sort((a, b) => b.gzip - a.gzip)

for (const { file, gzip, budget } of rows) {
  if (gzip > budget) {
    errors.push(`${file} is ${(gzip / KB).toFixed(1)} KB gzipped — over its ${budget / KB} KB budget`)
  }
}

const nameWidth = Math.max(...rows.map((r) => r.file.length))
console.log(`${"chunk".padEnd(nameWidth)}  ${"gzip".padStart(9)}  ${"budget".padStart(8)}`)
for (const { file, gzip, budget } of rows) {
  const size = `${(gzip / KB).toFixed(1)} KB`
  const cap = `${budget / KB} KB`
  console.log(`${file.padEnd(nameWidth)}  ${size.padStart(9)}  ${cap.padStart(8)}${gzip > budget ? "  OVER" : ""}`)
}

if (errors.length > 0) {
  console.error(`\nFAIL: ${errors.length} bundle check${errors.length === 1 ? "" : "s"} failed`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log(`\nOK: ${rows.length} chunks within budget, landing page does not load vendor-editor`)
