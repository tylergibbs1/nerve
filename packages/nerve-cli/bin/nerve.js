#!/usr/bin/env node
// Prefer the compiled build when present (published package); fall back to
// loading TypeScript source through jiti (monorepo dev).
let main
try {
  ;({ main } = await import("../dist/index.js"))
} catch {
  const { createJiti } = await import("jiti")
  const jiti = createJiti(import.meta.url)
  ;({ main } = await jiti.import("../src/index.ts"))
}
process.exit(await main())
