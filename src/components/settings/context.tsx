/**
 * Shared state for the Settings tabs.
 *
 * The settings screen is ONE form with one Save — the tabs only decide what's
 * on screen, not what's saved — so the state stays in `SettingsModal` and the
 * tabs read it from here. A context rather than props because the alternative
 * is a 25-prop signature on every tab, re-typed in two places; nothing here is
 * shared beyond the modal subtree, so the usual "context is global state"
 * objection doesn't apply.
 */

import { createContext, useContext } from 'react'
import type { SettingsStatus, UpdateStatus, DockerActionResult } from '../../lib/api'
import type { InstalledModel } from '../../lib/ollamaCatalog'

/** The translation provider as the UI models it (Docker vs remote are one provider server-side). */
export type UiProvider = 'off' | 'libre_docker' | 'libre_remote' | 'deepl' | 'google' | 'azure' | 'llm'
/** Same idea for the summarize provider (Ollama's Docker vs remote is one
 *  provider server-side; the hosted ones map 1:1 to SummarizeProvider). */
export type SummUiProvider =
  | 'off' | 'ollama_docker' | 'ollama_remote'
  | 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'compat'

/** API-key form fields for the summarize providers that take a key. */
export interface SummKeys { openai: string; anthropic: string; gemini: string; mistral: string; compat: string }
export type SummKeyName = keyof SummKeys

/** An async action's transient result (Test / Docker / update buttons). */
export interface ActionState { busy: boolean; text?: string; ok?: boolean }

export interface SettingsForm {
  status: SettingsStatus | null
  managed: boolean
  keyPlaceholder: (set: boolean) => string

  // ── Translation ──
  provider: UiProvider
  setProvider: (v: UiProvider) => void
  libreUrl: string
  setLibreUrl: (v: string) => void
  azureRegion: string
  setAzureRegion: (v: string) => void
  keys: { libre: string; deepl: string; google: string; azure: string }
  setKeys: React.Dispatch<React.SetStateAction<{ libre: string; deepl: string; google: string; azure: string }>>
  keySet: { libre: boolean; deepl: boolean; google: boolean; azure: boolean }
  docker: ActionState
  onDocker: (action: 'start' | 'stop' | 'status') => Promise<void>
  test: ActionState
  onTest: () => Promise<void>
  transLangs: string[]
  setTransLangs: React.Dispatch<React.SetStateAction<string[]>>
  forcedLangs: string[]

  // ── Summarize (AI assist) ──
  summProvider: SummUiProvider
  setSummProvider: (v: SummUiProvider) => void
  summOllamaUrl: string
  setSummOllamaUrl: (v: string) => void
  summCompatUrl: string
  setSummCompatUrl: (v: string) => void
  summModel: string
  setSummModel: (v: string) => void
  summKeys: SummKeys
  setSummKeys: React.Dispatch<React.SetStateAction<SummKeys>>
  summKeySet: Record<SummKeyName, boolean>
  summTest: ActionState
  onTestSummarize: () => Promise<void>
  summDocker: ActionState
  onSummarizeDocker: (action: 'start' | 'stop' | 'status') => Promise<DockerActionResult | void>
  isOllama: boolean
  modelOpts: Array<{ name: string; label: string; installed: boolean }>
  installed: InstalledModel[]
  modelsBusy: boolean
  refreshModels: () => Promise<void>

  // ── Sync ──
  backupDir: string
  setBackupDir: (v: string) => void

  // ── Version & updates ──
  upd: UpdateStatus | null
  updBusy: null | 'check' | 'install'
  onCheckUpdate: () => Promise<void>
  onInstallUpdate: () => Promise<void>
}

const Ctx = createContext<SettingsForm | null>(null)

export const SettingsFormProvider = Ctx.Provider

export function useSettingsForm(): SettingsForm {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettingsForm must be used inside the Settings modal')
  return v
}
