import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH  = path.join(DATA_DIR, 'resume.db')

// Ensure the data directory exists before opening the database
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent-read performance
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS resume_store (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    data     TEXT    NOT NULL,
    saved_at TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS resume_snapshots (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    data     TEXT    NOT NULL,
    saved_at TEXT    NOT NULL
  );
`)

/** How many recent snapshots to retain. Older ones are pruned on each save. */
const MAX_SNAPSHOTS = 50

export interface StoredRow {
  data: string
  saved_at: string
}

export interface SnapshotMeta {
  id: number
  saved_at: string
  size: number
}

/** Return the stored resume JSON, or null if nothing has been saved yet. */
export function getResume(): Record<string, unknown> | null {
  const row = db
    .prepare('SELECT data FROM resume_store WHERE id = 1')
    .get() as StoredRow | undefined
  if (!row) return null
  return JSON.parse(row.data) as Record<string, unknown>
}

// Prepared statements reused by the save transaction.
const upsertMain = db.prepare(`
  INSERT INTO resume_store (id, data, saved_at)
  VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at
`)
const lastSnapshotData = db.prepare(
  'SELECT data FROM resume_snapshots ORDER BY id DESC LIMIT 1',
)
const insertSnapshot = db.prepare('INSERT INTO resume_snapshots (data, saved_at) VALUES (?, ?)')
const pruneSnapshots = db.prepare(`
  DELETE FROM resume_snapshots
  WHERE id NOT IN (SELECT id FROM resume_snapshots ORDER BY id DESC LIMIT ?)
`)

/**
 * Persist the resume JSON, replacing the single stored row, and append a
 * snapshot for restore-history. Runs in a transaction so the live row and the
 * snapshot log never diverge. A snapshot identical to the most recent one is
 * skipped (de-dup), and the log is pruned to the newest MAX_SNAPSHOTS entries.
 */
export function saveResume(data: unknown): string {
  const saved_at = new Date().toISOString()
  const json = JSON.stringify(data)

  const tx = db.transaction(() => {
    upsertMain.run(json, saved_at)
    const last = lastSnapshotData.get() as { data: string } | undefined
    if (!last || last.data !== json) {
      insertSnapshot.run(json, saved_at)
      pruneSnapshots.run(MAX_SNAPSHOTS)
    }
  })
  tx()
  return saved_at
}

/** List snapshots newest-first, metadata only (no payloads). */
export function listSnapshots(): SnapshotMeta[] {
  return db
    .prepare('SELECT id, saved_at, LENGTH(data) AS size FROM resume_snapshots ORDER BY id DESC')
    .all() as SnapshotMeta[]
}

/** Return one snapshot's parsed resume data, or null if the id is unknown. */
export function getSnapshot(id: number): Record<string, unknown> | null {
  const row = db
    .prepare('SELECT data FROM resume_snapshots WHERE id = ?')
    .get(id) as { data: string } | undefined
  if (!row) return null
  return JSON.parse(row.data) as Record<string, unknown>
}

/** Return the ISO timestamp of the last save, or null if nothing has been saved. */
export function getLastSavedAt(): string | null {
  const row = db
    .prepare('SELECT saved_at FROM resume_store WHERE id = 1')
    .get() as StoredRow | undefined
  return row?.saved_at ?? null
}
