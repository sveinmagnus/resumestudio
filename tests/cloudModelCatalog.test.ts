import { describe, it, expect } from 'vitest'
import { cloudModelOptions, modelPlaceholder } from '../src/lib/cloudModelCatalog'

describe('cloudModelOptions()', () => {
  it('returns a non-empty shortlist for each hosted provider', () => {
    for (const p of ['openai', 'anthropic', 'gemini', 'mistral']) {
      expect(cloudModelOptions(p).length).toBeGreaterThan(0)
    }
  })

  it('leads with a cheap/fast default (first entry noted as a default)', () => {
    expect(cloudModelOptions('anthropic')[0].name).toBe('claude-haiku-4-5')
    expect(cloudModelOptions('anthropic')[0].note).toMatch(/default/i)
  })

  it('returns an empty list for providers with no catalog (ollama/compat)', () => {
    expect(cloudModelOptions('ollama_docker')).toEqual([])
    expect(cloudModelOptions('compat')).toEqual([])
  })
})

describe('modelPlaceholder()', () => {
  it('names the provider\'s default model', () => {
    expect(modelPlaceholder('openai')).toBe('e.g. gpt-4o-mini')
    expect(modelPlaceholder('gemini')).toBe('e.g. gemini-2.5-flash')
  })

  it('falls back to an Ollama-style example for a provider without a catalog', () => {
    expect(modelPlaceholder('compat')).toMatch(/llama/i)
  })
})
