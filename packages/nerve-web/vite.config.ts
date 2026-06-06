import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"

export default defineConfig({
  plugins: [
    // Must come before react() per TanStack Router docs.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react()
  ]
})
