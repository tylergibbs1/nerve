import { useEffect, useRef, useState } from "react"

/**
 * Reference loading-cue pattern: don't show a busy state for operations
 * that finish fast (150ms delay), and once shown keep it up for at least
 * 300ms so it never flickers.
 */
export const useMinimumLoading = (loading: boolean, delay = 150, minimum = 300): boolean => {
  const [shown, setShown] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        shownAt.current = performance.now()
        setShown(true)
      }, delay)
      return () => clearTimeout(t)
    }
    if (!shown) return
    const elapsed = performance.now() - shownAt.current
    if (elapsed >= minimum) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(false), minimum - elapsed)
    return () => clearTimeout(t)
  }, [loading, shown, delay, minimum])

  return shown
}
