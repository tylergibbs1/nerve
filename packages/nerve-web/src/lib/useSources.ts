import { useSyncExternalStore } from "react"
import { isDirty, subscribeSource } from "./sources.js"

const subscribe = (cb: () => void): (() => void) => subscribeSource(() => cb())

/** Live dirty flag — fixes the header dot lagging the first keystroke.
 *
 * `subscribe` fires on every source notification, i.e. every keystroke, and
 * React 19 (^19.1.0, resolved 19.2.7) may call the snapshot more than once
 * per render. Both are safe here: `isDirty` is O(1) after a project's first
 * call, and it returns a boolean, so repeated calls over unchanged state are
 * `Object.is`-equal and React does not re-render. Keep it primitive — a
 * snapshot that allocates a fresh object each call loops forever. */
export const useIsDirty = (projectId: string): boolean =>
  useSyncExternalStore(subscribe, () => isDirty(projectId))
