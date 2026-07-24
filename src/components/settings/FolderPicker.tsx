/**
 * A navigate-and-pick folder chooser for the backup/sync setting (desktop only).
 *
 * The browser can't open a native folder dialog against the local disk, so this
 * drives the server's `/api/settings/folders` browse endpoint: it shows the
 * current folder, its parent, and its subfolders, and descends on click. The
 * paste-a-path input stays in SyncTab as the fast path; this is the "I don't
 * remember the exact path" path. "Use this folder" hands the current directory
 * back to the caller.
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, FolderOpen, Folder, ArrowUp, Home, Check, X, AlertCircle } from 'lucide-react'
import { api, type FolderListing } from '../../lib/api'

interface FolderPickerProps {
  /** The currently-configured path, used as the starting folder (else Home). */
  initialPath: string
  onSelect: (path: string) => void
  onClose: () => void
}

export function FolderPicker({ initialPath, onSelect, onClose }: FolderPickerProps) {
  const [listing, setListing] = useState<FolderListing | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (path?: string) => {
    setBusy(true); setError(null)
    try {
      setListing(await api.browseFolders(path))
    } catch (err) {
      // A saved path that no longer resolves shouldn't dead-end the picker —
      // fall back to Home so the user can still navigate from somewhere.
      if (path) {
        try { setListing(await api.browseFolders('')); return }
        catch { /* fall through to the error below */ }
      }
      setError((err as Error).message || 'Could not list that folder.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { void load(initialPath || undefined) }, [load, initialPath])

  return (
    <div className="fp" role="group" aria-label="Choose a folder">
      <style>{`
        .fp { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper-sunken); margin-top: 8px; }
        .fp-bar { display: flex; align-items: center; gap: 6px; padding: 8px; border-bottom: 1px solid var(--line); }
        .fp-path { flex: 1; min-width: 0; font-size: 12px; color: var(--ink-soft); overflow-wrap: anywhere; }
        .fp-list { max-height: 240px; overflow-y: auto; padding: 4px; }
        .fp-row { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
          padding: 7px 8px; border: 0; background: none; border-radius: var(--r-sm); cursor: pointer;
          color: var(--ink); font-size: 13px; }
        .fp-row:hover { background: var(--accent-wash); }
        .fp-row svg { color: var(--secondary-ink); flex: none; }
        .fp-empty, .fp-err { padding: 12px; font-size: 12px; color: var(--ink-soft); }
        .fp-err { color: var(--warn-ink); display: flex; align-items: center; gap: 6px; }
        .fp-foot { display: flex; align-items: center; gap: 8px; padding: 8px; border-top: 1px solid var(--line); }
        .fp-spacer { flex: 1; }
      `}</style>

      <div className="fp-bar">
        <button type="button" className="sm-btn sm-btn-icon" title="Home folder"
          aria-label="Home folder" disabled={busy} onClick={() => void load('')}>
          <Home size={14} />
        </button>
        <button type="button" className="sm-btn sm-btn-icon" title="Up one level"
          aria-label="Up one level" disabled={busy || !listing?.parent}
          onClick={() => listing?.parent && void load(listing.parent)}>
          <ArrowUp size={14} />
        </button>
        <span className="fp-path" aria-live="polite">
          {busy ? 'Loading…' : (listing?.path ?? '')}
        </span>
      </div>

      <div className="fp-list">
        {error && <div className="fp-err"><AlertCircle size={14} /> {error}</div>}
        {!error && listing && listing.entries.length === 0 && !busy && (
          <div className="fp-empty">No subfolders here. Use “Use this folder” to pick it.</div>
        )}
        {!error && listing?.entries.map((e) => (
          <button type="button" key={e.path} className="fp-row" onClick={() => void load(e.path)}>
            <Folder size={15} /> {e.name}
          </button>
        ))}
      </div>

      <div className="fp-foot">
        <button type="button" className="sm-btn" disabled={busy || !listing}
          onClick={() => { if (listing) { onSelect(listing.path); onClose() } }}>
          {busy ? <Loader2 size={13} className="sm-spin" /> : <Check size={13} />} Use this folder
        </button>
        <FolderOpen size={13} style={{ color: 'var(--ink-faint)' }} />
        <span className="fp-spacer" />
        <button type="button" className="sm-btn" onClick={onClose}>
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  )
}
