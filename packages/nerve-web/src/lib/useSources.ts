import { useSyncExternalStore } from "react"
import { getSource, isDirty, subscribeSource } from "./sources.js"

const subscribe = (cb: () => void): (() => void) => subscribeSource(() => cb())

/** Live source text — re-renders on every store write (editor, AI, remote tab). */
export const useSource = (projectId: string): string =>
  useSyncExternalStore(subscribe, () => getSource(projectId))

/** Live dirty flag — fixes the header dot lagging the first keystroke. */
export const useIsDirty = (projectId: string): boolean =>
  useSyncExternalStore(subscribe, () => isDirty(projectId))
