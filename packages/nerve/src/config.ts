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

/** Lifecycle risk per PRD §29 supplier/lifecycle fields. */
export type PartLifecycle = "active" | "nrnd" | "obsolete"

export interface PartCost {
  readonly unitCost: number
  readonly supplier?: string
  readonly leadTimeDays?: number
  readonly lifecycle?: PartLifecycle
}

/**
 * Cost and quote model (PRD §29). Prices are organization data, not design
 * data — they live in config (or a future part-data provider, §42), never
 * in the HIR.
 */
export interface CostModel {
  readonly currency?: string
  readonly laborRatePerHour: number
  /** Fraction of material lost to scrap, e.g. 0.05. */
  readonly scrapFactor?: number
  /** First-pass yield, e.g. 0.97 — per-unit cost divides by this. */
  readonly yield?: number
  /** Days at/above which a part is flagged long-lead. Default 60. */
  readonly longLeadThresholdDays?: number
  /** Part costs by MPN (connectors, terminals, seals, splice parts...). */
  readonly parts?: Readonly<Record<string, PartCost>>
  /** Wire cost per meter by gauge, e.g. { "18AWG": 0.22 }. */
  readonly wireCostPerMeter?: Readonly<Record<string, number>>
  readonly defaultWireCostPerMeter?: number
  readonly sleeveCostPerMeter?: number
  readonly labelUnitCost?: number
  readonly spliceUnitCost?: number
  /** Fallback for parts with no entry; also flags the line as unpriced. */
  readonly defaultPartCost?: number
}

export interface NerveConfig {
  readonly units?: Units
  readonly defaultWireTolerance?: number
  readonly outputDir?: string
  readonly rules?: RuleConfig
  readonly costing?: CostModel
  readonly exports?: {
    readonly csv?: boolean
    readonly svg?: boolean
    readonly pdf?: boolean
  }
}

export const defineConfig = (config: NerveConfig): NerveConfig => config
