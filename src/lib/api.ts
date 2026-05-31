import type { ResumeStore } from '../types'

// ─── Auth token (session-scoped) ──────────────────────────────────────────────

const TOKEN_KEY = 'resumestudio-api-token'

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

// ─── Error types ──────────────────────────────────────────────────────────────

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized — API token required')
    this.name = 'UnauthorizedError'
  }
}

export class ServerError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ServerError'
  }
}

// ─── HTTP base ────────────────────────────────────────────────────────────────

async function request(
  method: string,
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = getStoredToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 401) throw new UnauthorizedError()
  return res
}

/**
 * True when the given error is a fetch abort (caller cancelled via
 * AbortController). Callers typically want to ignore these silently — an
 * abort means the work was superseded, not failed.
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const api = {
  /**
   * Check that the server is reachable. Returns true/false — never throws.
   * No auth required (health endpoint is always public).
   */
  async health(): Promise<boolean> {
    try {
      const res = await fetch('/api/health')
      return res.ok
    } catch {
      return false
    }
  },

  /**
   * Load the stored resume from the server.
   * Returns null if no resume has been saved yet (server returns 404).
   * Throws UnauthorizedError if the token is missing/wrong.
   */
  async load(): Promise<ResumeStore | null> {
    const res = await request('GET', '/api/resume')
    if (res.status === 404) return null
    if (!res.ok) throw new ServerError(res.status, `Load failed: ${res.statusText}`)
    const json = await res.json() as { data: ResumeStore }
    return json.data
  },

  /**
   * Persist the current store to the server.
   *
   * Pass an `AbortSignal` to cancel an in-flight save when a newer one fires —
   * the resulting AbortError can be detected with `isAbortError()` and is
   * typically not user-visible.
   *
   * Throws UnauthorizedError or ServerError on failure.
   */
  async save(data: ResumeStore, signal?: AbortSignal): Promise<void> {
    const res = await request('PUT', '/api/resume', data, signal)
    if (!res.ok) throw new ServerError(res.status, `Save failed: ${res.statusText}`)
  },

  // ── Snapshot history ────────────────────────────────────────────────────

  /**
   * List saved snapshots (newest first), metadata only — no resume payloads.
   * Throws UnauthorizedError on 401, ServerError otherwise.
   */
  async listSnapshots(): Promise<SnapshotMeta[]> {
    const res = await request('GET', '/api/resume/snapshots')
    if (!res.ok) throw new ServerError(res.status, `Could not list snapshots: ${res.statusText}`)
    const json = await res.json() as { snapshots: SnapshotMeta[] }
    return json.snapshots
  },

  /** Fetch one snapshot's full resume data by id. */
  async getSnapshot(id: number): Promise<ResumeStore> {
    const res = await request('GET', `/api/resume/snapshots/${id}`)
    if (!res.ok) throw new ServerError(res.status, `Could not load snapshot: ${res.statusText}`)
    const json = await res.json() as { data: ResumeStore }
    return json.data
  },

  // ── Translation assist ──────────────────────────────────────────────────

  /**
   * Whether the server has a LibreTranslate instance configured. Never
   * throws — returns false on any error so the UI just hides the feature.
   */
  async translateStatus(): Promise<boolean> {
    try {
      const res = await request('GET', '/api/translate/status')
      if (!res.ok) return false
      const json = await res.json() as { configured?: boolean }
      return json.configured === true
    } catch {
      return false
    }
  },

  /**
   * Draft-translate a single field. `source`/`target` are app locale codes
   * (e.g. 'en', 'no'). Throws ServerError with a user-safe message on failure.
   */
  async translate(text: string, source: string, target: string): Promise<string> {
    const res = await request('POST', '/api/translate', { text, source, target })
    if (!res.ok) {
      let message = `Translation failed (${res.status})`
      try {
        const json = await res.json() as { error?: string }
        if (json.error) message = json.error
      } catch { /* keep default */ }
      throw new ServerError(res.status, message)
    }
    const json = await res.json() as { translation: string }
    return json.translation
  },
}

export interface SnapshotMeta {
  id: number
  saved_at: string
  size: number
}
