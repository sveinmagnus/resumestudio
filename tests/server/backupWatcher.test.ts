import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { BackupWatcher } from '../../server/backupWatcher'
import { BACKUP_FILENAME, buildStoreBackup, writeBackupAtomic } from '../../server/backup'
import { createResumeDb, type ResumeBackupEntry, type ResumeDb } from '../../server/db'

const entry = (over: Partial<ResumeBackupEntry> = {}): ResumeBackupEntry => ({
  id: 'r1',
  name: 'CV',
  primary_locale: 'en',
  secondary_locale: null,
  saved_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  data: { resume: { full_name: 'Ada' } },
  ...over,
})

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rs-bw-'))
const rmQuiet = (d: string) => { try { fs.rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ } }

/** Write the backup file and force a distinct mtime so the poll's mtime gate is
 *  deterministic regardless of filesystem timestamp resolution. */
function putFile(dir: string, entries: ResumeBackupEntry[], mtime: Date): void {
  writeBackupAtomic(dir, buildStoreBackup(entries))
  const file = path.join(dir, BACKUP_FILENAME)
  fs.utimesSync(file, mtime, mtime)
}

const INTERVAL = 10_000
/** Advance past one poll interval to fire the backstop `check()`. */
const pollOnce = () => vi.advanceTimersByTime(INTERVAL + 1)

describe('BackupWatcher', () => {
  let dir: string
  let db: ResumeDb
  let logs: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    dir = tmp()
    db = createResumeDb(':memory:')
    logs = []
  })

  afterEach(() => {
    vi.useRealTimers()
    db.close()
    rmQuiet(dir)
  })

  const make = () => new BackupWatcher({
    db, dir, intervalMs: INTERVAL, log: (m) => logs.push(m),
  })

  it('merges newer external edits picked up on the poll backstop', () => {
    db.restoreResumes([entry({ saved_at: '2026-01-01T00:00:00.000Z' })]) // seed r1 (old)
    const w = make()
    w.start() // no file yet → gate seeded at 0

    // A sync service drops a newer r1 + a brand-new r2 into the folder.
    putFile(dir, [
      entry({ saved_at: '2026-02-01T00:00:00.000Z', data: { resume: { full_name: 'Ada Lovelace' } } }),
      entry({ id: 'r2', saved_at: '2026-01-15T00:00:00.000Z' }),
    ], new Date('2027-01-01T00:00:00Z'))

    pollOnce()

    const byId = Object.fromEntries(db.dumpResumes().map((e) => [e.id, e]))
    expect(Object.keys(byId).sort()).toEqual(['r1', 'r2'])
    expect(byId.r1.saved_at).toBe('2026-02-01T00:00:00.000Z') // updated to newer
    expect(byId.r2).toBeTruthy()                              // inserted
    w.stop()
  })

  it('does nothing when the file already matches the live store (own-write guard)', () => {
    db.restoreResumes([entry()])
    const restoreSpy = vi.spyOn(db, 'restoreResumes')
    const w = make()
    w.start()

    // File carries the SAME signature the DB already has (as our own scheduler
    // would have written). Must not trigger a restore.
    putFile(dir, [entry()], new Date('2027-01-01T00:00:00Z'))
    pollOnce()

    expect(restoreSpy).not.toHaveBeenCalled()
    w.stop()
  })

  it('skips an unreadable (half-written) file without throwing, then merges once valid', () => {
    db.restoreResumes([entry()])
    const w = make()
    w.start()

    // A partial/garbage file — must be tolerated and retried, not fatal.
    const file = path.join(dir, BACKUP_FILENAME)
    fs.writeFileSync(file, '{ not json')
    fs.utimesSync(file, new Date('2027-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'))
    expect(() => pollOnce()).not.toThrow()
    expect(db.dumpResumes()[0].saved_at).toBe('2026-01-01T00:00:00.000Z') // unchanged
    expect(logs.some((l) => l.includes('unreadable'))).toBe(true)

    // Once the sync client finishes, a valid newer file merges on the next tick.
    // Distinct data so the newest-wins merge actually rewrites the row (an
    // identical-content restore is a deliberate no-op).
    putFile(dir, [entry({ saved_at: '2026-03-01T00:00:00.000Z', data: { resume: { full_name: 'Grace' } } })], new Date('2027-02-01T00:00:00Z'))
    pollOnce()
    expect(db.dumpResumes()[0].saved_at).toBe('2026-03-01T00:00:00.000Z')
    w.stop()
  })

  it('does not re-merge the file present at start (boot restore already ran)', () => {
    db.restoreResumes([entry()])
    // File already on disk BEFORE start, carrying newer data than the DB.
    putFile(dir, [entry({ saved_at: '2099-01-01T00:00:00.000Z' })], new Date('2027-01-01T00:00:00Z'))
    const restoreSpy = vi.spyOn(db, 'restoreResumes')
    const w = make()
    w.start() // seeds the mtime gate from the existing file

    pollOnce() // unchanged mtime → cheap-exit, no read/merge
    expect(restoreSpy).not.toHaveBeenCalled()
    w.stop()
  })

  it('stop() clears the poll timer', () => {
    db.restoreResumes([entry()])
    const w = make()
    w.start()
    w.stop()
    const restoreSpy = vi.spyOn(db, 'restoreResumes')
    putFile(dir, [entry({ saved_at: '2099-01-01T00:00:00.000Z' })], new Date('2027-01-01T00:00:00Z'))
    pollOnce()
    expect(restoreSpy).not.toHaveBeenCalled()
  })
})
