/**
 * Build-time shim for Node builtins pulled in by @anthropic-ai/sdk's
 * managed-agents helpers (agent-toolset, credential chain). Those code
 * paths never execute in the browser — we construct the client with an
 * explicit apiKey — but rollup still needs the named exports to resolve.
 */
const unavailable = (name: string) => () => {
  throw new Error(`node:${name} is not available in the browser`)
}

// node:crypto — randomUUID actually works; map to Web Crypto.
export const randomUUID = () => globalThis.crypto.randomUUID()
export const createHash = unavailable("crypto.createHash")
export const createHmac = unavailable("crypto.createHmac")
export const timingSafeEqual = unavailable("crypto.timingSafeEqual")

// node:child_process
export const execFile = unavailable("child_process.execFile")
export const spawn = unavailable("child_process.spawn")
export const exec = unavailable("child_process.exec")

// node:util
export const promisify = unavailable("util.promisify")

// node:stream
export const Readable = class {
  static fromWeb = unavailable("stream.Readable.fromWeb")
}
export const pipeline = unavailable("stream.pipeline")

// node:fs / node:fs/promises / node:path / node:readline (namespace imports)
export const readFile = unavailable("fs.readFile")
export const writeFile = unavailable("fs.writeFile")
export const readFileSync = unavailable("fs.readFileSync")
export const existsSync = () => false
export const join = unavailable("path.join")
export const resolve = unavailable("path.resolve")
export const homedir = unavailable("os.homedir")
export const createInterface = unavailable("readline.createInterface")

export default {}
