/**
 * PURE: curated model shortlists for the HOSTED Summarize providers (OpenAI,
 * Anthropic, Gemini, Mistral), so the model field is a pick-list to choose from
 * rather than a free-text box you must already know the answer for.
 *
 * The field stays free-text — any model id the provider accepts still works —
 * this is only a helpful starting set, ordered cheapest/fastest FIRST because a
 * one-line summary doesn't need a flagship model and small is the right default.
 * Not exhaustive, and it will drift as providers rev their line-ups; kept short
 * and pragmatic on purpose. Ollama has its own list (`ollamaCatalog.ts`) because
 * it additionally merges in whatever the local instance has pulled.
 */

export interface CloudModelEntry {
  /** The model id sent to the provider. */
  name: string
  /** One short clause on why you'd pick it. */
  note?: string
}

/** Keyed by the server-side provider name (see SummarizeProvider). */
const CATALOG: Partial<Record<string, readonly CloudModelEntry[]>> = {
  openai: [
    { name: 'gpt-4o-mini', note: 'cheap & fast — good default' },
    { name: 'gpt-4o', note: 'stronger, pricier' },
  ],
  anthropic: [
    { name: 'claude-haiku-4-5', note: 'fastest & cheapest — good default' },
    { name: 'claude-sonnet-5', note: 'stronger, balanced' },
    { name: 'claude-opus-4-8', note: 'most capable, priciest' },
  ],
  gemini: [
    { name: 'gemini-2.5-flash', note: 'fast & cheap — good default' },
    { name: 'gemini-2.5-pro', note: 'stronger, pricier' },
    { name: 'gemini-2.0-flash', note: 'previous fast tier' },
  ],
  mistral: [
    { name: 'mistral-small-latest', note: 'cheap & fast — good default' },
    { name: 'mistral-large-latest', note: 'most capable' },
    { name: 'open-mistral-nemo', note: 'small open model' },
  ],
}

/** The curated shortlist for a hosted provider, or [] for one with no catalog. */
export function cloudModelOptions(provider: string): readonly CloudModelEntry[] {
  return CATALOG[provider] ?? []
}

/** A one-line placeholder example model id for the given provider's field. */
export function modelPlaceholder(provider: string): string {
  const first = CATALOG[provider]?.[0]?.name
  return first ? `e.g. ${first}` : 'e.g. llama3.2:3b'
}
