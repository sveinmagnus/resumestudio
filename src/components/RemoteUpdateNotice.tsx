import { RefreshCw, X } from 'lucide-react'

/**
 * Shown when the open resume's server copy advanced past what this editor holds
 * while we have no unsynced local edits — i.e. a background sync (the desktop
 * BackupWatcher) merged newer edits from another device into this machine's DB.
 * Offers a one-click reload of the newer copy. Nothing is lost by ignoring it
 * (the editor keeps showing the older-but-consistent data); reloading just
 * pulls the fresher version in.
 *
 * Distinct from ConflictModal: that's for when WE also have local edits and a
 * save was refused. Here the editor is clean, so a plain reload is safe.
 */
export function RemoteUpdateNotice({
  show,
  onReload,
  onDismiss,
}: {
  show: boolean
  onReload: () => void
  onDismiss: () => void
}) {
  if (!show) return null
  return (
    <div className="run-bar" role="status">
      <RefreshCw size={15} className="run-icon" />
      <span className="run-text">
        This resume was <strong>updated on another device</strong> and synced here.
        Reload to see the latest version.
      </span>
      <button className="run-reload" onClick={onReload}>Reload</button>
      <button className="run-close" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>

      <style>{`
        .run-bar {
          display: flex; align-items: center; gap: 10px;
          margin: 12px 36px 0; padding: 10px 14px;
          background: var(--secondary-tint); border: 1px solid var(--secondary-line);
          border-radius: var(--r-md); animation: fadeUp .2s ease;
        }
        .run-icon { color: var(--secondary-ink-text); flex-shrink: 0; }
        .run-text { flex: 1; font-size: 13px; color: var(--ink); line-height: 1.5; }
        .run-reload {
          flex-shrink: 0; padding: 5px 12px; border-radius: var(--r-sm);
          background: var(--accent); color: #fff; font-size: 13px; font-weight: 500;
          transition: background .12s;
        }
        .run-reload:hover { background: var(--accent-bright); }
        .run-close {
          flex-shrink: 0; padding: 3px; border-radius: var(--r-sm);
          color: var(--secondary-ink-text); transition: background .12s;
        }
        .run-close:hover { background: #ffffff80; }
        @media (max-width: 880px) {
          .run-bar { margin: 10px 16px 0; }
        }
      `}</style>
    </div>
  )
}
