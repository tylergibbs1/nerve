import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { SITE } from "./scripts/site.js"

const genScript = fileURLToPath(new URL("./scripts/gen-llms.ts", import.meta.url))

// Agent-readable docs variants regenerate on every build AND dev-server
// start (they previously existed only after a build, so dev served stale
// mirrors). Spawned under Bun: the script uses Bun-native TS imports.
const genLlms = (): void => {
  execFileSync("bun", [genScript], { stdio: "inherit" })
}

// AX discovery headers; production equivalents live in the deploy script's
// vercel.json. Served in dev/preview too so agent testing works locally.
const axHeaders = {
  Link: '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"',
  "X-Llms-Txt": "/llms.txt"
}

export default defineConfig({
  // Tailwind v4's browser floor is Safari 16.4 / Chrome 111 / FF128 — the
  // CSS already breaks below it, so transpiling JS lower is dead weight.
  // The es-format worker needs module-worker support (Safari 15+/FF114+).
  build: {
    target: ["es2022", "chrome111", "safari16.4", "firefox114"],
    sourcemap: true,
    // vendor-editor (CodeMirror+lezer, one logical unit) sits at ~510KB and
    // only loads with the workspace; the default 500KB warning is noise here.
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        // Vendor groups: framework bytes change far less often than app
        // code — splitting keeps them cache-stable across deploys.
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            // Table/pacer/devtools stay OUT of the modulepreloaded vendor
            // chunk: only the lazy data routes use them.
            if (/@tanstack\/(table-core|react-table|pacer|react-pacer|devtools)/.test(id)) return undefined
            if (/codemirror|@lezer|@uiw/.test(id)) return "vendor-editor"
            if (/react-dom|\/react\//.test(id)) return "vendor-react"
            if (/@tanstack/.test(id)) return "vendor-tanstack"
            if (/tailwind-merge|@radix-ui|clsx|class-variance-authority/.test(id)) return "vendor-ui"
            if (/\/marked\//.test(id)) return "vendor-markdown"
          }
          return undefined
        }
      }
    }
  },
  css: { devSourcemap: true },
  worker: { format: "es" },
  optimizeDeps: {
    // Default entry inference only crawls index.html; without the worker
    // entry, the first compile triggers a re-optimization full reload.
    entries: ["index.html", "src/worker/compile.worker.ts"]
  },
  server: {
    headers: axHeaders,
    // Only modules the static-import crawl can't reach: everything behind
    // the autoCodeSplitting boundary, plus the worker entry.
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/components/SourcePane.tsx",
        "./src/components/AiPane.tsx",
        "./src/worker/compile.worker.ts"
      ]
    }
  },
  preview: { headers: axHeaders },
  plugins: [
    {
      name: "gen-llms",
      buildStart: () => genLlms(),
      configureServer: () => genLlms()
    },
    {
      // One source for the canonical URL: scripts/site.ts feeds gen-llms
      // and replaces %SITE% in index.html OG tags.
      name: "inject-site",
      transformIndexHtml: (html: string) => html.replaceAll("%SITE%", SITE)
    },
    tailwindcss(),
    // Must come before react() per TanStack Router docs.
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      codeSplittingOptions: {
        // '/' is 1.7KB and the first paint of every cold visit; splitting
        // it costs one serialized RTT after the entry executes.
        splitBehavior: ({ routeId }: { routeId: string }) => (routeId === "/" ? [] : undefined)
      }
    }),
    react()
  ]
})
