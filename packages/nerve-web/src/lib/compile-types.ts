import type { Hir } from "@grayhaven/nerve"
import type { TestPlan } from "@grayhaven/nerve-exporters"

export interface CompileRequest {
  readonly id: number
  readonly projectId: string
  /** When present, compile this TypeScript source instead of the bundled design (§9.6). */
  readonly source?: string
}

export interface CompileResult {
  readonly hir: Hir
  readonly svg: string
  readonly boardSvg: string
  readonly testPlan: TestPlan
}

export interface CompileResponse {
  readonly id: number
  readonly result?: CompileResult
  readonly error?: string
}
