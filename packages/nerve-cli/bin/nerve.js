#!/usr/bin/env node
// Dev-mode launcher: loads the TypeScript CLI through jiti. A published
// build will ship compiled JS here instead.
import { createJiti } from "jiti"

const jiti = createJiti(import.meta.url)
const { main } = await jiti.import("../src/index.ts")
process.exit(await main())
