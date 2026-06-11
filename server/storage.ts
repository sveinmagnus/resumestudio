/**
 * Storage measurement helpers — roadmap A4's "measure first" step. Pure string
 * math over the stored JSON (no DB access) so the weights are unit-testable;
 * `db.ts → storageStats()` feeds it each resume row.
 */

export interface PayloadStats {
  /** UTF-8 size of the stored JSON. */
  bytes: number
  /** Bytes consumed by embedded base64 image data-URLs (profile photo, logo, per-view overrides). */
  image_bytes: number
}

// Embedded image data-URLs inside JSON text. Base64 never contains a quote,
// so a match always terminates at the JSON string boundary; data-URLs of other
// media types are deliberately not counted (only images are embedded today).
const IMAGE_DATA_URL_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]*/g

/** Measure one resume's stored JSON: total UTF-8 bytes + the share held by embedded images. */
export function payloadStats(json: string): PayloadStats {
  const bytes = Buffer.byteLength(json, 'utf8')
  let image_bytes = 0
  for (const m of json.matchAll(IMAGE_DATA_URL_RE)) image_bytes += m[0].length
  return { bytes, image_bytes }
}
