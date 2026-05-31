import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toServiceLocale,
  canDraftBetween,
  getTranslationAvailability,
  resetTranslationAvailability,
} from '../src/lib/translateClient'
import { api } from '../src/lib/api'

describe('toServiceLocale()', () => {
  it('maps the app codes that differ from ISO 639-1', () => {
    expect(toServiceLocale('no')).toBe('nb') // Norwegian Bokmål
    expect(toServiceLocale('se')).toBe('sv') // Swedish
    expect(toServiceLocale('dk')).toBe('da') // Danish
  })

  it('passes through codes that already match', () => {
    expect(toServiceLocale('en')).toBe('en')
    expect(toServiceLocale('de')).toBe('de')
    expect(toServiceLocale('fr')).toBe('fr')
  })

  it('lower-cases unknown codes rather than dropping them', () => {
    expect(toServiceLocale('PT')).toBe('pt')
  })
})

describe('canDraftBetween()', () => {
  it('is true for distinct service languages', () => {
    expect(canDraftBetween('en', 'no')).toBe(true)
    expect(canDraftBetween('se', 'dk')).toBe(true)
  })

  it('is false when both map to the same service language', () => {
    expect(canDraftBetween('en', 'en')).toBe(false)
    // Two codes that both fall through to the same lower-cased value.
    expect(canDraftBetween('PT', 'pt')).toBe(false)
  })
})

describe('getTranslationAvailability()', () => {
  beforeEach(() => resetTranslationAvailability())
  afterEach(() => vi.restoreAllMocks())

  it('memoizes the probe so repeated calls hit the server once', async () => {
    const spy = vi.spyOn(api, 'translateStatus').mockResolvedValue(true)
    const a = await getTranslationAvailability()
    const b = await getTranslationAvailability()
    expect(a).toBe(true)
    expect(b).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('re-probes after a reset', async () => {
    const spy = vi.spyOn(api, 'translateStatus').mockResolvedValue(false)
    await getTranslationAvailability()
    resetTranslationAvailability()
    await getTranslationAvailability()
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
