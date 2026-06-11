/**
 * PURE: payload-weight classification + byte formatting for the storage
 * readout (roadmap A4). The thresholds exist because a resume's full JSON —
 * including embedded base64 images — rides on every debounced auto-save PUT
 * and is mirrored into a localStorage pending record, and browsers cap
 * localStorage around 5 MB per origin: a couple of heavy resumes with dirty
 * records could hit quota and silently break the offline queue.
 */

/** Server shape from GET /api/resumes/storage (see server/db.ts StorageStats). */
export interface ResumeStorageStats {
  id: string
  name: string
  /** UTF-8 size of the live data JSON. */
  bytes: number
  /** Share of `bytes` held by embedded base64 images. */
  image_bytes: number
  snapshot_count: number
  snapshot_bytes: number
}

export interface StorageStats {
  db_bytes: number
  resumes: ResumeStorageStats[]
}

/** Above this a resume is flagged as heavy (every save re-sends all of it). */
export const LARGE_RESUME_BYTES = 1_000_000
/** Above this the offline queue is at real localStorage-quota risk (~5 MB/origin). */
export const RISK_RESUME_BYTES = 2_500_000

export type WeightLevel = 'ok' | 'large' | 'risk'

export function weightLevel(bytes: number): WeightLevel {
  if (bytes >= RISK_RESUME_BYTES) return 'risk'
  if (bytes >= LARGE_RESUME_BYTES) return 'large'
  return 'ok'
}

/** Human-readable byte count: 412 B / 87 kB / 2.3 MB. */
export function fmtBytes(n: number): string {
  if (n < 1_000) return `${n} B`
  if (n < 1_000_000) return `${Math.round(n / 1_000)} kB`
  return `${(n / 1_000_000).toFixed(1)} MB`
}
