import type { Hir } from "@grayhaven/nerve"
import type { TestPlan } from "@grayhaven/nerve-exporters"

export interface CompileRequest {
  readonly id: number
  readonly projectId: string
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
