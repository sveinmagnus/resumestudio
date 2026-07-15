import { describe, it, expect } from 'vitest'
import { cefrSummary, cefrGrouped, hasCefr } from '../src/lib/cefr'

describe('cefrSummary()', () => {
  it('collapses to a single level when all five categories match', () => {
    expect(cefrSummary({
      listening: 'B2', reading: 'B2', spoken_interaction: 'B2', spoken_production: 'B2', writing: 'B2',
    })).toBe('B2')
  })

  it('groups categories by level (deduped) in level order', () => {
    expect(cefrSummary({ listening: 'B2', reading: 'B2', writing: 'C1' }))
      .toBe('B2 (Listening, Reading) · C1 (Writing)')
  })

  it('is empty for no set levels', () => {
    expect(cefrSummary(undefined)).toBe('')
    expect(cefrSummary({})).toBe('')
    expect(hasCefr({})).toBe(false)
    expect(hasCefr({ reading: 'A1' })).toBe(true)
  })
})

describe('cefrGrouped()', () => {
  it('orders groups by level and keeps category order', () => {
    expect(cefrGrouped({ writing: 'C1', listening: 'B2', reading: 'B2' })).toEqual([
      { level: 'B2', categories: ['Listening', 'Reading'] },
      { level: 'C1', categories: ['Writing'] },
    ])
  })
})
