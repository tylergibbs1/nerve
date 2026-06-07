import { defineConfig } from "@playwright/test"

/**
 * E2E smoke + a11y suite against the production build (vite preview).
 * Run: bun run e2e  (separate from unit tests — needs a built dist/).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env["CI"] !== undefined ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4399",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "bunx vite preview --port 4399 --strictPort",
    url: "http://localhost:4399",
    reuseExistingServer: true,
    timeout: 30_000
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
})
