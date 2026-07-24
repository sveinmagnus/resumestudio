/**
 * AI assist — the LLM that powers the "Summarize" button, and (when the
 * Translation tab is set to `llm`) translation too.
 */

import { Loader2, Check, AlertCircle, Server, Box, Power, RefreshCw, Sparkles } from 'lucide-react'
import { useSettingsForm, type SummUiProvider } from './context'
import { cloudModelOptions, modelPlaceholder } from '../../lib/cloudModelCatalog'

export function AiAssistTab() {
  const {
    managed, keyPlaceholder,
    summProvider, setSummProvider, summOllamaUrl, setSummOllamaUrl,
    summCompatUrl, setSummCompatUrl, summModel, setSummModel,
    summKeys, setSummKeys, summKeySet, summTest, onTestSummarize,
    summDocker, onSummarizeDocker, isOllama, modelOpts, installed, modelsBusy, refreshModels,
    status,
  } = useSettingsForm()

  if (!managed) {
    return (
      <section className="sm-sec">
        <div className="sm-sec-head"><Sparkles size={15} /> AI assist (Summarize, Writing coach &amp; translation)</div>
        <div className="sm-note">
          On this deployment, settings are controlled by the server's environment
          variables, not from the app.
        </div>
        <div className="sm-row">
          <span>AI assist</span>
          <span className={status?.summarize?.configured ? 'sm-pill sm-pill-ok' : 'sm-pill'}>
            {status?.summarize?.configured ? 'Configured' : 'Off'}
          </span>
        </div>
      </section>
    )
  }

  const installedCount = installed.length
  // Cloud providers map 1:1 to their server name, so the UI value is the catalog
  // key. Ollama has its own (dynamic) list; both feed the same datalist below.
  const cloudModels = cloudModelOptions(summProvider)
  const hasModelList = isOllama || cloudModels.length > 0

  return (
    <section className="sm-sec">
      <div className="sm-sec-head"><Sparkles size={15} /> AI assist (Summarize, Writing coach &amp; translation)</div>
      <p className="sm-help">
        One LLM powers every AI assist in Resume Studio: the <strong>Summarize</strong>{' '}
        button that drafts a one-line short description from a long one (per field,
        or a whole section at once with <strong>Bulk summarize</strong>); the{' '}
        <strong>Writing coach</strong>, which tightens an existing description's
        prose without inventing facts; and — when the Translation tab is set to{' '}
        <em>“AI-assist model”</em> — <strong>translation</strong> too. Every result
        is a review-required draft.
      </p>
      <p className="sm-help">
        Run a model locally with Docker (private &amp; free — nothing leaves this
        computer), or use a hosted provider. Configure it once here and all three
        features light up.
      </p>

      <label className="sm-field-label" htmlFor="sm-sum-provider">Provider</label>
      <select id="sm-sum-provider" className="sm-input" value={summProvider}
        onChange={(e) => setSummProvider(e.target.value as SummUiProvider)} aria-label="AI assist provider">
        <option value="off">Off — no AI assist</option>
        <optgroup label="Local (private &amp; free)">
          <option value="ollama_docker">Ollama — Docker-managed</option>
          <option value="ollama_remote">Ollama — remote URL</option>
        </optgroup>
        <optgroup label="Hosted (bring your own API key)">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="gemini">Google Gemini</option>
          <option value="mistral">Mistral</option>
          <option value="compat">Other OpenAI-compatible (OpenRouter, Groq, Together, LM Studio…)</option>
        </optgroup>
      </select>

      {summProvider !== 'off' && (
        <div className="sm-sub">
          <label className="sm-field-label" htmlFor="sm-sum-model">Model</label>
          {/* A datalist rather than a <select>: Ollama has thousands of
              valid tags, so the list is a shortlist to pick from, not a
              constraint — any tag you type still works. Refresh re-asks
              the running instance what it has pulled. */}
          <div className="sm-field-row">
            <input id="sm-sum-model" className="sm-input" value={summModel}
              list={hasModelList ? 'sm-model-list' : undefined}
              placeholder={modelPlaceholder(summProvider)}
              onChange={(e) => setSummModel(e.target.value)} aria-label="AI assist model" />
            {isOllama && (
              <button className="sm-btn sm-btn-icon" onClick={() => void refreshModels()}
                disabled={modelsBusy} title="Refresh the list from the running Ollama"
                aria-label="Refresh model list">
                {modelsBusy ? <Loader2 size={13} className="sm-spin" /> : <RefreshCw size={13} />}
              </button>
            )}
          </div>
          {hasModelList && (
            <datalist id="sm-model-list">
              {isOllama
                ? modelOpts.map((m) => <option key={m.name} value={m.name} label={m.label} />)
                : cloudModels.map((m) => <option key={m.name} value={m.name} label={m.note} />)}
            </datalist>
          )}
          {isOllama && (
            <p className="sm-help">
              {installedCount > 0
                ? `${installedCount} model(s) already pulled. Others download on first use.`
                : 'Pick a model — smaller is faster and downloads less. Any Ollama tag works.'}
            </p>
          )}
          {!isOllama && cloudModels.length > 0 && (
            <p className="sm-help">Smaller/“mini/flash” models are cheapest and plenty for one-line drafts. Any model id the provider accepts works.</p>
          )}
        </div>
      )}

      {summProvider === 'ollama_docker' && (
        <div className="sm-sub">
          <p className="sm-help">
            Runs Ollama in Docker at <code>http://localhost:11434</code>.
            Requires Docker Desktop; “Start” pulls the model above (several
            GB on first run).
          </p>
          <div className="sm-btn-row">
            <button className="sm-btn" onClick={() => void onSummarizeDocker('start')} disabled={summDocker.busy}>
              {summDocker.busy ? <Loader2 size={13} className="sm-spin" /> : <Power size={13} />} Start &amp; pull
            </button>
            <button className="sm-btn" onClick={() => void onSummarizeDocker('stop')} disabled={summDocker.busy}>
              <Box size={13} /> Stop
            </button>
            <button className="sm-btn" onClick={() => void onSummarizeDocker('status')} disabled={summDocker.busy}>
              <Server size={13} /> Check status
            </button>
          </div>
          {summDocker.text && (
            <div className={`sm-inline ${summDocker.ok ? 'sm-ok' : 'sm-warn'}`}>
              {summDocker.ok ? <Check size={13} /> : <AlertCircle size={13} />} {summDocker.text}
            </div>
          )}
          <p className="sm-help">Click <strong>Save</strong> to enable the Summarize button on every launch.</p>
        </div>
      )}

      {summProvider === 'ollama_remote' && (
        <div className="sm-sub">
          <input className="sm-input" placeholder="http://your-ollama-host:11434"
            value={summOllamaUrl} onChange={(e) => setSummOllamaUrl(e.target.value)} aria-label="Ollama URL" />
        </div>
      )}

      {summProvider === 'openai' && (
        <div className="sm-sub">
          <input className="sm-input" type="password" placeholder={keyPlaceholder(summKeySet.openai)}
            value={summKeys.openai} onChange={(e) => setSummKeys((k) => ({ ...k, openai: e.target.value }))}
            aria-label="OpenAI API key" />
          <p className="sm-help">Get a key at <code>platform.openai.com</code>.</p>
        </div>
      )}

      {summProvider === 'anthropic' && (
        <div className="sm-sub">
          <input className="sm-input" type="password" placeholder={keyPlaceholder(summKeySet.anthropic)}
            value={summKeys.anthropic} onChange={(e) => setSummKeys((k) => ({ ...k, anthropic: e.target.value }))}
            aria-label="Anthropic API key" />
          <p className="sm-help">Native Claude Messages API. Get a key at <code>console.anthropic.com</code>.</p>
        </div>
      )}

      {summProvider === 'gemini' && (
        <div className="sm-sub">
          <input className="sm-input" type="password" placeholder={keyPlaceholder(summKeySet.gemini)}
            value={summKeys.gemini} onChange={(e) => setSummKeys((k) => ({ ...k, gemini: e.target.value }))}
            aria-label="Google Gemini API key" />
          <p className="sm-help">Uses Google's OpenAI-compatible endpoint. Get a key at <code>aistudio.google.com</code>.</p>
        </div>
      )}

      {summProvider === 'mistral' && (
        <div className="sm-sub">
          <input className="sm-input" type="password" placeholder={keyPlaceholder(summKeySet.mistral)}
            value={summKeys.mistral} onChange={(e) => setSummKeys((k) => ({ ...k, mistral: e.target.value }))}
            aria-label="Mistral API key" />
          <p className="sm-help">Get a key at <code>console.mistral.ai</code>.</p>
        </div>
      )}

      {summProvider === 'compat' && (
        <div className="sm-sub">
          <input className="sm-input" placeholder="Base URL, e.g. https://openrouter.ai/api/v1"
            value={summCompatUrl} onChange={(e) => setSummCompatUrl(e.target.value)} aria-label="OpenAI-compatible base URL" />
          <input className="sm-input" type="password" placeholder={keyPlaceholder(summKeySet.compat)}
            value={summKeys.compat} onChange={(e) => setSummKeys((k) => ({ ...k, compat: e.target.value }))}
            aria-label="OpenAI-compatible API key" />
        </div>
      )}

      {summProvider !== 'off' && (
        <div className="sm-btn-row">
          {/* Saves first — see onTestSummarize in SettingsModal. */}
          <button className="sm-btn" onClick={() => void onTestSummarize()} disabled={summTest.busy}>
            {summTest.busy ? <Loader2 size={13} className="sm-spin" /> : <Server size={13} />} Save and test
          </button>
          {summTest.text && (
            <span className={`sm-inline ${summTest.ok ? 'sm-ok' : 'sm-warn'}`}>
              {summTest.ok ? <Check size={13} /> : <AlertCircle size={13} />} {summTest.text}
            </span>
          )}
        </div>
      )}
    </section>
  )
}
