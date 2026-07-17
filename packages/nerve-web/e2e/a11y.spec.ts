/**
 * Accessibility audit (axe-core): serious/critical violations are release
 * blockers on the public surfaces. Monochrome-on-black is doctrine, so
 * contrast findings matter here more than most apps.
 */
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const PAGES = ["/", "/showcase", "/projects", "/docs/quickstart", "/projects/motor-controller/diagram"]

for (const path of PAGES) {
  test(`axe: ${path} has no serious/critical violations`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    // .cm-scroller is CodeMirror-internal (tabindex=-1 by design; its
    // contenteditable child is the keyboard path and scrolling follows the
    // cursor) — a known axe false positive for CM6.
    const results = await new AxeBuilder({ page }).exclude(".cm-scroller").analyze()
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    )
    expect(
      blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
      JSON.stringify(blocking, null, 2).slice(0, 2000)
    ).toEqual([])
  })
}
