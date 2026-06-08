/**
 * Editable sources per project (§9.6), now an fsMap: each project is a set
 * of files (path → TypeScript), not one string. The bundled examples seed
 * the initial map — motor-controller ships with its real variants/long.ts,
 * which only multi-file evaluation can open. Edits persist to localStorage
 * through a debounced writer (t3code's debounced-storage pattern) so a
 * reload never loses work.
 *
 * The entry file is "/main.harness.ts"; getSource/setSource keep their
 * original single-string contract by operating on it (the AI pane and
 * legacy callers speak entry-file).
 */
import { Debouncer } from "@tanstack/pacer"
import motorControllerSource from "../../../../examples/motor-controller/src/main.harness.ts?raw"
import motorControllerLongSource from "../../../../examples/motor-controller/src/variants/long.ts?raw"
import sensorSpliceSource from "../../../../examples/sensor-splice/src/main.harness.ts?raw"
import robotPlatformSource from "../../../../examples/robot-platform/src/main.harness.ts?raw"

export const ENTRY_FILE = "/main.harness.ts"

const initial: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "motor-controller": {
    [ENTRY_FILE]: motorControllerSource,
    // The §8.4 SKU variant: imports ../main.harness.js — the multi-file
    // resolution proof case (compiles via CLI jiti AND the web sandbox).
    "/variants/long.ts": motorControllerLongSource
  },
  "sensor-splice": { [ENTRY_FILE]: sensorSpliceSource },
  "robot-platform": { [ENTRY_FILE]: robotPlatformSource }
}

const edited = new Map<string, string>() // `${projectId} ${path}` → source

const editKey = (projectId: string, path: string): string => `${projectId} ${path}`

// Entry file keeps the legacy storage key (existing saved edits survive);
// other files get a per-path key.
const storageKey = (projectId: string, path: string): string =>
  path === ENTRY_FILE ? `nerve:source:${projectId}` : `nerve:source:${projectId}:${path}`

const writePersist = (projectId: string, path: string, source: string): void => {
  // The shared project is ephemeral — its source lives in the URL
  // fragment, not localStorage. Persisting it would leave it on disk
  // forever, contradicting the share-link contract.
  if (projectId === "shared") return
  try {
    // Edits matching the bundled source don't need persisting.
    if (source === initial[projectId]?.[path]) {
      localStorage.removeItem(storageKey(projectId, path))
    } else {
      localStorage.setItem(storageKey(projectId, path), source)
    }
  } catch {
    // Quota/privacy-mode failures degrade to session-only edits.
  }
}

// One debouncer PER (project,path): a single shared Debouncer is one
// trailing timer, so editing file B within 500ms of file A would drop A's
// write entirely (silent loss on reload). Keyed timers debounce each file
// independently.
const persisters = new Map<string, Debouncer<(s: string) => void>>()
const persist = (projectId: string, path: string, source: string): void => {
  const key = `${projectId} ${path}`
  let d = persisters.get(key)
  if (d === undefined) {
    d = new Debouncer((s: string) => writePersist(projectId, path, s), { wait: 500 })
    persisters.set(key, d)
  }
  d.maybeExecute(source)
}

const fromStorage = (projectId: string, path: string): string | undefined => {
  try {
    return localStorage.getItem(storageKey(projectId, path)) ?? undefined
  } catch {
    return undefined
  }
}

/** Whether the project has a bundled baseline to reset to. The shared
 * project does not — its only source is the URL fragment, so "Reset"
 * would wipe it to an empty string irrecoverably. */
export const hasBundledSource = (projectId: string): boolean =>
  initial[projectId] !== undefined

// Projects with no bundled baseline (the shared project, opened from a
// link) register their file set here so tabs/compile see every file.
const registered = new Map<string, ReadonlyArray<string>>()

/** Seed a project from a decoded share link: write each file's source and
 * record its file list (so listFiles shows all the tabs). */
export const registerProjectFiles = (
  projectId: string,
  files: Readonly<Record<string, string>>
): void => {
  for (const [path, source] of Object.entries(files)) edited.set(editKey(projectId, path), source)
  registered.set(projectId, Object.keys(files))
}

/** Project file listing, entry first (stable order for tabs). */
export const listFiles = (projectId: string): ReadonlyArray<string> => {
  const paths = Object.keys(initial[projectId] ?? {})
  const registeredPaths = registered.get(projectId) ?? []
  const all = new Set([ENTRY_FILE, ...paths, ...registeredPaths])
  return [ENTRY_FILE, ...[...all].filter((p) => p !== ENTRY_FILE).sort()]
}

export const getFileSource = (projectId: string, path: string): string =>
  edited.get(editKey(projectId, path)) ??
  fromStorage(projectId, path) ??
  initial[projectId]?.[path] ??
  ""

/** The whole project as an fsMap for the compile worker. */
export const getFiles = (projectId: string): Readonly<Record<string, string>> =>
  Object.fromEntries(listFiles(projectId).map((p) => [p, getFileSource(projectId, p)]))

/** Entry-file source (original single-string contract). */
export const getSource = (projectId: string): string => getFileSource(projectId, ENTRY_FILE)

// Change subscription: lets the editor reflect writes made elsewhere
// (the AI pane applying a patch, or another tab via BroadcastChannel).
export type SourceOrigin = "local" | "remote"
const listeners = new Set<(projectId: string, origin: SourceOrigin) => void>()

export const subscribeSource = (
  listener: (projectId: string, origin: SourceOrigin) => void
): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = (projectId: string, origin: SourceOrigin): void => {
  for (const listener of listeners) listener(projectId, origin)
}

// Multi-tab sync: without this, two tabs on one project silently clobber
// each other through the debounced localStorage writer (last writer wins).
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nerve-sources") : undefined
if (channel !== undefined) {
  channel.onmessage = (
    e: MessageEvent<{ projectId: string; path?: string; source: string }>
  ) => {
    edited.set(editKey(e.data.projectId, e.data.path ?? ENTRY_FILE), e.data.source)
    notify(e.data.projectId, "remote")
  }
}

export const setFileSource = (projectId: string, path: string, source: string): void => {
  edited.set(editKey(projectId, path), source)
  persist(projectId, path, source)
  channel?.postMessage({ projectId, path, source })
  notify(projectId, "local")
}

/** Entry-file write (original single-string contract). */
export const setSource = (projectId: string, source: string): void =>
  setFileSource(projectId, ENTRY_FILE, source)

/** True when any file differs from the bundled example. */
export const isDirty = (projectId: string): boolean =>
  listFiles(projectId).some(
    (p) => getFileSource(projectId, p) !== (initial[projectId]?.[p] ?? "")
  )

/** Discard all edits and return to the bundled entry source. */
export const resetSource = (projectId: string): string => {
  for (const path of listFiles(projectId)) {
    edited.delete(editKey(projectId, path))
    try {
      localStorage.removeItem(storageKey(projectId, path))
    } catch {
      // ignore
    }
  }
  return initial[projectId]?.[ENTRY_FILE] ?? ""
}
