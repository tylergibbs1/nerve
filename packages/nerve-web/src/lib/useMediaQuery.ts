import { useCallback, useSyncExternalStore } from "react"

/**
 * Subscribe to a media query.
 *
 * useSyncExternalStore over matchMedia rather than useEffect + useState: the
 * match is external state we read during render, not something we set after
 * one. It also means the first paint already knows the answer, so a layout
 * that swaps on the breakpoint never flashes the wrong arrangement.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // SSR/prerender has no viewport; assume the roomy layout.
    () => false
  )
}
