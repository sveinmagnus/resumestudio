/**
 * Local-first persistence — writes the store to localStorage every time the
 * user mutates data, so a server outage (or a closed laptop) never costs work.
 *
 * The cache is a fallback, not the source of truth: on app start the server
 * is queried first; the cache is only consulted if the server returned no
 * data OR was unreachable. When a fresh server load succeeds we replace the
 * cache with the server's copy so the two stay in sync.
 *
 * ~5 MB localStorage quota is comfortable for a typical resume (well under
 * 100 KB JSON). If the quota is ever exceeded we log and continue — losing
 * the local cache is non-fatal.
 */

import type { ResumeStore } from '../types'

const KEY = 'resumestudio:store-cache:v1'
const META_KEY = 'resumestudio:store-cache:meta:v1'

interface CacheMeta {
  saved_at: string
}

/** Read the cached store from localStorage, or null if none/invalid. */
export function loadCache(): { data: ResumeStore; saved_at: string } | null {
  try {
    const raw  = localStorage.getItem(KEY)
    const meta = localStorage.getItem(META_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as ResumeStore
    const m    = meta ? (JSON.parse(meta) as CacheMeta) : { saved_at: new Date(0).toISOString() }
    return { data, saved_at: m.saved_at }
  } catch (err) {
    console.warn('[localCache] could not read cache, ignoring:', err)
    return null
  }
}

/** Write the store + a timestamp. Failures are logged and swallowed. */
export function saveCache(data: ResumeStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    localStorage.setItem(META_KEY, JSON.stringify({ saved_at: new Date().toISOString() } satisfies CacheMeta))
  } catch (err) {
    // Quota exceeded or storage disabled (private mode in some browsers).
    // Not fatal — the user just loses the local fallback for this session.
    console.warn('[localCache] could not write cache:', err)
  }
}

/** Drop both entries — call after a successful server sync of a stale cache. */
export function clearCache(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(META_KEY)
  } catch {
    // ignore
  }
}
