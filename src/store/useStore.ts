import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ResumeStore, Resume, LocalizedString } from '../types'
import { importFromCVPartner } from '../lib/importer'
import { detectLocalesInData, sortLocales } from '../lib/locales'

interface AppState {
  data: ResumeStore
  // UI
  activeSection: string
  primaryLocale: string
  secondaryLocale: string | null
  expandedItemId: string | null
  hasData: boolean

  /**
   * Monotonic counter that increments on every USER-initiated data mutation.
   * Load actions reset it to 0. The auto-save effect uses this to decide
   * whether to fire — comparing it to a "last-saved" ref. This replaced an
   * earlier hack of remembering to flip a `skipNextSave` ref before each
   * load call site.
   */
  mutationCount: number

  // actions
  loadFromCVPartner: (raw: Record<string, unknown>) => void
  loadStore: (store: ResumeStore) => void
  startFresh: () => void
  setActiveSection: (s: string) => void
  setPrimaryLocale: (l: string) => void
  setSecondaryLocale: (l: string | null) => void
  setExpandedItem: (id: string | null) => void
  updateResume: (patch: Partial<Resume>) => void

  /** Rescan all data, merge any new locales into resume.supported_locales. */
  detectAndSetLocales: () => void

  // generic array item ops
  updateItem: <K extends ArraySectionKey>(section: K, id: string, patch: Partial<ArrayItem<K>>) => void
  addItem: <K extends ArraySectionKey>(section: K, item: ArrayItem<K>) => void
  removeItem: (section: ArraySectionKey, id: string) => void
  reorderItem: (section: ArraySectionKey, id: string, direction: 'up' | 'down') => void
}

type ArraySectionKey = Exclude<keyof ResumeStore, 'resume'>
type ArrayItem<K extends ArraySectionKey> = ResumeStore[K] extends Array<infer T> ? T : never

const emptyStore: ResumeStore = {
  resume: null,
  skills: [], roles: [], key_qualifications: [], projects: [],
  work_experiences: [], educations: [], courses: [], certifications: [],
  spoken_languages: [], technology_categories: [], positions: [],
  presentations: [], honor_awards: [], publications: [], references: [],
  views: [],
}

export const useStore = create<AppState>((set) => ({
  data: emptyStore,
  activeSection: 'overview',
  primaryLocale: 'en',
  secondaryLocale: 'no',
  expandedItemId: null,
  hasData: false,
  mutationCount: 0,

  loadFromCVPartner: (raw) => {
    const data = importFromCVPartner(raw)
    const locales = data.resume?.supported_locales || ['en']
    set({
      data,
      hasData: true,
      mutationCount: 0,
      activeSection: 'overview',
      primaryLocale: locales.includes('no') ? 'no' : locales[0],
      secondaryLocale: locales.includes('en') && locales[0] !== 'en' ? 'en'
        : (locales.find(l => l !== (locales.includes('no') ? 'no' : locales[0])) || null),
    })
  },

  loadStore: (store) => {
    const locales = store.resume?.supported_locales || ['en']
    set({
      data: store, hasData: true,
      mutationCount: 0,
      primaryLocale: locales[0],
      secondaryLocale: locales[1] || null,
    })
  },

  startFresh: () => {
    const now = new Date().toISOString()
    const freshStore: ResumeStore = {
      resume: {
        id: uuidv4(),
        full_name: '',
        email: '',
        phone: null,
        title: {},
        nationality: {},
        place_of_residence: {},
        date_of_birth: null,
        twitter: null,
        linkedin_url: null,
        website_url: null,
        profile_image_url: null,
        default_locale: 'en',
        supported_locales: ['en'],
        created_at: now,
        updated_at: now,
      },
      skills: [], roles: [], key_qualifications: [], projects: [],
      work_experiences: [], educations: [], courses: [], certifications: [],
      spoken_languages: [], technology_categories: [], positions: [],
      presentations: [], honor_awards: [], publications: [], references: [],
      views: [],
    }
    set({
      data: freshStore,
      hasData: true,
      mutationCount: 0,
      activeSection: 'header',
      expandedItemId: null,
      primaryLocale: 'en',
      secondaryLocale: null,
    })
  },

  setActiveSection: (s) => set({ activeSection: s, expandedItemId: null }),
  setPrimaryLocale: (l) => set({ primaryLocale: l }),
  setSecondaryLocale: (l) => set({ secondaryLocale: l }),
  setExpandedItem: (id) => set((st) => ({ expandedItemId: st.expandedItemId === id ? null : id })),

  updateResume: (patch) => set((st) => {
    if (!st.data.resume) return {}
    return {
      data: {
        ...st.data,
        resume: { ...st.data.resume, ...patch, updated_at: new Date().toISOString() },
      },
      mutationCount: st.mutationCount + 1,
    }
  }),

  detectAndSetLocales: () => set((st) => {
    if (!st.data.resume) return {}
    const detected = detectLocalesInData(st.data)
    const merged   = sortLocales([...st.data.resume.supported_locales, ...detected, 'en'])
    if (merged.length === st.data.resume.supported_locales.length &&
        merged.every((l, i) => l === st.data.resume!.supported_locales[i])) {
      return {} // no-op
    }
    return {
      data: {
        ...st.data,
        resume: { ...st.data.resume, supported_locales: merged, updated_at: new Date().toISOString() },
      },
      mutationCount: st.mutationCount + 1,
    }
  }),

  updateItem: (section, id, patch) => set((st) => {
    const arr = st.data[section] as Array<{ id: string }>
    const next = arr.map((it) => (it.id === id ? { ...it, ...patch } : it))
    return { data: { ...st.data, [section]: next }, mutationCount: st.mutationCount + 1 }
  }),

  addItem: (section, item) => set((st) => {
    const arr = st.data[section] as Array<unknown>
    return {
      data: { ...st.data, [section]: [...arr, item] },
      expandedItemId: (item as { id: string }).id,
      mutationCount: st.mutationCount + 1,
    }
  }),

  removeItem: (section, id) => set((st) => {
    const arr = st.data[section] as Array<{ id: string }>
    return { data: { ...st.data, [section]: arr.filter((it) => it.id !== id) }, mutationCount: st.mutationCount + 1 }
  }),

  reorderItem: (section, id, direction) => set((st) => {
    const arr = [...(st.data[section] as Array<{ id: string; sort_order: number }>)]
    const idx = arr.findIndex((it) => it.id === id)
    if (idx === -1) return {}
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= arr.length) return {}
    ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
    arr.forEach((it, i) => { it.sort_order = i })
    return { data: { ...st.data, [section]: arr }, mutationCount: st.mutationCount + 1 }
  }),
}))

// ─── Helpers for components ────────────────────────────────────────────────────

export function emptyLocalized(): LocalizedString { return {} }

export function newId(): string { return uuidv4() }
