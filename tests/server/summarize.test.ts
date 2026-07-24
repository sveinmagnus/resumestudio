import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  resolveConfig, isSummarizeConfigured, summarize, tidyLine, SummarizeError,
  type SummarizeConfig,
} from '../../server/summarize'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** A fetch mock resolving to a Response-ish object. */
function mockFetch(resp: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue(resp)
  vi.stubGlobal('fetch', fn)
  return fn
}

/** An OpenAI Chat Completions success body. */
function chat(content: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) }
}

/** An Anthropic Messages success body. */
function claude(text: string) {
  return { ok: true, json: async () => ({ content: [{ type: 'text', text }] }) }
}

/** A full SummarizeConfig with overrides — every provider slot present. */
function cfg(over: Partial<SummarizeConfig> = {}): SummarizeConfig {
  return {
    provider: 'off',
    ollama: { url: '' }, openai: { apiKey: '' }, compat: { url: '', apiKey: '' },
    anthropic: { apiKey: '' }, gemini: { apiKey: '' }, mistral: { apiKey: '' },
    model: '', ...over,
  }
}

describe('tidyLine()', () => {
  it('strips fences, quotes, list markers and takes the first line', () => {
    expect(tidyLine('"Led the platform team."')).toBe('Led the platform team.')
    expect(tidyLine('- Built the payments service\nExtra rambling')).toBe('Built the payments service')
    expect(tidyLine('```\nHello\n```')).toBe('Hello')
  })
})

describe('isSummarizeConfigured()', () => {
  it('needs a model, and provider-specific config', () => {
    expect(isSummarizeConfigured(cfg({ provider: 'off', model: 'x' }))).toBe(false)
    // ollama always has a URL (default), so a model is enough.
    expect(isSummarizeConfigured(cfg({ provider: 'ollama', ollama: { url: 'http://localhost:11434' }, model: '' }))).toBe(false)
    expect(isSummarizeConfigured(cfg({ provider: 'ollama', ollama: { url: 'http://localhost:11434' }, model: 'llama3.2' }))).toBe(true)
    expect(isSummarizeConfigured(cfg({ provider: 'openai', openai: { apiKey: 'sk-x' }, model: 'gpt-4o-mini' }))).toBe(true)
    expect(isSummarizeConfigured(cfg({ provider: 'openai', model: 'gpt-4o-mini' }))).toBe(false)
  })

  it('hosted providers are configured on an API key alone (default model)', () => {
    expect(isSummarizeConfigured(cfg({ provider: 'anthropic', anthropic: { apiKey: 'k' } }))).toBe(true)
    expect(isSummarizeConfigured(cfg({ provider: 'gemini', gemini: { apiKey: 'k' } }))).toBe(true)
    expect(isSummarizeConfigured(cfg({ provider: 'mistral', mistral: { apiKey: 'k' } }))).toBe(true)
    // …but not without the key.
    expect(isSummarizeConfigured(cfg({ provider: 'anthropic' }))).toBe(false)
  })
})

describe('resolveConfig()', () => {
  it('reads the SUMMARIZE_* env vars', () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'ollama')
    vi.stubEnv('SUMMARIZE_OLLAMA_URL', 'http://localhost:11434/')
    vi.stubEnv('SUMMARIZE_MODEL', 'llama3.2:3b')
    const c = resolveConfig()
    expect(c.provider).toBe('ollama')
    expect(c.ollama.url).toBe('http://localhost:11434') // trailing slash stripped
    expect(c.model).toBe('llama3.2:3b')
  })

  it('reads the hosted-provider API keys', () => {
    vi.stubEnv('SUMMARIZE_ANTHROPIC_API_KEY', 'a')
    vi.stubEnv('SUMMARIZE_GEMINI_API_KEY', 'g')
    vi.stubEnv('SUMMARIZE_MISTRAL_API_KEY', 'm')
    const c = resolveConfig()
    expect(c.anthropic.apiKey).toBe('a')
    expect(c.gemini.apiKey).toBe('g')
    expect(c.mistral.apiKey).toBe('m')
  })
})

describe('summarize()', () => {
  it('throws 503 when not configured', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'off')
    const err = await summarize('long text', 'en').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SummarizeError)
    expect((err as SummarizeError).status).toBe(503)
  })

  it('posts to the ollama OpenAI-compatible endpoint and returns a tidy line', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'ollama')
    vi.stubEnv('SUMMARIZE_OLLAMA_URL', 'http://localhost:11434')
    vi.stubEnv('SUMMARIZE_MODEL', 'llama3.2')
    const fn = mockFetch(chat('  "Led a cloud migration for a bank."  '))
    const out = await summarize('A long description of the work…', 'no')
    expect(out).toBe('Led a cloud migration for a bank.')

    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:11434/v1/chat/completions')
    const body = JSON.parse(opts.body as string)
    expect(body.model).toBe('llama3.2')
    // Norwegian output requested in the system prompt.
    expect(body.messages[0].content).toContain('Norwegian')
    // Ollama needs no auth header.
    expect((opts.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('sends a Bearer key for OpenAI', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'openai')
    vi.stubEnv('SUMMARIZE_OPENAI_API_KEY', 'sk-secret')
    vi.stubEnv('SUMMARIZE_MODEL', 'gpt-4o-mini')
    const fn = mockFetch(chat('Short.'))
    await summarize('text', 'en')
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer sk-secret')
  })

  it('posts to Google\'s OpenAI-compat endpoint (Bearer) for gemini', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'gemini')
    vi.stubEnv('SUMMARIZE_GEMINI_API_KEY', 'g-key')
    const fn = mockFetch(chat('Short.'))
    await summarize('text', 'en')
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer g-key')
  })

  it('posts to the Mistral API (Bearer) for mistral', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'mistral')
    vi.stubEnv('SUMMARIZE_MISTRAL_API_KEY', 'm-key')
    const fn = mockFetch(chat('Short.'))
    await summarize('text', 'en')
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions')
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer m-key')
  })

  it('uses the native Anthropic Messages API: x-api-key, version header, top-level system, no temperature', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'anthropic')
    vi.stubEnv('SUMMARIZE_ANTHROPIC_API_KEY', 'sk-ant-xxx')
    vi.stubEnv('SUMMARIZE_MODEL', 'claude-haiku-4-5')
    const fn = mockFetch(claude('  Led a cloud migration.  '))
    const out = await summarize('A long description…', 'en')
    expect(out).toBe('Led a cloud migration.')

    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = opts.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-xxx')
    expect(headers['anthropic-version']).toBeTruthy()
    expect(headers.Authorization).toBeUndefined() // NOT Bearer

    const body = JSON.parse(opts.body as string)
    expect(body.model).toBe('claude-haiku-4-5')
    expect(body.max_tokens).toBe(80)
    // Current Claude models reject temperature — it must be omitted.
    expect(body.temperature).toBeUndefined()
    // The system prompt is a top-level field, not a message role.
    expect(typeof body.system).toBe('string')
    expect(body.system.length).toBeGreaterThan(0)
    expect(body.messages.some((m: { role: string }) => m.role === 'system')).toBe(false)
  })

  it('falls back to the anthropic default model when none is set', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'anthropic')
    vi.stubEnv('SUMMARIZE_ANTHROPIC_API_KEY', 'k')
    const fn = mockFetch(claude('Ok.'))
    await summarize('text', 'en')
    const body = JSON.parse((fn.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.model).toBe('claude-haiku-4-5')
  })

  it('maps a 401 to a 502 key-rejected error', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'openai')
    vi.stubEnv('SUMMARIZE_OPENAI_API_KEY', 'bad')
    vi.stubEnv('SUMMARIZE_MODEL', 'gpt-4o-mini')
    mockFetch({ ok: false, status: 401 })
    const err = await summarize('text', 'en').catch((e: unknown) => e)
    expect((err as SummarizeError).status).toBe(502)
    expect((err as SummarizeError).message).toMatch(/rejected the API key/i)
  })

  it('maps an Anthropic 401 the same way', async () => {
    vi.stubEnv('SUMMARIZE_PROVIDER', 'anthropic')
    vi.stubEnv('SUMMARIZE_ANTHROPIC_API_KEY', 'bad')
    mockFetch({ ok: false, status: 401 })
    const err = await summarize('text', 'en').catch((e: unknown) => e)
    expect((err as SummarizeError).message).toMatch(/rejected the API key/i)
  })
})
