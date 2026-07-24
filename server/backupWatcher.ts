/**
 * Inbound store-backup watcher for the desktop build — the read-side mirror of
 * `BackupScheduler`.
 *
 * The boot restore in the launcher pulls newer edits from the sync folder ONCE,
 * at startup. But the normal way this app runs is a server left open in the
 * background for days: launches are rare, so a launch-only restore means edits
 * a *sync service* drops into the folder (from another machine) never land here
 * until the next restart. This watcher closes that gap — it re-runs the same
 * non-destructive merge whenever the backup file changes on disk.
 *
 * Detection is deliberately HYBRID:
 *  - `fs.watch` on the folder gives a near-immediate reaction when it fires, but
 *    it is unreliable exactly where this feature lives — Drive/Dropbox/OneDrive
 *    and network shares frequently deliver a synced file without emitting a
 *    usable event (or emit a burst mid-write).
 *  - a periodic mtime poll is the correctness guarantee: even if every watch
 *    event is missed, the next tick notices the changed mtime and merges.
 * The watch is thus a latency optimisation layered over a poll that is always
 * right within one interval.
 *
 * Feedback-loop guard: our own `BackupScheduler` writes this same file, which
 * would otherwise trip the watcher. Before merging, the watcher compares the
 * file's content signature to the LIVE DB signature; when they match (our own
 * write, or data we already merged) it does nothing. Only a file that carries
 * state the DB doesn't reflect triggers a restore.
 *
 * Errors are logged, never thrown — a failing read (e.g. a half-written file
 * caught mid-sync) must not take down the editor; the next tick retries.
 */

import fs from 'fs'
import path from 'path'
import { BACKUP_FILENAME, backupSignature, readStoreBackup, UnreadableBackupError } from './backup.js'
import type { ResumeDb } from './db.js'

export interface BackupWatcherOptions {
  db: ResumeDb
  /** Sync folder holding the backup file (e.g. a Google Drive path). */
  dir: string
  /** Poll-backstop interval in ms. Default 60s. */
  intervalMs?: number
  /** Diagnostic sink — defaults to console.log. */
  log?: (msg: string) => void
  /** Called after a merge that actually changed the DB (inserted/updated > 0). */
  onMerged?: (summary: { inserted: number; updated: number; registry: { added: number; updated: number } }) => void
}

/** Debounce window for coalescing an fs.watch event burst before checking. */
const WATCH_DEBOUNCE_MS = 750

export class BackupWatcher {
  private readonly db: ResumeDb
  private readonly dir: string
  private readonly file: string
  private readonly intervalMs: number
  private readonly log: (msg: string) => void
  private readonly onMerged?: BackupWatcherOptions['onMerged']
  private timer: NodeJS.Timeout | null = null
  private watcher: fs.FSWatcher | null = null
  private debounce: NodeJS.Timeout | null = null
  /** mtime (ms) of the last file we successfully read — the poll's change gate. */
  private lastMtimeMs = 0

  constructor(opts: BackupWatcherOptions) {
    this.db = opts.db
    this.dir = opts.dir
    this.file = path.join(opts.dir, BACKUP_FILENAME)
    this.intervalMs = opts.intervalMs ?? 60_000
    this.log = opts.log ?? ((m) => console.log(m))
    this.onMerged = opts.onMerged
  }

  /**
   * Begin watching + polling. Seeds `lastMtimeMs` from the file already present
   * so the first tick doesn't redundantly re-merge what the launcher's boot
   * restore just applied — only a CHANGE from here on triggers work.
   */
  start(): void {
    if (this.timer || this.watcher) return
    try {
      const st = fs.statSync(this.file)
      this.lastMtimeMs = st.mtimeMs
    } catch {
      // No file yet (first run on this sync folder) — leave the gate at 0 so the
      // first file that appears is picked up.
      this.lastMtimeMs = 0
    }

    // Poll backstop.
    this.timer = setInterval(() => this.check(), this.intervalMs)
    this.timer.unref?.() // don't keep the process alive just for the watcher

    // Low-latency layer. Watch the FOLDER, not the file: a sync client (and our
    // own atomic write) replaces the file via rename, which detaches a
    // file-level watch from the new inode; a folder watch survives it.
    try {
      this.watcher = fs.watch(this.dir, (_event, filename) => {
        // filename can be null on some platforms — treat that as "something in
        // the folder changed" and check anyway.
        if (filename === null || filename === BACKUP_FILENAME) this.scheduleCheck()
      })
      this.watcher.on('error', (err) => {
        // A watch error (folder removed, FS doesn't support it) must not be
        // fatal — the poll keeps correctness. Drop the watcher and log once.
        this.log(`[backup-watch] fs.watch error, falling back to polling: ${(err as Error).message}`)
        try { this.watcher?.close() } catch { /* ignore */ }
        this.watcher = null
      })
    } catch (err) {
      this.log(`[backup-watch] fs.watch unavailable, polling only: ${(err as Error).message}`)
      this.watcher = null
    }
  }

  /** Debounce a burst of watch events into a single check. */
  private scheduleCheck(): void {
    if (this.debounce) clearTimeout(this.debounce)
    this.debounce = setTimeout(() => {
      this.debounce = null
      this.check()
    }, WATCH_DEBOUNCE_MS)
    this.debounce.unref?.()
  }

  /**
   * Merge the file into the DB IFF it changed on disk AND carries state the DB
   * doesn't already reflect. Cheap-exits on an unchanged mtime so an idle app
   * does almost no work.
   */
  private check(): void {
    let mtimeMs: number
    try {
      mtimeMs = fs.statSync(this.file).mtimeMs
    } catch {
      return // file absent — nothing to do
    }
    if (mtimeMs === this.lastMtimeMs) return

    let parsed: { resumes: ReturnType<ResumeDb['dumpResumes']>; registry: Parameters<ResumeDb['mergeRegistry']>[0] } | null
    try {
      parsed = readStoreBackup(this.dir)
    } catch (err) {
      // A half-written / foreign file: log and DON'T advance the mtime gate, so
      // the next tick retries once the sync client finishes writing.
      const why = err instanceof UnreadableBackupError ? err.message : (err as Error).message
      this.log(`[backup-watch] skipped unreadable file (will retry): ${why}`)
      return
    }
    if (!parsed) return

    // Successful read — commit the gate so we don't re-read the same file.
    this.lastMtimeMs = mtimeMs

    // Feedback-loop guard: if the file already matches the live store (our own
    // BackupScheduler write, or data we merged earlier), there's nothing to pull.
    const localSig = backupSignature(this.db.dumpResumes())
    if (backupSignature(parsed.resumes) === localSig) return

    try {
      const summary = this.db.restoreResumes(parsed.resumes) // merge mode: newest-wins, no deletes
      const registry = this.db.mergeRegistry(parsed.registry)
      const changed = summary.inserted + summary.updated
      if (changed > 0 || registry.added + registry.updated > 0) {
        this.log(
          `[backup-watch] merged from sync folder: +${summary.inserted} new, ` +
          `${summary.updated} updated, ${summary.skipped} already current; ` +
          `registry +${registry.added}/${registry.updated}`,
        )
        if (changed > 0) this.onMerged?.({ inserted: summary.inserted, updated: summary.updated, registry })
      }
    } catch (err) {
      this.log(`[backup-watch] merge failed: ${(err as Error).message}`)
    }
  }

  stop(): void {
    if (this.debounce) { clearTimeout(this.debounce); this.debounce = null }
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    if (this.watcher) {
      try { this.watcher.close() } catch { /* ignore */ }
      this.watcher = null
    }
  }
}
