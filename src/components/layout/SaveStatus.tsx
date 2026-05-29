import { Check, CloudOff, Loader2, RefreshCw, HardDrive } from 'lucide-react'

export type SaveState =
  | 'idle'        // nothing to report
  | 'saving'      // server save in flight
  | 'saved'       // last server save succeeded
  | 'error'       // last server save failed; local cache holds the work
  | 'offline'     // initial server load failed; cache is the source of truth

interface Props {
  state: SaveState
  /** ISO timestamp of the last successful local cache write, for the tooltip. */
  cacheSavedAt?: string | null
  /** Retry the pending save (only shown when state === 'error'). */
  onRetry?: () => void
}

export function SaveStatus({ state, cacheSavedAt, onRetry }: Props) {
  if (state === 'idle') return null

  const cacheNote = cacheSavedAt
    ? `Local backup saved ${new Date(cacheSavedAt).toLocaleTimeString()}.`
    : 'Local backup is up to date.'

  if (state === 'saving') {
    return (
      <span className="ss ss-saving" title="Saving to server…">
        <Loader2 size={13} className="ss-spin" /> Saving…
        <Style />
      </span>
    )
  }

  if (state === 'saved') {
    return (
      <span className="ss ss-ok" title="Saved to server">
        <Check size={13} /> Saved
        <Style />
      </span>
    )
  }

  if (state === 'offline') {
    return (
      <span className="ss ss-warn" title={`Server unreachable. ${cacheNote}`}>
        <HardDrive size={13} /> Local only
        <Style />
      </span>
    )
  }

  // error
  return (
    <span className="ss ss-err" title={`Server save failed. ${cacheNote}`}>
      <CloudOff size={13} /> Save failed
      {onRetry && (
        <button className="ss-retry" onClick={onRetry} title="Retry save">
          <RefreshCw size={12} /> Retry
        </button>
      )}
      <Style />
    </span>
  )
}

function Style() {
  return (
    <style>{`
      .ss {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 12px; font-weight: 600;
        padding: 4px 9px; border-radius: 12px;
        animation: fadeIn .2s ease;
      }
      .ss-spin { animation: spin 1s linear infinite; }
      .ss-saving { color: var(--ink-soft); background: var(--paper-sunken); }
      .ss-ok     { color: #27ae60; background: #e8f7ef; }
      .ss-warn   { color: #b87900; background: #fff7e6; }
      .ss-err    { color: #c0392b; background: #fdf0ef; }
      .ss-retry {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 11px; font-weight: 700; color: #c0392b;
        text-decoration: underline; padding: 0 4px; margin-left: 4px;
      }
      .ss-retry:hover { color: #922b21; }
      @keyframes spin { to { transform: rotate(360deg) } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(2px) } to { opacity: 1; transform: none } }
    `}</style>
  )
}
