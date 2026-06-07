import type { Hir } from "@grayhaven/nerve"
import type { TestPlan } from "@grayhaven/nerve-exporters"

export interface CompileRequest {
  readonly id: number
  readonly kind?: "compile" | "export"
  readonly projectId: string
  /** When present, compile this TypeScript source instead of the bundled design (§9.6). */
  readonly source?: string
  /** Multi-file project (§9.6 explorer): path → source. Wins over `source`. */
  readonly fsMap?: Readonly<Record<string, string>>
  /** Entry module within fsMap (default "/main.harness.ts"). */
  readonly entrypoint?: string
}

export interface CompileResult {
  readonly hir: Hir
  readonly svg: string
  readonly boardSvg: string
  readonly facesSvg: string
  readonly testPlan: TestPlan
}

export interface CompileResponse {
  readonly id: number
  readonly result?: CompileResult
  /** Export responses: the deterministic packet zip. */
  readonly zip?: Uint8Array
  readonly error?: string
}
