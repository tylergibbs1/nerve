/**
 * `nerve dev` (PRD §9.7 DX tier): watch → recompile → live browser preview.
 *
 * One-way disk → browser: the watcher recompiles via compileFile with the
 * module cache bypassed (the compiler's shared jiti instance caches — a
 * watch loop over it would serve the first compile forever), re-renders
 * the self-contained html.ts viewers, and the page reloads itself when
 * /state.json reports a new HIR fingerprint. Compile failures keep the
 * last good drawing on screen with the error in the header and terminal.
 *
 * No bundler, no websocket stack, no bidirectional sync — the viewers are
 * complete documents already; a 1s fingerprint poll is plenty.
 */
import { createServer, type Server } from "node:http"
import { watch, type FSWatcher } from "node:fs"
import { dirname, resolve } from "node:path"
import { Cause, Effect, Exit } from "effect"
import type { Diagnostic } from "@grayhaven/nerve"
import { compileFile } from "@grayhaven/nerve-compiler"
import { boardHtml, facesHtml, hirFingerprint, pinoutHtml, schematicHtml } from "@grayhaven/nerve-exporters"

export interface DevIo {
  out(line: string): void
  err(line: string): void
}

export interface DevServer {
  readonly port: number
  readonly url: string
  /** Recompile + re-render now (the watcher calls this on change). */
  rebuild(): Promise<void>
  close(): Promise<void>
}

interface DevState {
  fingerprint: string
  errors: number
  warnings: number
  /** Set when the last compile failed (the previous good render stays up). */
  compileError?: string
}

const POLL_SCRIPT = `
<script>
(() => {
  let last;
  const tick = async () => {
    try {
      const s = await (await fetch("/state.json")).json();
      if (last !== undefined && s.fingerprint !== last) { location.reload(); return; }
      last = s.fingerprint;
      const el = document.getElementById("dev-status");
      if (el) el.textContent = s.compileError ? "compile error — showing last good render" : s.errors + " error(s) · " + s.warnings + " warning(s)";
    } catch {}
    setTimeout(tick, 1000);
  };
  tick();
})();
</script>`

const STATUS_BADGE = `<div id="dev-status" style="position:fixed;right:10px;top:6px;font-size:11px;color:#555;"></div>`

const inject = (html: string): string =>
  html.replace("</body>", `${STATUS_BADGE}${POLL_SCRIPT}\n</body>`)

const printDiagnostics = (diagnostics: ReadonlyArray<Diagnostic>, io: DevIo): void => {
  for (const d of diagnostics) {
    const line = `${d.code} ${d.severity}${d.target !== undefined ? `  ${d.target}` : ""}  ${d.message}`
    ;(d.severity === "error" ? io.err : io.out)(line)
  }
}

export const startDev = async (
  file: string,
  options: { readonly port?: number; readonly io: DevIo }
): Promise<DevServer> => {
  const io = options.io
  const entry = resolve(file)
  const pages = new Map<string, string>()
  const state: DevState = { fingerprint: "", errors: 0, warnings: 0 }

  const rebuild = async (): Promise<void> => {
    const started = Date.now()
    const exit = await Effect.runPromiseExit(compileFile(entry, { fresh: true }))
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      state.compileError =
        failure._tag === "Some" ? failure.value.message : Cause.pretty(exit.cause)
      io.err(`compile failed: ${state.compileError}`)
      return
    }
    delete state.compileError
    const { hir, diagnostics } = exit.value
    printDiagnostics(diagnostics, io)
    pages.set("/", inject(schematicHtml(hir)))
    pages.set("/board", inject(boardHtml(hir)))
    pages.set("/faces", inject(facesHtml(hir)))
    pages.set("/pinout", inject(pinoutHtml(hir)))
    state.fingerprint = hirFingerprint(hir)
    state.errors = diagnostics.filter((d) => d.severity === "error").length
    state.warnings = diagnostics.filter((d) => d.severity === "warning").length
    io.out(
      `compiled ${hir.harness.id} rev ${hir.harness.revision} in ${Date.now() - started}ms — ${state.errors} error(s), ${state.warnings} warning(s)`
    )
  }

  await rebuild()

  const server: Server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0]!
    if (path === "/state.json") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
      res.end(JSON.stringify(state))
      return
    }
    const page = pages.get(path === "/schematic" ? "/" : path)
    if (page !== undefined) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
      res.end(page)
      return
    }
    res.writeHead(404, { "content-type": "text/plain" })
    res.end("nerve dev: /, /board, /faces, /pinout, /state.json")
  })

  await new Promise<void>((resolveListen) =>
    server.listen(options.port ?? 4477, () => resolveListen())
  )
  const address = server.address()
  const port = typeof address === "object" && address !== null ? address.port : (options.port ?? 4477)

  // Watch the harness file's tree; debounce bursts (editors write twice).
  let timer: ReturnType<typeof setTimeout> | undefined
  let building = false
  let dirty = false
  const schedule = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (building) {
        dirty = true
        return
      }
      building = true
      void rebuild().finally(() => {
        building = false
        if (dirty) {
          dirty = false
          schedule()
        }
      })
    }, 120)
  }
  const watcher: FSWatcher = watch(dirname(entry), { recursive: true }, (_event, name) => {
    if (name === null || /\.(ts|tsx|json)$/.test(name)) schedule()
  })

  return {
    port,
    url: `http://localhost:${port}`,
    rebuild,
    close: () =>
      new Promise<void>((resolveClose) => {
        clearTimeout(timer)
        watcher.close()
        server.close(() => resolveClose())
      })
  }
}
