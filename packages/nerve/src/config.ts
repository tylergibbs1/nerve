/**
 * Project configuration (PRD §10.5).
 *
 * Lives in `nerve.config.ts` at the project root:
 *
 * ```ts
 * import { defineConfig } from "@grayhaven/nerve"
 * export default defineConfig({
 *   units: "mm",
 *   outputDir: "dist",
 *   rules: { missingWireColor: "error", missingWireLength: "warning" },
 *   exports: { csv: true, svg: true }
 * })
 * ```
 */
import type { Units } from "./domain.js"
import type { RuleConfig } from "./rules.js"

export interface NerveConfig {
  readonly units?: Units
  readonly defaultWireTolerance?: number
  readonly outputDir?: string
  readonly rules?: RuleConfig
  readonly exports?: {
    readonly csv?: boolean
    readonly svg?: boolean
    readonly pdf?: boolean
  }
}

export const defineConfig = (config: NerveConfig): NerveConfig => config
