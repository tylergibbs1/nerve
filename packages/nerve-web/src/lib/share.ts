/**
 * Zero-backend share links (PRD §13 no-server posture): the harness source
 * gzips into the URL FRAGMENT — same URL, same bytes, same diagnostics, so
 * a share link IS a bug report. The fragment never reaches the server
 * (or Vercel logs); decoding happens entirely in the browser.
 *
 * Format: /shared#v1.<base64url(gzip(source))>  (~3-4KB for a real harness)
 */
import { gzipSync, gunzipSync, strFromU8, strToU8 } from "fflate"

const VERSION = "v1"

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const fromBase64Url = (text: string): Uint8Array => {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Source → fragment payload (without the leading '#'). */
export const encodeShareHash = (source: string): string =>
  `${VERSION}.${toBase64Url(gzipSync(strToU8(source), { level: 9, mtime: 0 }))}`

/** Fragment payload → source; undefined when malformed/unknown version. */
export const decodeShareHash = (hash: string): string | undefined => {
  const payload = hash.startsWith("#") ? hash.slice(1) : hash
  if (!payload.startsWith(`${VERSION}.`)) return undefined
  try {
    return strFromU8(gunzipSync(fromBase64Url(payload.slice(VERSION.length + 1))))
  } catch {
    return undefined
  }
}

/** Full share URL for a source string. */
export const shareUrl = (source: string): string =>
  `${window.location.origin}/shared#${encodeShareHash(source)}`
