/**
 * Server-side "summarize" proxy — the ONE LLM round-trip behind every AI-assist
 * feature (short-description summarize, LLM translation, the writing coach). The
 * client never calls the model directly (keys/URLs stay server-side, one auth
 * perimeter), mirroring translate.ts.
 *
 * Two wire protocols, dispatched on the provider (see `endpointFor`):
 *
 * OpenAI **Chat Completions** (`POST {baseUrl}/chat/completions`) — the shape
 * most backends speak:
 *   - ollama — a local Ollama (Docker-managed or a remote URL); its OpenAI-
 *     compatible endpoint lives at `{url}/v1`. First-class, like the Docker
 *     LibreTranslate for translation.
 *   - openai — the OpenAI API (needs a key).
 *   - gemini — Google Gemini via its OpenAI-compatible endpoint (Bearer key).
 *   - mistral — the Mistral API (OpenAI-compatible; Bearer key).
 *   - compat — any other OpenAI-compatible endpoint (OpenRouter, Groq, Together,
 *     LM Studio, …) via an explicit base URL + optional key.
 *
 * Anthropic **Messages** (`POST {baseUrl}/messages`) — a different shape, so it
 * gets its own branch:
 *   - anthropic — the Claude API. `x-api-key` + `anthropic-version` headers (not
 *     Bearer), the system prompt is a top-level field (not a message role), and
 *     current Claude models REJECT `temperature`, so we omit it. Response text
 *     is `content[].text`, not `choices[].message.content`.
 *
 * Env is read lazily per call so tests can vary it and importing has no side
 * effects; the desktop build pushes in-app settings onto the same env vars
 * (settings.ts → applyToEnv). Output is a review-required draft.
 */

export type SummarizeProvider =
  | 'off' | 'ollama' | 'openai' | 'compat' | 'anthropic' | 'gemini' | 'mistral'

/** Canonical list — settings.ts and the settings route validate against this
 *  (see TRANSLATE_PROVIDERS in translate.ts for why copies are banned). */
export const SUMMARIZE_PROVIDERS: readonly SummarizeProvider[] =
  ['off', 'ollama', 'openai', 'compat', 'anthropic', 'gemini', 'mistral']

/** Default local Ollama base (no trailing /v1 — added when composing the URL). */
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

/** Fixed base URLs for the hosted providers. */
const OPENAI_BASE = 'https://api.openai.com/v1'
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
/** Anthropic requires a version header; this is the stable dated value. */
const ANTHROPIC_VERSION = '2023-06-01'
/** Google's OpenAI-compatibility endpoint (Chat Completions + Bearer key). */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai'
const MISTRAL_BASE = 'https://api.mistral.ai/v1'

/** Sensible default chat model per hosted provider — small/fast suits a one-line
 *  summary, and it means an API key alone is enough to be "configured". */
const DEFAULT_MODEL: Partial<Record<SummarizeProvider, string>> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  gemini: 'gemini-2.5-flash',
  mistral: 'mistral-small-latest',
}

export interface SummarizeConfig {
  provider: SummarizeProvider
  /** Ollama base URL (without /v1). */
  ollama: { url: string }
  openai: { apiKey: string }
  compat: { url: string; apiKey: string }
  anthropic: { apiKey: string }
  gemini: { apiKey: string }
  mistral: { apiKey: string }
  /** Chat model name (e.g. 'llama3.2:3b', 'gpt-4o-mini', 'claude-haiku-4-5'). */
  model: string
}

/** Hard cap on the source text sent to the model (chars). */
export const MAX_SUMMARIZE_CHARS = 6000
/** Upstream timeout (ms) — LLMs (esp. local) are slower than an MT engine. */
const TIMEOUT_MS = 45_000

function clean(v: string | undefined): string {
  return v?.trim() ?? ''
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): SummarizeConfig {
  const explicit = clean(env.SUMMARIZE_PROVIDER).toLowerCase()
  const provider = (SUMMARIZE_PROVIDERS as string[]).includes(explicit) ? (explicit as SummarizeProvider) : 'off'
  return {
    provider,
    ollama: { url: clean(env.SUMMARIZE_OLLAMA_URL).replace(/\/+$/, '') || DEFAULT_OLLAMA_URL },
    openai: { apiKey: clean(env.SUMMARIZE_OPENAI_API_KEY) },
    compat: { url: clean(env.SUMMARIZE_COMPAT_URL).replace(/\/+$/, ''), apiKey: clean(env.SUMMARIZE_COMPAT_API_KEY) },
    anthropic: { apiKey: clean(env.SUMMARIZE_ANTHROPIC_API_KEY) },
    gemini: { apiKey: clean(env.SUMMARIZE_GEMINI_API_KEY) },
    mistral: { apiKey: clean(env.SUMMARIZE_MISTRAL_API_KEY) },
    model: clean(env.SUMMARIZE_MODEL),
  }
}

/** The wire protocol an endpoint speaks — most are OpenAI Chat Completions; only
 *  Anthropic's native Messages API differs enough to need its own branch. */
type WireProtocol = 'openai' | 'anthropic'

interface ResolvedEndpoint {
  protocol: WireProtocol
  baseUrl: string
  apiKey: string
  model: string
}

/** The resolved endpoint (protocol + base URL + key + model) for the active
 *  provider, or null when the provider lacks what it needs to run. */
function endpointFor(c: SummarizeConfig): ResolvedEndpoint | null {
  const model = (p: SummarizeProvider) => c.model || DEFAULT_MODEL[p] || ''
  switch (c.provider) {
    case 'ollama': return c.ollama.url ? { protocol: 'openai', baseUrl: `${c.ollama.url}/v1`, apiKey: '', model: c.model } : null
    case 'openai': return c.openai.apiKey ? { protocol: 'openai', baseUrl: OPENAI_BASE, apiKey: c.openai.apiKey, model: model('openai') } : null
    case 'compat': return c.compat.url ? { protocol: 'openai', baseUrl: c.compat.url, apiKey: c.compat.apiKey, model: c.model } : null
    case 'gemini': return c.gemini.apiKey ? { protocol: 'openai', baseUrl: GEMINI_BASE, apiKey: c.gemini.apiKey, model: model('gemini') } : null
    case 'mistral': return c.mistral.apiKey ? { protocol: 'openai', baseUrl: MISTRAL_BASE, apiKey: c.mistral.apiKey, model: model('mistral') } : null
    case 'anthropic': return c.anthropic.apiKey ? { protocol: 'anthropic', baseUrl: ANTHROPIC_BASE, apiKey: c.anthropic.apiKey, model: model('anthropic') } : null
    default: return null
  }
}

/** True when the resolved (or supplied) provider has what it needs to run. */
export function isSummarizeConfigured(config?: SummarizeConfig): boolean {
  const c = config ?? resolveConfig()
  const ep = endpointFor(c)
  return !!ep && ep.model.length > 0
}

/** Hosts that mean "this machine" — nothing sent there leaves the computer. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal'])

/**
 * True when the resolved endpoint runs on this machine.
 *
 * Derived from the endpoint HOST rather than the provider name on purpose: an
 * `openai-compatible` endpoint pointed at LM Studio on localhost is every bit as
 * private as Ollama, and a remote Ollama is not private at all. The UI states
 * "nothing leaves this computer" based on this, so it has to describe where the
 * bytes actually go — and it must fail CLOSED: anything unparseable is treated
 * as remote.
 */
export function isLocalEndpoint(config?: SummarizeConfig): boolean {
  const c = config ?? resolveConfig()
  const ep = endpointFor(c)
  if (!ep) return false
  try {
    return LOCAL_HOSTS.has(new URL(ep.baseUrl).hostname)
  } catch {
    return false
  }
}

/** What the client needs to describe the backend honestly (provenance line). */
export interface SummarizeInfo {
  configured: boolean
  /** '' when nothing is configured. */
  provider: SummarizeProvider | ''
  model: string
  /** True only when the endpoint is on this machine — see isLocalEndpoint. */
  local: boolean
}

export function summarizeInfo(config?: SummarizeConfig): SummarizeInfo {
  const c = config ?? resolveConfig()
  const configured = isSummarizeConfigured(c)
  return {
    configured,
    provider: configured ? c.provider : '',
    model: configured ? (endpointFor(c)?.model ?? '') : '',
    local: configured && isLocalEndpoint(c),
  }
}

/**
 * App locale code → the language name we put in the prompt. One entry per
 * offered locale (LOCALE_LABELS in src/lib/locales.ts) — an unlisted code
 * degrades to "the same language as the input", which is a sane fallback for
 * summarising but would silently no-op a TRANSLATION, so this table must track
 * the offered set.
 *
 * The name is English (what models resolve most reliably) PLUS the native name
 * in parentheses. The native word is a strong anchor for smaller models, which
 * otherwise conflate close languages — the reported bug was English→Norwegian
 * coming back Swedish, because "Norwegian" alone doesn't distinguish Bokmål from
 * Swedish in a 3B model's representation. `no` is spelled out as Bokmål (the
 * app's `no` is Bokmål, per the CVpartner convention) so the target is
 * unmistakable.
 */
const LANG_NAMES: Record<string, string> = {
  en: 'English', no: 'Norwegian Bokmål (norsk bokmål)', se: 'Swedish (svenska)', dk: 'Danish (dansk)',
  de: 'German (Deutsch)', fr: 'French (français)', es: 'Spanish (español)', it: 'Italian (italiano)',
  nl: 'Dutch (Nederlands)', pt: 'Portuguese (português)', pl: 'Polish (polski)', fi: 'Finnish (suomi)',
  is: 'Icelandic (íslenska)', ru: 'Russian (русский)', uk: 'Ukrainian (українська)',
}

/** The English name of a locale's language, or null when we don't know it. */
export function languageNameOf(locale: string): string | null {
  return LANG_NAMES[locale] ?? null
}

function languageName(locale: string): string {
  return LANG_NAMES[locale] ?? 'the same language as the input'
}

/** Raised for any upstream/summarize failure; carries a safe HTTP status. */
export class SummarizeError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'SummarizeError'
  }
}

/**
 * Tidy the model's reply into a single clean line: strip code fences / wrapping
 * quotes, collapse whitespace to one line, and cap the length. LLMs sometimes
 * add a preamble or quotes despite instructions — this keeps the field sane.
 */
export function tidyLine(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^```[a-z]*\n?|```$/gi, '').trim()
  // First non-empty line only (drop any trailing explanation).
  s = (s.split(/\r?\n/).find((l) => l.trim()) ?? '').trim()
  // Strip a leading list marker ("- ", "• ", "1. ") and wrapping quotes.
  s = s.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '')
  s = s.replace(/^["“'']+|["”'']+$/g, '').trim()
  return s.slice(0, 240)
}

const SYSTEM_PROMPT =
  'You condense a résumé/CV entry into ONE concise line for a summary view. ' +
  'Output only that single line — no preamble, no quotes, no markdown, no trailing period unless natural. ' +
  'Keep it under ~18 words, factual and specific, preserving key role/technology/outcome. ' +
  'Write it in {LANGUAGE}.'

/**
 * Summarize `text` into a one-line short description, in `locale`'s language,
 * using the configured (or supplied) provider. Throws SummarizeError on any
 * failure — callers map that to an HTTP response without leaking internals.
 */
export async function summarize(text: string, locale: string, config?: SummarizeConfig): Promise<string> {
  const content = await chatComplete(
    [
      { role: 'system', content: SYSTEM_PROMPT.replace('{LANGUAGE}', languageName(locale)) },
      { role: 'user', content: text },
    ],
    { maxTokens: 80 },
    config,
  )
  const line = tidyLine(content)
  if (!line) throw new SummarizeError(502, 'The AI model returned no usable summary')
  return line
}

export interface ChatMessage { role: 'system' | 'user'; content: string }
export interface ChatOpts { maxTokens: number; temperature?: number }

/**
 * One chat round-trip against the configured LLM, returning the raw reply text.
 * Dispatches to the OpenAI or Anthropic wire path by provider. Extracted so the
 * LLM TRANSLATION provider (server/translate.ts) and the writing coach can reuse
 * the same endpoint resolution, auth, timeout and error mapping rather than
 * duplicating them — "use the model I already configured for Summarize" is
 * exactly one config, one code path.
 *
 * Throws SummarizeError; translate.ts maps that onto its own error type so
 * callers still get a translate-shaped failure.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: ChatOpts,
  config?: SummarizeConfig,
): Promise<string> {
  const c = config ?? resolveConfig()
  const ep = endpointFor(c)
  if (!ep || !ep.model) throw new SummarizeError(503, 'Summarize is not configured on this server')
  return ep.protocol === 'anthropic'
    ? anthropicChat(ep, messages, opts)
    : openAIChat(ep, messages, opts)
}

/** Map an upstream HTTP status to a safe, actionable SummarizeError (502). */
function mapUpstreamError(status: number): SummarizeError {
  if (status === 401 || status === 403) return new SummarizeError(502, 'The AI provider rejected the API key')
  if (status === 404) return new SummarizeError(502, 'Model or endpoint not found — check the model name / URL')
  if (status === 429) return new SummarizeError(502, 'The AI provider is rate-limited or out of quota')
  return new SummarizeError(502, 'The AI model returned an error')
}

const UNREACHABLE = 'The AI model is unreachable (is it running / the URL correct?)'

/** OpenAI Chat Completions round-trip (ollama/openai/compat/gemini/mistral). */
async function openAIChat(ep: ResolvedEndpoint, messages: ChatMessage[], opts: ChatOpts): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${ep.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ep.apiKey ? { Authorization: `Bearer ${ep.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: ep.model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens,
        messages,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new SummarizeError(502, UNREACHABLE)
  }
  if (!res.ok) throw mapUpstreamError(res.status)
  const json = await res.json().catch(() => null) as { choices?: { message?: { content?: string } }[] } | null
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new SummarizeError(502, 'The AI model returned no text')
  return content
}

/**
 * Anthropic native Messages round-trip. Differs from the OpenAI path in four
 * ways: `x-api-key`+`anthropic-version` headers (not Bearer); the system prompt
 * is a top-level `system` field, not a message with role 'system'; `temperature`
 * is omitted (current Claude models reject it with a 400); and the reply text is
 * the first text block of `content[]`, not `choices[0].message.content`.
 */
async function anthropicChat(ep: ResolvedEndpoint, messages: ChatMessage[], opts: ChatOpts): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const chat = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))
  let res: Response
  try {
    res = await fetch(`${ep.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ep.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ep.model,
        max_tokens: opts.maxTokens,
        ...(system ? { system } : {}),
        messages: chat,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new SummarizeError(502, UNREACHABLE)
  }
  if (!res.ok) throw mapUpstreamError(res.status)
  const json = await res.json().catch(() => null) as { content?: { type?: string; text?: string }[] } | null
  const text = json?.content?.find((b) => b.type === 'text')?.text
  if (typeof text !== 'string' || !text.trim()) throw new SummarizeError(502, 'The AI model returned no text')
  return text
}
