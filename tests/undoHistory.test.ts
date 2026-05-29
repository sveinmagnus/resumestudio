import { describe, it, expect } from 'vitest'
import { UndoHistory } from '../src/lib/undoHistory'

// Use plain strings as the snapshot type — the buffer is generic.

describe('UndoHistory — single steps', () => {
  it('starts empty: nothing to undo or redo', () => {
    const h = new UndoHistory<string>()
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(false)
    expect(h.undo('current')).toBeNull()
    expect(h.redo('current')).toBeNull()
  })

  it('records a committed mutation and undoes to the pre-mutation snapshot', () => {
    const h = new UndoHistory<string>()
    h.onMutation('A')   // state was "A" before the change to "B"
    h.commit()
    expect(h.canUndo).toBe(true)
    expect(h.undo('B')).toBe('A')   // restores "A", banks "B" for redo
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(true)
  })

  it('redo replays the undone state', () => {
    const h = new UndoHistory<string>()
    h.onMutation('A'); h.commit()
    h.undo('B')
    expect(h.redo('A')).toBe('B')
    expect(h.canRedo).toBe(false)
    expect(h.canUndo).toBe(true)
  })

  it('walks a multi-step chain A→B→C and back', () => {
    const h = new UndoHistory<string>()
    h.onMutation('A'); h.commit()   // A→B
    h.onMutation('B'); h.commit()   // B→C
    expect(h.undo('C')).toBe('B')
    expect(h.undo('B')).toBe('A')
    expect(h.undo('A')).toBeNull()  // exhausted
    expect(h.redo('A')).toBe('B')
    expect(h.redo('B')).toBe('C')
  })
})

describe('UndoHistory — burst capture (the regression this module exists for)', () => {
  it('collapses a burst into ONE step that reverts to the pre-burst snapshot', () => {
    const h = new UndoHistory<string>()
    // Type "H"→"He"→"Hel"→"Hell"→"Hello" as five mutations with NO commit
    // between them (a single debounce window).
    h.onMutation('')        // before "H"
    h.onMutation('H')       // before "He"  — ignored
    h.onMutation('He')      // before "Hel" — ignored
    h.onMutation('Hel')     // ignored
    h.onMutation('Hell')    // ignored
    h.commit()              // debounce elapses
    // One undo must revert the WHOLE burst back to "" — not just the last key.
    expect(h.undo('Hello')).toBe('')
    expect(h.canUndo).toBe(false)
  })

  it('hasPendingBurst reflects whether a snapshot is captured but unbanked', () => {
    const h = new UndoHistory<string>()
    expect(h.hasPendingBurst).toBe(false)
    h.onMutation('A')
    expect(h.hasPendingBurst).toBe(true)
    h.commit()
    expect(h.hasPendingBurst).toBe(false)
  })

  it('commit is a no-op when no burst is pending', () => {
    const h = new UndoHistory<string>()
    h.commit()
    expect(h.canUndo).toBe(false)
    // And calling commit twice after one burst banks exactly one entry.
    h.onMutation('A')
    h.commit()
    h.commit()
    expect(h.undo('B')).toBe('A')
    expect(h.undo('A')).toBeNull()   // only one entry was banked
  })

  it('separate bursts (commit between them) are separate undo steps', () => {
    const h = new UndoHistory<string>()
    h.onMutation('A'); h.commit()   // burst 1: A→B
    h.onMutation('B'); h.commit()   // burst 2: B→C
    expect(h.undo('C')).toBe('B')   // undo burst 2
    expect(h.undo('B')).toBe('A')   // undo burst 1
  })
})

describe('UndoHistory — redo invalidation', () => {
  it('a new committed mutation clears the redo stack', () => {
    const h = new UndoHistory<string>()
    h.onMutation('A'); h.commit()
    h.undo('B')                      // canRedo now true
    expect(h.canRedo).toBe(true)
    h.onMutation('A'); h.commit()    // new action
    expect(h.canRedo).toBe(false)    // redo invalidated
  })
})

describe('UndoHistory — capacity cap', () => {
  it('drops the oldest entry past the max so memory stays bounded', () => {
    const h = new UndoHistory<number>(3)
    for (let i = 0; i < 5; i++) { h.onMutation(i); h.commit() }
    // Banked: dropped 0,1 → [2,3,4]. Undo pops newest-first.
    expect(h.undo(99)).toBe(4)
    expect(h.undo(4)).toBe(3)
    expect(h.undo(3)).toBe(2)
    expect(h.undo(2)).toBeNull()   // only 3 retained
  })
})
