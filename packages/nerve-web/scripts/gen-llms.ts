/**
 * Agent-readable docs (AX pass): generates at build time so the variants
 * can never go stale relative to the app.
 *   public/docs/<page>.md   — markdown mirror of each docs page
 *   public/llms.txt         — index: H1 + blockquote + H2 link sections
 *   public/llms-full.txt    — the entire docs embedded, no fetches needed
 * The rules page is generated from the live builtinRules array.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { builtinRules } from "../../nerve-rules/src/index.ts"
import { RULE_SUMMARIES } from "../src/docs/rule-summaries.ts"

const ROOT = join(import.meta.dir, "..")
const OUT = join(ROOT, "public")
const SITE = "https://nerve-demo.vercel.app"

const PAGES = [
  { slug: "quickstart", title: "Quickstart" },
  { slug: "dsl", title: "DSL Reference" },
  { slug: "sdk", title: "TypeScript SDK" },
  { slug: "cli", title: "CLI" },
  { slug: "artifacts", title: "Artifacts" },
  { slug: "ai", title: "AI Copilot" }
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

mkdirSync(join(OUT, "docs"), { recursive: true })

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
console.log(`generated llms.txt, llms-full.txt, ${PAGES.length + 1} page mirrors`)
