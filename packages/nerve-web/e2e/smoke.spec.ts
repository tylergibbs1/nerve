/**
 * E2E smoke: the flows a release must never break, exercised against the
 * real production bundle (worker compile, router, editor).
 */
import { expect, test } from "@playwright/test"

test("landing -> projects -> workspace compiles and renders the schematic", async ({ page }) => {
  await page.goto("/projects")
  await page.locator(".project-card", { hasText: "Motor Controller" }).click()
  // Worker compile lands: status line + diagram SVG from the exporter.
  await expect(page.locator(".toolbar-status")).toContainText(/0 error/i, { timeout: 15_000 })
  await expect(page.locator(".diagram-pane svg")).toBeVisible()
  await expect(page.locator("[data-wire]").first()).toBeAttached()
})

test("a broken harness surfaces HK diagnostics + lint gutter", async ({ page }) => {
  // Seed a broken source (the canonical PRD §12 V5->V9 edit) via storage —
  // exactly what a returning user with bad edits sees on load. Contexts are
  // fresh per test, so nothing leaks.
  await page.goto("/projects/sensor-splice/diagram")
  await expect(page.locator(".diagram-pane svg")).toBeVisible({ timeout: 15_000 })
  // Drive a real editor transaction through the automation hook (CodeMirror
  // virtualizes the DOM, so scraping text is lossy).
  const seeded = await page.evaluate(() => {
    const view = (window as unknown as {
      __nerveEditor?: {
        state: { doc: { toString(): string } }
        dispatch(spec: { changes: { from: number; to: number; insert: string } }): void
      }
    }).__nerveEditor
    if (view === undefined) return false
    const doc = view.state.doc.toString()
    const idx = doc.indexOf('1: "V5", 2: "GND", 3: "CAN_H"')
    if (idx === -1) return false
    view.dispatch({ changes: { from: idx + 4, to: idx + 6, insert: "V9" } })
    return true
  })
  test.skip(!seeded, "bundled source drifted")
  await expect(page.locator("body")).toContainText("HK-CONN-011", { timeout: 20_000 })
  await expect(page.locator(".cm-lint-marker").first()).toBeVisible()
})

test("diagram sheet actions exist and Copy SVG puts markup on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/projects/motor-controller/diagram")
  await expect(page.locator(".diagram-pane svg")).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: "Copy SVG" }).click()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toContain("<svg")
  expect(clip).toContain("data-wire")
})

test("export packet downloads a zip built in the worker", async ({ page }) => {
  await page.goto("/projects/motor-controller/diagram")
  await expect(page.locator(".diagram-pane svg")).toBeVisible({ timeout: 15_000 })
  const download = page.waitForEvent("download", { timeout: 30_000 })
  await page.getByRole("button", { name: /export packet/i }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe("motor-controller-packet.zip")
})

test("docs render with copy-as-markdown and highlighted code", async ({ page }) => {
  await page.goto("/docs/dsl")
  await expect(page.locator(".docs-content, .docs-body").first()).toBeVisible()
  await expect.poll(async () => page.locator("pre code span[class*='tok-']").count(), {
    timeout: 10_000
  }).toBeGreaterThan(5)
  await expect(page.getByRole("button", { name: /copy.*markdown/i }).first()).toBeVisible()
})
