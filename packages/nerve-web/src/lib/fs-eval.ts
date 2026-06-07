/**
 * Multi-file harness evaluation (PRD §9.6 project explorer): an fsMap of
 * TypeScript sources + an entrypoint, evaluated with a require() shim —
 * relative imports resolve WITHIN the map (NodeNext-style: the authored
 * `./main.harness.js` specifier probes to `/main.harness.ts`), bare
 * specifiers resolve against the sandbox module table, and import cycles
 * fail with the exact chain.
 *
 * Pure module (no worker globals) so the resolution rules are unit-tested
 * outside the browser.
 */
import type { HarnessDesign } from "@grayhaven/nerve"

export type FsMap = Readonly<Record<string, string>>

/** "./src/../main.harness.ts" → "/main.harness.ts" (POSIX, rooted). */
export const normalizePath = (path: string): string => {
  const parts = path.replace(/\\/g, "/").split("/")
  const out: Array<string> = []
  for (const part of parts) {
    if (part === "" || part === ".") continue
    if (part === "..") out.pop()
    else out.push(part)
  }
  return "/" + out.join("/")
}

export const normalizeFsMap = (fsMap: FsMap): Map<string, string> => {
  const files = new Map<string, string>()
  for (const [key, content] of Object.entries(fsMap)) {
    files.set(normalizePath(key), content)
  }
  return files
}

const dirnameOf = (path: string): string => path.slice(0, path.lastIndexOf("/")) || "/"

/**
 * Resolve a relative specifier against the map with extension probing:
 * exact, authored-`.js` → `.ts`/`.tsx` (NodeNext), bare → `.ts`/`.tsx`,
 * directory → `/index.ts`.
 */
export const resolveFilePath = (
  files: ReadonlyMap<string, string>,
  from: string,
  spec: string
): string | undefined => {
  const base = normalizePath(spec.startsWith("/") ? spec : `${dirnameOf(from)}/${spec}`)
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    base.replace(/\.js$/, ".tsx"),
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`
  ]
  return candidates.find((c) => files.has(c))
}

const isHarnessDesign = (value: unknown): value is HarnessDesign =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "harness"

export interface EvaluateOptions {
  /** Bare-specifier module table (the worker's sandbox surface). */
  readonly modules: Readonly<Record<string, unknown>>
  /** TS → CJS transform (sucrase's, injected so this module stays lazy-free). */
  readonly transform: (source: string) => string
}

/**
 * Evaluate `entrypoint` within the map and return its default-exported
 * design. Modules evaluate once (shared imports see one instance); cycles
 * throw with the exact import chain.
 */
export const evaluateFsMap = (
  fsMap: FsMap,
  entrypoint: string,
  options: EvaluateOptions
): HarnessDesign => {
  const files = normalizeFsMap(fsMap)
  const entry = normalizePath(entrypoint)
  if (!files.has(entry)) {
    throw new Error(
      `Entrypoint ${entry} is not in the project. Files: ${[...files.keys()].join(", ")}`
    )
  }

  const cache = new Map<string, { exports: Record<string, unknown> }>()
  const visiting: Array<string> = []

  const loadModule = (path: string): unknown => {
    const cached = cache.get(path)
    if (cached !== undefined) return cached.exports
    const at = visiting.indexOf(path)
    if (at !== -1) {
      throw new Error(`Circular import: ${[...visiting.slice(at), path].join(" → ")}`)
    }
    visiting.push(path)
    try {
      const code = options.transform(files.get(path)!)
      const mod = { exports: {} as Record<string, unknown> }
      const requireFrom = (spec: string): unknown => {
        if (!spec.startsWith(".") && !spec.startsWith("/")) {
          const m = options.modules[spec]
          if (m === undefined) {
            throw new Error(
              `Module "${spec}" is not available in the editor sandbox. Available: ${Object.keys(options.modules).join(", ")}`
            )
          }
          return m
        }
        const resolved = resolveFilePath(files, path, spec)
        if (resolved === undefined) {
          throw new Error(
            `Cannot resolve "${spec}" from ${path}. Project files: ${[...files.keys()].join(", ")}`
          )
        }
        return loadModule(resolved)
      }
      new Function("require", "module", "exports", code)(requireFrom, mod, mod.exports)
      cache.set(path, mod)
      return mod.exports
    } finally {
      visiting.pop()
    }
  }

  const exports = loadModule(entry) as { default?: unknown }
  const design = exports.default
  if (!isHarnessDesign(design)) {
    throw new Error(`${entry} must default-export harness(...) (or a variant of one).`)
  }
  return design
}
