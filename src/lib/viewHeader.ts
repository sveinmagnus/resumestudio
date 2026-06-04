/**
 * View header & footer configuration — defaults and pure builders.
 *
 * The editor stores a ViewHeaderConfig / ViewFooterConfig on each ResumeView.
 * Both render paths (HTML/PDF via viewFilter, DOCX via exporter) consume the
 * output of the builders here so the header layout logic lives in one tested
 * place rather than being duplicated across renderers.
 *
 * Pure module — no React, no DOM.
 */

import type {
  ResumeStore, Resume, LocalizedString,
  ViewHeaderConfig, ViewFooterConfig, HeaderField, HeaderFieldKey,
} from '../types'
import { resolve } from './locales'

// ─── Defaults ───────────────────────────────────────────────────────────────

/**
 * Default descriptor labels per field, seeded in English + Norwegian (the
 * Cartavio working languages). Users can edit these per view, per locale.
 */
const DEFAULT_FIELD_LABELS: Record<HeaderFieldKey, LocalizedString> = {
  phone:         { en: 'Phone: ',       no: 'Telefon: ' },
  email:         { en: 'Email: ',       no: 'Epost: ' },
  location:      { en: 'Location: ',    no: 'Lokasjon: ' },
  nationality:   { en: 'Nationality: ', no: 'Nasjonalitet: ' },
  date_of_birth: { en: 'Born: ',        no: 'Født: ' },
  linkedin:      { en: 'LinkedIn: ',    no: 'LinkedIn: ' },
  website:       { en: 'Web: ',         no: 'Web: ' },
  twitter:       { en: 'Twitter: ',     no: 'Twitter: ' },
  languages:     { en: 'Languages: ',   no: 'Språk: ' },
}

/** Field display order + default visibility / line-grouping. */
const DEFAULT_FIELD_SPEC: Array<{ key: HeaderFieldKey; show: boolean; same_line: boolean }> = [
  { key: 'phone',         show: true,  same_line: false },
  { key: 'email',         show: true,  same_line: true  },
  { key: 'location',      show: true,  same_line: false },
  { key: 'languages',     show: true,  same_line: false },
  { key: 'nationality',   show: false, same_line: false },
  { key: 'date_of_birth', show: false, same_line: false },
  { key: 'linkedin',      show: false, same_line: false },
  { key: 'website',       show: false, same_line: true  },
  { key: 'twitter',       show: false, same_line: true  },
]

export function defaultHeaderFields(): HeaderField[] {
  return DEFAULT_FIELD_SPEC.map((spec, i) => ({
    key: spec.key,
    show: spec.show,
    label: { ...DEFAULT_FIELD_LABELS[spec.key] },
    same_line: spec.same_line,
    sort_order: i,
  }))
}

export const DEFAULT_VIEW_HEADER: ViewHeaderConfig = {
  fields: defaultHeaderFields(),
  separator: ' | ',
  name_style: { size_pt: null, font: 'condensed' },
  title_style: { size_pt: null, font: 'body' },
  photo_placement: 'none',
  photo_override: null,
  logo_placement: 'none',
  logo_override: null,
}

export const DEFAULT_VIEW_FOOTER: ViewFooterConfig = {
  separator: 'none',
  copyright: 'none',
  copyright_custom: {},
  note: {},
}

/**
 * Merge a possibly-undefined / partial header with defaults. Older serialized
 * views (backups, snapshots) may lack `header` entirely; this is the boundary
 * that guarantees renderers always see a populated config.
 */
export function withHeaderDefaults(header: Partial<ViewHeaderConfig> | undefined): ViewHeaderConfig {
  if (!header) return { ...DEFAULT_VIEW_HEADER, fields: defaultHeaderFields() }
  return {
    fields: header.fields && header.fields.length ? header.fields : defaultHeaderFields(),
    separator: header.separator ?? DEFAULT_VIEW_HEADER.separator,
    name_style: { ...DEFAULT_VIEW_HEADER.name_style, ...(header.name_style ?? {}) },
    title_style: { ...DEFAULT_VIEW_HEADER.title_style, ...(header.title_style ?? {}) },
    photo_placement: header.photo_placement ?? DEFAULT_VIEW_HEADER.photo_placement,
    photo_override: header.photo_override ?? null,
    logo_placement: header.logo_placement ?? DEFAULT_VIEW_HEADER.logo_placement,
    logo_override: header.logo_override ?? null,
  }
}

export function withFooterDefaults(footer: Partial<ViewFooterConfig> | undefined): ViewFooterConfig {
  if (!footer) return { ...DEFAULT_VIEW_FOOTER, copyright_custom: {}, note: {} }
  return {
    separator: footer.separator ?? DEFAULT_VIEW_FOOTER.separator,
    copyright: footer.copyright ?? DEFAULT_VIEW_FOOTER.copyright,
    copyright_custom: footer.copyright_custom ?? {},
    note: footer.note ?? {},
  }
}

// ─── Languages summary ────────────────────────────────────────────────────────

/**
 * Build a one-line summary of spoken languages, e.g.
 * "Norsk (morsmål), Engelsk (flytende), Tysk (grunnleggende)".
 * Disabled languages are skipped; items are taken in sort_order.
 */
export function buildLanguageSummary(store: ResumeStore, locale: string): string {
  const langs = [...store.spoken_languages]
    .filter((l) => !l.disabled)
    .sort((a, b) => a.sort_order - b.sort_order)
  return langs
    .map((l) => {
      const name = resolve(l.name, locale)
      const level = resolve(l.level, locale)
      if (!name) return ''
      return level ? `${name} (${level})` : name
    })
    .filter(Boolean)
    .join(', ')
}

// ─── Header line builder ────────────────────────────────────────────────────

/** Resolve the raw value for a single header field key. */
export function resolveHeaderFieldValue(
  key: HeaderFieldKey,
  resume: Resume,
  store: ResumeStore,
  locale: string,
): string {
  switch (key) {
    case 'phone':         return resume.phone ?? ''
    case 'email':         return resume.email ?? ''
    case 'location':      return resolve(resume.place_of_residence, locale)
    case 'nationality':   return resolve(resume.nationality, locale)
    case 'date_of_birth': return resume.date_of_birth ?? ''
    case 'linkedin':      return resume.linkedin_url ?? ''
    case 'website':       return resume.website_url ?? ''
    case 'twitter':       return resume.twitter ?? ''
    case 'languages':     return buildLanguageSummary(store, locale)
    default:              return ''
  }
}

export interface HeaderSegment {
  /** Resolved descriptor prefix (may be empty). */
  label: string
  /** Resolved field value (guaranteed non-empty — empty fields are dropped). */
  value: string
}

/** A header line is a list of segments rendered on one line, joined by the separator. */
export type HeaderLine = HeaderSegment[]

/**
 * Produce the ordered list of header lines for a view. Fields that are hidden
 * or resolve to an empty value are dropped. A field with `same_line: true`
 * appends to the previous line; otherwise it starts a new line. The first
 * surviving field always starts a new line.
 */
export function buildHeaderLines(
  header: ViewHeaderConfig,
  resume: Resume,
  store: ResumeStore,
  locale: string,
): HeaderLine[] {
  const ordered = [...header.fields].sort((a, b) => a.sort_order - b.sort_order)
  const lines: HeaderLine[] = []
  for (const field of ordered) {
    if (!field.show) continue
    const value = resolveHeaderFieldValue(field.key, resume, store, locale)
    if (!value) continue
    const segment: HeaderSegment = { label: resolve(field.label, locale), value }
    if (field.same_line && lines.length > 0) {
      lines[lines.length - 1].push(segment)
    } else {
      lines.push([segment])
    }
  }
  return lines
}

// ─── Footer ─────────────────────────────────────────────────────────────────

/**
 * Build the footer copyright line text (without the leading separator). The
 * holder is the resume's name, the company name, or a per-view custom string.
 * Returns '' when copyright is disabled or the resolved holder name is empty.
 */
export function buildCopyrightLine(
  footer: ViewFooterConfig,
  resume: Resume,
  year: number,
  locale: string,
): string {
  let name: string
  switch (footer.copyright) {
    case 'person':  name = resume.full_name ?? ''; break
    case 'company': name = resume.company_name ?? ''; break
    case 'custom':  name = resolve(footer.copyright_custom, locale); break
    default:        return ''
  }
  if (!name.trim()) return ''
  return `© ${year} ${name.trim()}`
}
