import { describe, it, expect } from 'vitest'
import { computeCompleteness } from '../src/lib/completeness'
import {
  emptyStore, makeProject, makeWork, makeEducation, makeKQ, makeCourse,
} from './fixtures'

describe('computeCompleteness()', () => {
  it('returns 100% for every locale when there are no tracked fields', () => {
    const store = emptyStore()
    if (store.resume) {
      // wipe the seeded title in the fixture
      store.resume.title = {}
      store.resume.nationality = {}
      store.resume.place_of_residence = {}
    }
    expect(computeCompleteness(store, ['en', 'no'])).toEqual({ en: 100, no: 100 })
  })

  it('returns 100% only for locales that fill every tracked field', () => {
    const store = emptyStore()
    if (store.resume) {
      store.resume.title = { en: 'A', no: 'B' }
      store.resume.nationality = { en: 'A' }      // no Norwegian
      store.resume.place_of_residence = { en: 'A' }
    }
    const out = computeCompleteness(store, ['en', 'no'])
    expect(out.en).toBe(100)
    expect(out.no).toBeLessThan(100)
  })

  it('counts only fields with non-empty trimmed values', () => {
    const store = emptyStore()
    if (store.resume) {
      store.resume.title = { en: 'A', no: '   ' }   // whitespace doesn't count
      store.resume.nationality = { en: 'A', no: 'B' }
      store.resume.place_of_residence = { en: 'A', no: 'B' }
    }
    const out = computeCompleteness(store, ['en', 'no'])
    expect(out.en).toBe(100)
    expect(out.no).toBe(67) // 2 of 3 tracked fields filled in Norwegian → round(66.67)
  })

  it('aggregates fields from key_qualifications, projects, work, education, courses', () => {
    const store = emptyStore()
    if (store.resume) {
      store.resume.title = {}
      store.resume.nationality = {}
      store.resume.place_of_residence = {}
    }
    store.key_qualifications.push(makeKQ({ summary: { en: 'A' }, tag_line: { en: 'B' } }))
    store.projects.push(makeProject({ customer: { en: 'A' }, description: { en: 'B' }, long_description: { en: 'C' } }))
    store.work_experiences.push(makeWork({ employer: { en: 'A' }, long_description: { en: 'B' } }))
    store.educations.push(makeEducation({ school: { en: 'A' }, degree: { en: 'B' } }))
    store.courses.push(makeCourse({ name: { en: 'A' } }))
    // total tracked = 2 + 3 + 2 + 2 + 1 = 10; all filled in en → 100
    expect(computeCompleteness(store, ['en'])).toEqual({ en: 100 })
    // None filled in no → 0
    expect(computeCompleteness(store, ['no'])).toEqual({ no: 0 })
  })

  it('ignores fields that are completely empty (not tracked)', () => {
    const store = emptyStore()
    if (store.resume) {
      store.resume.title = {} // empty — not tracked
      store.resume.nationality = { en: 'A' } // tracked
      store.resume.place_of_residence = {}
    }
    // 1 tracked field, filled in en → 100, not in no → 0
    expect(computeCompleteness(store, ['en', 'no'])).toEqual({ en: 100, no: 0 })
  })
})
