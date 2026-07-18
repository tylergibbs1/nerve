import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

// shadcn components import "@/lib/utils"; mirror the alias the web app's
// tsconfig and vite config declare so component tests can resolve it.
const webSrc = fileURLToPath(new URL("./packages/nerve-web/src", import.meta.url))

export default defineConfig({
  resolve: { alias: { "@": webSrc } },
  test: {
    exclude: [
      ...configDefaults.exclude,
      "**/e2e/**", // Playwright specs run via `bun run e2e`, not vitest
      "**/.stryker-tmp/**" // mutation-testing sandboxes
    ]
  }
})
