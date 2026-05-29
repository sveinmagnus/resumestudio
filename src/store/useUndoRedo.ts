/**
 * Undo/redo on top of the resume store.
 *
 * Strategy: subscribe to the store's mutationCount. Each increment is a user
 * mutation — debounce 500ms and push a snapshot of `data` to the past stack.
 * The debounce groups bursts of activity (rapid typing) into single undo
 * steps. Undo pops the past, snaps current to future, and replays via
 * `loadStore`. Redo is symmetric.
 *
 * History is stored in module scope rather than React state because:
 *   - It's append-mostly, so re-rendering on every push wastes work
 *   - The keyboard handler only needs the latest snapshot, not deps tracking
 *
 * A small React state slot (canUndo/canRedo) drives UI affordances.
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from './useStore'
import type { ResumeStore } from '../types'

const DEBOUNCE_MS = 500
const MAX_HISTORY = 100  // cap so memory doesn't grow forever

export function useUndoRedo(): {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
} {
  const past   = useRef<ResumeStore[]>([])
  const future = useRef<ResumeStore[]>([])

  // When we restore a snapshot via loadStore the subscription would otherwise
  // record THAT as a fresh mutation and re-push it. This ref tells the
  // subscriber to skip the next change.
  const suppressNext = useRef(false)

  // The snapshot we'll push if no further mutation arrives within DEBOUNCE_MS.
  const pendingSnapshot = useRef<ResumeStore | null>(null)
  const pendingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Subscribe to mutation-count changes — these mark a user mutation.
  useEffect(() => {
    let prevMutation = useStore.getState().mutationCount
    let prevData     = useStore.getState().data

    const unsub = useStore.subscribe((st) => {
      const advanced = st.mutationCount > prevMutation
      const dataToPush = prevData
      prevMutation = st.mutationCount
      prevData     = st.data

      if (!advanced) return
      if (suppressNext.current) { suppressNext.current = false; return }

      // Push a snapshot of the PRE-MUTATION data so that undo returns to it.
      pendingSnapshot.current = dataToPush
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      pendingTimer.current = setTimeout(() => {
        if (!pendingSnapshot.current) return
        past.current.push(pendingSnapshot.current)
        if (past.current.length > MAX_HISTORY) past.current.shift()
        future.current = []
        pendingSnapshot.current = null
        setCanUndo(past.current.length > 0)
        setCanRedo(false)
      }, DEBOUNCE_MS)
    })
    return () => {
      unsub()
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    }
  }, [])

  const undo = () => {
    // Flush any pending debounce so this undo step has a coherent target.
    if (pendingTimer.current) { clearTimeout(pendingTimer.current); pendingTimer.current = null }
    if (pendingSnapshot.current) {
      past.current.push(pendingSnapshot.current)
      pendingSnapshot.current = null
    }
    const snapshot = past.current.pop()
    if (!snapshot) return
    future.current.push(useStore.getState().data)
    suppressNext.current = true
    useStore.getState().loadStore(snapshot)
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }

  const redo = () => {
    if (pendingTimer.current) { clearTimeout(pendingTimer.current); pendingTimer.current = null }
    const snapshot = future.current.pop()
    if (!snapshot) return
    past.current.push(useStore.getState().data)
    suppressNext.current = true
    useStore.getState().loadStore(snapshot)
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }

  // Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' || e.key === 'Z') {
        // Skip if focus is in an input/textarea AND it's not the resume editor —
        // actually, in this app every interaction IS an editor, so we always
        // own undo. The native input undo gets superseded, which is the
        // intended UX (undo the resume, not the textarea).
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // undo/redo are stable closures over refs — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { undo, redo, canUndo, canRedo }
}
