import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
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
  build: {
    // vendor-editor (CodeMirror+lezer, one logical unit) sits at ~510KB and
    // only loads with the workspace; the default 500KB warning is noise here.
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        // Vendor groups: framework bytes change far less often than app
        // code — splitting keeps them cache-stable across deploys.
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (/codemirror|@lezer|@uiw/.test(id)) return "vendor-editor"
            if (/react-dom|\/react\//.test(id)) return "vendor-react"
            if (/@tanstack/.test(id)) return "vendor-tanstack"
          }
          return undefined
        }
      }
    }
  },
  server: {
    // Pre-transform the hot paths on dev start.
    warmup: { clientFiles: ["./src/main.tsx", "./src/routes/projects.$projectId.tsx"] }
  },
  plugins: [
    tailwindcss(),
    // Must come before react() per TanStack Router docs.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react()
  ]
})
