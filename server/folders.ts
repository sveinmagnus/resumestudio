/**
 * Filesystem folder browser for the desktop Settings screen, so the backup/sync
 * folder can be picked by navigating rather than pasting an absolute path.
 *
 * The browser UI can't read the local filesystem, so the (local, auth-gated,
 * desktop-only) server enumerates immediate SUBDIRECTORIES of a given folder for
 * it — the equivalent of a native folder dialog, done over the app's own API.
 *
 * DESKTOP-ONLY by policy: this reveals the local directory tree, which is fine
 * on a machine the signed-in user operates but must never be reachable on the
 * shared VPS build (the route 403s there). It makes no outbound requests and
 * touches nothing but directory names, so there's no SSRF/traversal surface —
 * the user already owns every path it can reach.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

export interface FolderEntry { name: string; path: string }

export interface FolderListing {
  /** The resolved absolute path being listed. */
  path: string
  /** The parent directory, or null at a filesystem/drive root. */
  parent: string | null
  /** The user's home directory (a "Home" shortcut for the UI). */
  home: string
  /** The platform path separator, so the UI can render paths natively. */
  sep: string
  /** Immediate subdirectories, sorted case-insensitively. */
  entries: FolderEntry[]
}

/** Raised for a folder listing failure; carries a safe HTTP status. */
export class FolderError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'FolderError'
  }
}

/**
 * List the immediate subdirectories of `dir` (defaults to the user's home).
 * Only directories are returned — files are irrelevant when choosing a folder.
 * Entries that can't be stat'd (permission, broken symlink) are skipped, never
 * fatal, so one unreadable child doesn't blank the whole listing.
 */
export function listFolders(dir?: string): FolderListing {
  const home = os.homedir()
  const target = dir && dir.trim() ? path.resolve(dir) : home

  let stat: fs.Stats
  try {
    stat = fs.statSync(target)
  } catch {
    throw new FolderError(404, 'That folder no longer exists.')
  }
  if (!stat.isDirectory()) throw new FolderError(400, 'That path is not a folder.')

  let dirents: fs.Dirent[]
  try {
    dirents = fs.readdirSync(target, { withFileTypes: true })
  } catch {
    throw new FolderError(403, 'That folder is not readable.')
  }

  const entries: FolderEntry[] = dirents
    .filter((d) => {
      try {
        if (d.isDirectory()) return true
        // Follow symlinks that point at a directory (common for cloud folders).
        return d.isSymbolicLink() && fs.statSync(path.join(target, d.name)).isDirectory()
      } catch {
        return false
      }
    })
    .map((d) => ({ name: d.name, path: path.join(target, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const parentPath = path.dirname(target)
  const parent = parentPath === target ? null : parentPath
  return { path: target, parent, home, sep: path.sep, entries }
}
