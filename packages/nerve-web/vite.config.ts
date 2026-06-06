import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"

// @anthropic-ai/sdk's import graph reaches Node-only helper modules
// (agent-toolset, credential chain) that never execute in the browser.
// Shim the builtins so rollup can resolve their named exports.
const nodeShim = fileURLToPath(new URL("./src/shims/node-empty.ts", import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^node:(crypto|child_process|util|stream|stream\/promises|fs|fs\/promises|path|readline|os)$/,
        replacement: nodeShim
      }
    ]
  },
  plugins: [
    // Must come before react() per TanStack Router docs.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react()
  ]
})
