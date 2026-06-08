/**
 * Agent-readable docs (AX pass): generates at build time so the variants
 * can never go stale relative to the app.
 *   public/docs/<page>.md   — markdown mirror of each docs page
 *   public/llms.txt         — index: H1 + blockquote + H2 link sections
 *   public/llms-full.txt    — the entire docs embedded, no fetches needed
 * The rules page is generated from the live builtinRules array.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { builtinRules } from "../../nerve-rules/src/index.ts"
import { allParts, partSpecs } from "../../nerve-connectors/src/index.ts"
import { hirJsonSchema, HIR_SCHEMA_VERSION } from "../../nerve/src/index.ts"
import { RULE_SUMMARIES } from "../src/docs/rule-summaries.ts"
import { dslReferenceMd, extractDslMeta } from "./extract-dsl.ts"

const ROOT = join(import.meta.dir, "..")
const OUT = join(ROOT, "public")
import { SITE } from "./site.js"

const PAGES = [
  { slug: "quickstart", title: "Quickstart" },
  { slug: "dsl", title: "DSL Reference" },
  { slug: "sdk", title: "TypeScript SDK" },
  { slug: "cli", title: "CLI" },
  { slug: "artifacts", title: "Artifacts" },
  { slug: "ai", title: "AI Copilot" },
  { slug: "lifecycle", title: "Production Lifecycle" }
] as const

const indexNote = `> Grayhaven Nerve docs index: ${SITE}/llms.txt. Fetch it to discover all pages before exploring further.\n\n`

const rulesMd = (): string => {
  const rows = builtinRules
    .map((r) => `| \`${r.code}\` | \`${r.name}\` | ${RULE_SUMMARIES[r.name] ?? "-"} |`)
    .join("\n")
  return `# ${builtinRules.length} built-in validation rules.

Stable \`HK-*\` codes, suitable for CI gating and waivers. This table is generated from the shipped \`builtinRules\` array in \`@grayhaven/nerve-rules\`; it cannot drift from the code. Custom rules use the same \`rule()\` API and get their own codes.

| Code | Rule | Checks |
| --- | --- | --- |
${rows}

## Example diagnostic

\`\`\`
HK-CONN-011 Error  connector:P1.pin:1
  Wire W2 carries V5 but pin P1.1 is assigned V9.
\`\`\`

Severity drives exit codes: errors fail \`nerve validate\` (exit 1), warnings pass with notice. Releases fail closed on any error.
`
}

/** HIR contract page, generated from the live Effect schema. */
const hirMd = (): string => {
  const schema = hirJsonSchema() as {
    required?: ReadonlyArray<string>
    properties?: Record<string, unknown>
  }
  type Obj = Record<string, unknown>
  const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
  // Effect emits Schema.Unknown as { $id: "/schemas/unknown" } (or {}).
  // Match it precisely — a stringify-includes check would mis-flag any
  // struct that merely CONTAINS an unknown field as wholly unknown.
  const isUnknownSchema = (s: Obj): boolean =>
    s["$id"] === "/schemas/unknown" ||
    (typeof s["$ref"] === "string" && s["$ref"].endsWith("/unknown")) ||
    Object.keys(s).length === 0
  // A record (Schema.Record) is an object with NO declared properties but
  // an additionalProperties value-schema — distinct from a struct.
  const isRecord = (s: Obj): boolean =>
    s["type"] === "object" &&
    (!isObj(s["properties"]) || Object.keys(s["properties"] as Obj).length === 0)
  const typeOf = (s: unknown): string => {
    if (!isObj(s)) return "unknown"
    if (s["enum"] !== undefined) return (s["enum"] as Array<unknown>).map((e) => JSON.stringify(e)).join(" \\| ")
    if (s["anyOf"] !== undefined) return (s["anyOf"] as Array<unknown>).map(typeOf).join(" \\| ")
    if (s["type"] === "array") return `Array<${typeOf(s["items"])}>`
    // Record before the unknown check: a record-of-unknown is
    // Record<string, unknown>, not bare "unknown".
    if (isRecord(s)) {
      const valueType = isObj(s["additionalProperties"]) ? typeOf(s["additionalProperties"]) : "unknown"
      return `Record<string, ${valueType}>`
    }
    if (isUnknownSchema(s)) return "unknown"
    if (s["type"] === "object" && isObj(s["properties"])) {
      return `{ ${Object.keys(s["properties"]).join(", ")} }`
    }
    return String(s["type"] ?? "unknown")
  }
  const table = (name: string, s: unknown): string => {
    if (!isObj(s)) return ""
    // Arrays of structs document the element shape.
    const target = s["type"] === "array" && isObj(s["items"]) ? s["items"] : s
    // Records and property-less objects have no field table — render the
    // single-line type form instead of an empty header-only table.
    if (!isObj(target) || isRecord(target) || !isObj(target["properties"]) || Object.keys(target["properties"] as Obj).length === 0) {
      return `## ${name}\n\nType: \`${typeOf(s)}\`\n`
    }
    const req = new Set(Array.isArray(target["required"]) ? (target["required"] as Array<string>) : [])
    const rows = Object.entries(target["properties"] as Obj)
      .map(([k, v]) => {
        const desc = isObj(v) && typeof v["description"] === "string" ? v["description"] : ""
        return `| \`${k}\` | \`${typeOf(v)}\` | ${req.has(k) ? "yes" : "no"} | ${desc} |`
      })
      .join("\n")
    const prefix = s["type"] === "array" ? "Array of:" : ""
    return `## ${name}\n\n${prefix}\n\n| Field | Type | Required | Notes |\n| --- | --- | --- | --- |\n${rows}\n`
  }
  const props = schema.properties ?? {}
  const sections = Object.entries(props)
    .map(([k, v]) => table(k, v))
    .join("\n")
  return `# HIR ${HIR_SCHEMA_VERSION} — the compiled harness contract.

Generated from the live Effect schema in \`@grayhaven/nerve\` (\`hirJsonSchema()\`); it cannot drift from the code. \`harness.json\` in every exported packet validates against this. Renderers and rules consume HIR only — never user TypeScript. Optional fields are omitted when absent (never \`null\`), and all collections are canonically sorted, so output is byte-deterministic.

${sections}
## Versioning

\`schemaVersion\` is \`${HIR_SCHEMA_VERSION}\`. Additive optional fields may appear without a version bump (guarded by the shape-snapshot test); removals, type changes, or new required fields bump the version.
`
}

/** Part-library metadata: specs first (the way users should reach parts),
 * then the remaining MPNs. Effect-free JSON for the client + the page. */
interface PartMetaRow {
  readonly spec?: string
  readonly mpn: string
  readonly family?: string
  readonly description?: string
  readonly pinCount: number
  readonly gender?: string
  readonly verification?: string
}
const partsMeta = (): Array<PartMetaRow> => {
  const rows: Array<PartMetaRow> = []
  const bySpec = new Map<string, string>()
  for (const [spec, mpn] of Object.entries(partSpecs)) {
    // First spec for an MPN wins the row; aliases noted by their own rows.
    if (!bySpec.has(mpn)) bySpec.set(mpn, spec)
  }
  const speced = new Set(bySpec.keys())
  for (const [mpn, spec] of [...bySpec.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const p = allParts[mpn]!
    rows.push({
      spec,
      mpn,
      family: p.family,
      description: p.description,
      pinCount: p.pinCount,
      gender: p.gender,
      verification: p.provenance?.verification
    })
  }
  for (const mpn of Object.keys(allParts).sort()) {
    if (speced.has(mpn)) continue
    const p = allParts[mpn]!
    rows.push({
      mpn,
      family: p.family,
      description: p.description,
      pinCount: p.pinCount,
      gender: p.gender,
      verification: p.provenance?.verification
    })
  }
  return rows.map((r) => JSON.parse(JSON.stringify(r)) as PartMetaRow) // strip undefined
}

const libraryMd = (rows: ReadonlyArray<PartMetaRow>): string => {
  const table = rows
    .map(
      (r) =>
        `| ${r.spec !== undefined ? `\`${r.spec}\`` : ""} | \`${r.mpn}\` | ${r.family ?? ""} | ${r.pinCount} | ${r.gender ?? ""} | ${r.verification ?? ""} | ${r.description ?? ""} |`
    )
    .join("\n")
  return `# Part library — ${Object.keys(allParts).length} connectors, ${Object.keys(partSpecs).length} compact specs.

Generated from \`@grayhaven/nerve-connectors\` at build time; it cannot drift from the shipped library. Reach parts with \`part("spec")\` — compact specs beat memorizing MPNs — or any raw MPN (case-insensitive, common vendor spellings normalize).

| Spec | MPN | Family | Pins | Gender | Verification | Description |
| --- | --- | --- | --- | --- | --- | --- |
${table}

Aliases: ${Object.entries(partSpecs)
    .filter(([s], i, all) => all.findIndex(([, m]) => m === partSpecs[s as keyof typeof partSpecs]) !== i)
    .map(([s]) => `\`${s}\``)
    .join(", ")} resolve to the same housings as their primary specs.
`
}

mkdirSync(join(OUT, "docs"), { recursive: true })

// ── Part library: emit client JSON + generated page ─────────────────────
const parts = partsMeta()
writeFileSync(
  join(ROOT, "src", "docs", "parts-meta.json"),
  JSON.stringify(parts, null, 2) + "\n"
)

// ── DSL surface: extract from source, inject into the authored page ──────
const dslMeta = extractDslMeta()
writeFileSync(
  join(ROOT, "src", "docs", "dsl-meta.json"),
  JSON.stringify(dslMeta, null, 2) + "\n"
)
{
  const dslPath = join(ROOT, "docs-content", "dsl.md")
  const dslSrc = readFileSync(dslPath, "utf8")
  const START = "<!-- generated:dsl-reference:start -->"
  const END = "<!-- generated:dsl-reference:end -->"
  const s = dslSrc.indexOf(START)
  const e = dslSrc.indexOf(END)
  if (s === -1 || e === -1) throw new Error("dsl.md is missing the generated-reference markers")
  const next =
    dslSrc.slice(0, s + START.length) + "\n" + dslReferenceMd(dslMeta) + dslSrc.slice(e)
  if (next !== dslSrc) writeFileSync(dslPath, next)
}

const sections: string[] = []
const fullParts: string[] = []
for (const page of PAGES) {
  const md = readFileSync(join(ROOT, "docs-content", `${page.slug}.md`), "utf8")
  writeFileSync(join(OUT, "docs", `${page.slug}.md`), indexNote + md)
  sections.push(`- [${page.title}](${SITE}/docs/${page.slug}.md)`)
  fullParts.push(md)
}
// Rules page is generated, not authored.
const rules = rulesMd()
writeFileSync(join(OUT, "docs", "rules.md"), indexNote + rules)
sections.splice(3, 0, `- [Validation Rules](${SITE}/docs/rules.md) (generated from the shipped rule set)`)
fullParts.splice(3, 0, rules)

// HIR contract page is generated from the live schema, not authored.
const hir = hirMd()
writeFileSync(join(OUT, "docs", "hir.md"), indexNote + hir)
// Also emit the raw markdown into docs-content so the in-app /docs/hir
// route renders it through the same glob the authored pages use.
writeFileSync(join(ROOT, "docs-content", "hir.md"), hir)
sections.splice(4, 0, `- [HIR Schema](${SITE}/docs/hir.md) (generated from the live Effect schema)`)
fullParts.splice(4, 0, hir)

// Part library page is generated from the shipped library, not authored.
const library = libraryMd(parts)
writeFileSync(join(OUT, "docs", "library.md"), indexNote + library)
sections.splice(5, 0, `- [Part Library](${SITE}/docs/library.md) (generated from the shipped connector library)`)
fullParts.splice(5, 0, library)

const llms = `# Grayhaven Nerve

> Harnesses as code: typed wiring-harness design in TypeScript, compiled deterministically into schematics, BOMs, cut lists, labels, continuity tests, and build records. Validation rules with stable HK-* codes gate releases fail-closed.

## Docs

${sections.join("\n")}

Everything above embedded in one file: ${SITE}/llms-full.txt

## Packages (npm)

- [@grayhaven/nerve](https://www.npmjs.com/package/@grayhaven/nerve): DSL, HIR schema, compileDesign, diff, rule API
- [@grayhaven/nerve-rules](https://www.npmjs.com/package/@grayhaven/nerve-rules): ${builtinRules.length} built-in validation rules (HK-* codes)
- [@grayhaven/nerve-compiler](https://www.npmjs.com/package/@grayhaven/nerve-compiler): .harness.ts loading, fail-closed gate
- [@grayhaven/nerve-exporters](https://www.npmjs.com/package/@grayhaven/nerve-exporters): SVG/PDF/CSV/test-plan/packet generation
- [@grayhaven/nerve-wireviz](https://www.npmjs.com/package/@grayhaven/nerve-wireviz): WireViz YAML import/export
- [@grayhaven/nerve-cli](https://www.npmjs.com/package/@grayhaven/nerve-cli): nerve init/compile/validate/export/diff/release…
- [@grayhaven/nerve-connectors](https://www.npmjs.com/package/@grayhaven/nerve-connectors): verified connector part library

## Source

- [GitHub repository](https://github.com/tylergibbs1/nerve): Apache-2.0, monorepo with golden-fixture examples
- [Live editor](${SITE}/projects): compiles in the browser (note: the app routes are client-rendered; use the .md variants above)
`
writeFileSync(join(OUT, "llms.txt"), llms)

const full = `# Grayhaven Nerve: complete documentation

> Harnesses as code. This file embeds every docs page; no further fetches needed. Index: ${SITE}/llms.txt

${fullParts.join("\n\n---\n\n")}
`
writeFileSync(join(OUT, "llms-full.txt"), full)
// Effect-free rules metadata for the docs page (importing builtinRules in
// the client would drag the effect runtime into the route chunk).
writeFileSync(
  join(ROOT, "src", "docs", "rules-meta.json"),
  JSON.stringify(builtinRules.map((r) => ({ code: r.code, name: r.name })), null, 2) + "\n"
)
// Count what was actually written rather than trusting a hand-kept
// formula (it drifted to "+1" while the script grew rules/hir/library).
const mirrorCount = readdirSync(join(OUT, "docs")).filter((f) => f.endsWith(".md")).length
console.log(`generated llms.txt, llms-full.txt, ${mirrorCount} page mirrors`)
