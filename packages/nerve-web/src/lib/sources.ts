/**
 * Editable source per project (§9.6). Initial text is the bundled example
 * source; edits persist to localStorage through a debounced writer
 * (t3code's debounced-storage pattern) so a reload never loses work.
 */
import { Debouncer } from "@tanstack/pacer"
import motorControllerSource from "../../../../examples/motor-controller/src/main.harness.ts?raw"
import sensorSpliceSource from "../../../../examples/sensor-splice/src/main.harness.ts?raw"
import robotPlatformSource from "../../../../examples/robot-platform/src/main.harness.ts?raw"

const initial: Readonly<Record<string, string>> = {
  "motor-controller": motorControllerSource,
  "sensor-splice": sensorSpliceSource,
  "robot-platform": robotPlatformSource
}

const edited = new Map<string, string>()

const storageKey = (projectId: string): string => `nerve:source:${projectId}`

const persist = new Debouncer(
  (projectId: string, source: string) => {
    try {
      // Edits matching the bundled source don't need persisting.
      if (source === initial[projectId]) localStorage.removeItem(storageKey(projectId))
      else localStorage.setItem(storageKey(projectId), source)
    } catch {
      // Quota/privacy-mode failures degrade to session-only edits.
    }
  },
  { wait: 500 }
)

const fromStorage = (projectId: string): string | undefined => {
  try {
    return localStorage.getItem(storageKey(projectId)) ?? undefined
  } catch {
    return undefined
  }
}

export const getSource = (projectId: string): string =>
  edited.get(projectId) ?? fromStorage(projectId) ?? initial[projectId] ?? ""

// Change subscription: lets the editor reflect writes made elsewhere
// (e.g. the AI pane applying a patch).
const listeners = new Set<(projectId: string) => void>()

export const subscribeSource = (listener: (projectId: string) => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const setSource = (projectId: string, source: string): void => {
  edited.set(projectId, source)
  persist.maybeExecute(projectId, source)
  for (const listener of listeners) listener(projectId)
}

/** True when the working source differs from the bundled example. */
export const isDirty = (projectId: string): boolean =>
  getSource(projectId) !== (initial[projectId] ?? "")

/** Discard edits and return to the bundled source. */
export const resetSource = (projectId: string): string => {
  edited.delete(projectId)
  try {
    localStorage.removeItem(storageKey(projectId))
  } catch {
    // ignore
  }
  return initial[projectId] ?? ""
}
