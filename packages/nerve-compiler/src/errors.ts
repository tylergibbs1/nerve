/**
 * Expected failure modes, modeled explicitly (PRD §10.3).
 */
import { Data } from "effect"
import type { Diagnostic } from "@grayhaven/nerve"

export class CompileError extends Data.TaggedError("CompileError")<{
  readonly message: string
  readonly source?: string
  readonly cause?: unknown
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly diagnostics: ReadonlyArray<Diagnostic>
}> {}

export class ExportError extends Data.TaggedError("ExportError")<{
  readonly artifact: string
  readonly cause: unknown
}> {}
