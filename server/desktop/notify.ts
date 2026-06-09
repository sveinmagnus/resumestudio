/**
 * Best-effort native popup for the desktop build.
 *
 * The system tray has no browser context, so when the user clicks "Check for
 * updates" and is already up to date, there's nowhere to show the result. This
 * module pops a small OS-native message so a manual check always gives feedback:
 *
 *   Windows  PowerShell MessageBox (System.Windows.Forms — always present)
 *   macOS    osascript `display dialog`
 *   Linux    notify-send (libnotify; common on GNOME/KDE)
 *
 * Everything is best-effort and MUST NOT throw into the caller: the child is
 * detached + unref'd, and a missing helper (e.g. no notify-send) just means no
 * popup — the tray title still reflects the state. argv-only spawns (never a
 * shell string); the message/title are our own strings, but we escape them for
 * the embedded PowerShell/AppleScript literals anyway.
 */

import { spawn } from 'child_process'

export interface NotifyCommand {
  cmd: string
  args: string[]
}

/** Escape a string for a PowerShell single-quoted literal ('' = one quote). */
function psLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/** Escape a string for an AppleScript double-quoted literal. */
function asLiteral(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * The per-OS command to show a popup with `title`/`message`. Pure + exported so
 * the escaping is unit-tested without spawning anything. Single-line messages
 * only (avoids cross-platform newline-escaping quirks).
 */
export function buildNotifyCommand(
  title: string,
  message: string,
  platform: NodeJS.Platform = process.platform,
): NotifyCommand {
  if (platform === 'win32') {
    const script =
      'Add-Type -AssemblyName System.Windows.Forms;' +
      `[void][System.Windows.Forms.MessageBox]::Show(${psLiteral(message)},${psLiteral(title)})`
    return {
      cmd: 'powershell',
      args: ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script],
    }
  }
  if (platform === 'darwin') {
    const script =
      `display dialog ${asLiteral(message)} with title ${asLiteral(title)} ` +
      'buttons {"OK"} default button "OK" with icon note'
    return { cmd: 'osascript', args: ['-e', script] }
  }
  // Linux / other POSIX — libnotify. Args are passed directly (no shell), so no
  // quoting needed; if notify-send is absent the spawn 'error' is swallowed.
  return { cmd: 'notify-send', args: [title, message] }
}

/**
 * Show a native popup, best-effort. Never throws; logs nothing on failure
 * (the optional `onError` lets the caller note it if desired).
 */
export function notify(
  title: string,
  message: string,
  onError?: (msg: string) => void,
): void {
  try {
    const { cmd, args } = buildNotifyCommand(title, message)
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.on('error', (err) => onError?.(`notify unavailable: ${err.message}`))
    child.unref()
  } catch (err) {
    onError?.(`notify failed: ${(err as Error).message}`)
  }
}
