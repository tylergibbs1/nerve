import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "**/e2e/**", // Playwright specs run via `bun run e2e`, not vitest
      "**/.stryker-tmp/**" // mutation-testing sandboxes
    ]
  }
})
