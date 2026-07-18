import { useSyncExternalStore } from "react"
import { isDirty, subscribeSource } from "./sources.js"

const subscribe = (cb: () => void): (() => void) => subscribeSource(() => cb())

/** Live dirty flag — fixes the header dot lagging the first keystroke. */
export const useIsDirty = (projectId: string): boolean =>
  useSyncExternalStore(subscribe, () => isDirty(projectId))
