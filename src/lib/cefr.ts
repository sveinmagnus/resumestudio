/**
 * PURE: the Europass / CEFR self-assessment vocabulary — levels, skill
 * categories, and concise level descriptors — plus helpers to summarise a
 * language's per-category levels (deduped) for compact display.
 *
 * The descriptors here are short, factual summaries of the CEFR global scale
 * (Council of Europe) used as editor guidance — not the full copyrighted
 * self-assessment grid.
 */

import type { CefrLevel, CefrCategory } from '../types'

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const CEFR_CATEGORIES: Array<{ key: CefrCategory; label: string }> = [
  { key: 'listening', label: 'Listening' },
  { key: 'reading', label: 'Reading' },
  { key: 'spoken_interaction', label: 'Spoken interaction' },
  { key: 'spoken_production', label: 'Spoken production' },
  { key: 'writing', label: 'Writing' },
]

/** Short "band + descriptor" guidance per level (CEFR global scale). */
export const CEFR_LEVEL_DESC: Record<CefrLevel, string> = {
  A1: 'Basic user (Breakthrough) — simple phrases for immediate needs.',
  A2: 'Basic user (Waystage) — routine, simple everyday exchanges.',
  B1: 'Independent user (Threshold) — the main points on familiar matters.',
  B2: 'Independent user (Vantage) — fluent, spontaneous interaction.',
  C1: 'Proficient user (Effective operational proficiency) — flexible, complex use.',
  C2: 'Proficient user (Mastery) — effortless, precise and nuanced.',
}

export const CEFR_CATEGORY_LABEL: Record<CefrCategory, string> =
  Object.fromEntries(CEFR_CATEGORIES.map((c) => [c.key, c.label])) as Record<CefrCategory, string>

export type CefrMap = Partial<Record<CefrCategory, CefrLevel>>

/** True when at least one category has a level set. */
export function hasCefr(cefr: CefrMap | undefined): boolean {
  return !!cefr && CEFR_CATEGORIES.some((c) => cefr[c.key])
}

/**
 * Group the set categories by their level, in level order, keeping category
 * order within each group. Used for a deduped compact display, e.g.
 * `[{ level: 'B2', categories: ['Listening','Reading'] }, …]`.
 */
export function cefrGrouped(cefr: CefrMap | undefined): Array<{ level: CefrLevel; categories: string[] }> {
  if (!cefr) return []
  const out: Array<{ level: CefrLevel; categories: string[] }> = []
  for (const level of CEFR_LEVELS) {
    const cats = CEFR_CATEGORIES.filter((c) => cefr[c.key] === level).map((c) => c.label)
    if (cats.length) out.push({ level, categories: cats })
  }
  return out
}

/**
 * Compact one-line summary of the CEFR levels, deduped by level:
 *  - all categories the same level → "B2"
 *  - otherwise → "B2 (Listening, Reading) · C1 (Writing…)"
 */
export function cefrSummary(cefr: CefrMap | undefined): string {
  const groups = cefrGrouped(cefr)
  if (!groups.length) return ''
  const setCount = groups.reduce((n, g) => n + g.categories.length, 0)
  if (groups.length === 1 && setCount === CEFR_CATEGORIES.length) return groups[0].level
  return groups.map((g) => `${g.level} (${g.categories.join(', ')})`).join(' · ')
}

// ─── Europass skill groups ───────────────────────────────────────────────────

/**
 * The three groups the Europass language passport reports under — the five
 * assessed categories rolled up the way the grid presents them. Reading a CV,
 * "Understanding B2 · Spoken B2 · Written C1" is what a person wants; the
 * five-way split is detail for the editor.
 */
export const CEFR_GROUPS: Array<{ label: string; keys: CefrCategory[] }> = [
  { label: 'Understanding', keys: ['listening', 'reading'] },
  { label: 'Spoken', keys: ['spoken_interaction', 'spoken_production'] },
  { label: 'Written', keys: ['writing'] },
]

/**
 * The Europass levels as display LINES, grouped by understanding / spoken /
 * written:
 *
 *  - nothing set                    → `[]`
 *  - every set category at one level → `['B2']` — a single value needs no
 *    labels, and reads as one line wherever it lands
 *  - groups differ                   → one line each, e.g.
 *    `['Understanding: B2', 'Spoken: B2', 'Written: C1']`
 *  - a group's own categories differ → that group spells them out, e.g.
 *    `'Understanding: B1 (Listening) · B2 (Reading)'`
 *
 * A group with nothing set is omitted rather than shown blank.
 */
export function cefrLines(cefr: CefrMap | undefined): string[] {
  if (!hasCefr(cefr)) return []
  const set = cefr as CefrMap

  // One level across every category that's set → no labels needed.
  const levels = new Set(CEFR_CATEGORIES.map((c) => set[c.key]).filter(Boolean))
  if (levels.size === 1) return [[...levels][0] as string]

  const lines: string[] = []
  for (const group of CEFR_GROUPS) {
    const members = group.keys.filter((k) => set[k])
    if (!members.length) continue
    const groupLevels = new Set(members.map((k) => set[k]))
    const value = groupLevels.size === 1
      ? (set[members[0]] as string)
      // Within-group disagreement (e.g. reads better than they listen) —
      // spell out which category sits where rather than picking a winner.
      : CEFR_LEVELS
        .map((lvl) => {
          const cats = members.filter((k) => set[k] === lvl).map((k) => CEFR_CATEGORY_LABEL[k])
          return cats.length ? `${lvl} (${cats.join(', ')})` : ''
        })
        .filter(Boolean)
        .join(' · ')
    lines.push(`${group.label}: ${value}`)
  }
  return lines
}
