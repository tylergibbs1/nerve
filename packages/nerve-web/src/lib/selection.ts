/**
 * Cross-view selection (PRD §11.3): one selected object, visible
 * everywhere — rendered sheets highlight it, the inspector describes it,
 * diagnostics and search set it. useSyncExternalStore, same pattern as
 * sources.
 */
import { useSyncExternalStore } from "react"

export interface Selection {
  readonly kind: "wire" | "connector" | "pin" | "splice"
  readonly ref: string
  readonly pin?: string | undefined
}

let current: Selection | undefined
const listeners = new Set<() => void>()

export const setSelection = (sel: Selection | undefined): void => {
  current = sel
  for (const l of listeners) l()
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const useSelection = (): Selection | undefined =>
  useSyncExternalStore(subscribe, () => current)

/** Parse a diagnostic target ref ("wire:W2", "connector:P1.pin:1"). */
export const selectionFromTarget = (target: string): Selection | undefined => {
  const pin = /^connector:([^.]+)\.pin:(.+)$/.exec(target)
  if (pin !== null) return { kind: "pin", ref: pin[1]!, pin: pin[2]! }
  const m = /^(wire|connector|splice|branch|label|bom):(.+)$/.exec(target)
  if (m === null) return undefined
  if (m[1] === "wire" || m[1] === "connector" || m[1] === "splice") {
    return { kind: m[1], ref: m[2]! }
  }
  return undefined
}

/** Selection from a rendered element's data-* attributes. */
export const selectionFromElement = (el: Element): Selection | undefined => {
  const hit = el.closest("[data-wire], [data-pin], [data-connector], [data-splice]")
  if (hit === null) return undefined
  const wire = hit.getAttribute("data-wire")
  const connector = hit.getAttribute("data-connector")
  const pin = hit.getAttribute("data-pin")
  const splice = hit.getAttribute("data-splice")
  if (wire !== null) return { kind: "wire", ref: wire }
  if (connector !== null && pin !== null) return { kind: "pin", ref: connector, pin }
  if (connector !== null) return { kind: "connector", ref: connector }
  if (splice !== null) return { kind: "splice", ref: splice }
  return undefined
}

/** CSS selector matching every rendered element of a selection. */
export const selectorFor = (sel: Selection): string => {
  switch (sel.kind) {
    case "wire":
      return `[data-wire="${CSS.escape(sel.ref)}"]`
    case "pin":
      return `[data-connector="${CSS.escape(sel.ref)}"][data-pin="${CSS.escape(sel.pin ?? "")}"]`
    case "connector":
      return `[data-connector="${CSS.escape(sel.ref)}"]`
    case "splice":
      return `[data-splice="${CSS.escape(sel.ref)}"]`
  }
}
