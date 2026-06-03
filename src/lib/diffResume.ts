/**
 * PURE: summarise the difference between two ResumeStores for the conflict
 * resolution panel. Not a merge engine — just "what changed", enough for the
 * user to choose keep-mine vs discard-mine with their eyes open.
 *
 * Sections (the top-level arrays) are diffed by item `id`: added / removed /
 * changed counts. The profile (`resume`) gets field-level diffs on the handful
 * of fields a consultant would notice. Localized fields are reduced to a
 * representative string (first non-empty value) so the panel stays readable
 * without needing a locale.
 */

import type { ResumeStore, LocalizedString } from '../types'

export interface SectionDiff {
  section: string
  added: number
  removed: number
  changed: number
}

export interface FieldDiff {
  field: string
  mine: string
  theirs: string
}

export interface ResumeDiff {
  identical: boolean
  sections: SectionDiff[]
  profileFields: FieldDiff[]
}

/** Every diffable array section, with a human label for the panel. */
const SECTION_LABELS: Record<string, string> = {
  skills: 'Skills',
  roles: 'Roles',
  key_qualifications: 'Key qualifications',
  projects: 'Projects',
  work_experiences: 'Work experience',
  educations: 'Education',
  courses: 'Courses',
  certifications: 'Certifications',
  spoken_languages: 'Languages',
  technology_categories: 'Technology categories',
  positions: 'Positions',
  presentations: 'Presentations',
  honor_awards: 'Awards',
  publications: 'Publications',
  references: 'References',
  views: 'Resume views',
}

/** Profile fields worth surfacing, with labels. */
const PROFILE_FIELDS: { key: keyof import('../types').Resume; label: string }[] = [
  { key: 'full_name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'title', label: 'Title' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'place_of_residence', label: 'Place of residence' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'website_url', label: 'Website' },
]

/** Reduce a string | null | LocalizedString to a representative display string. */
function display(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    for (const v of Object.values(value as LocalizedString)) {
      if (typeof v === 'string' && v.trim() !== '') return v
    }
  }
  return ''
}

interface Identified { id: string }

function diffSection(mine: Identified[], theirs: Identified[]): Omit<SectionDiff, 'section'> {
  const mineById = new Map(mine.map((x) => [x.id, x]))
  const theirsById = new Map(theirs.map((x) => [x.id, x]))
  let added = 0, removed = 0, changed = 0
  for (const [id, item] of mineById) {
    const other = theirsById.get(id)
    if (!other) added++
    else if (JSON.stringify(item) !== JSON.stringify(other)) changed++
  }
  for (const id of theirsById.keys()) {
    if (!mineById.has(id)) removed++
  }
  return { added, removed, changed }
}

/**
 * Diff `mine` against `theirs` ("theirs" = the server copy). Counts in the
 * result are framed from the local user's perspective: `added` = present
 * locally but not on the server, `removed` = on the server but gone locally.
 */
export function diffStores(mine: ResumeStore, theirs: ResumeStore): ResumeDiff {
  const sections: SectionDiff[] = []
  for (const key of Object.keys(SECTION_LABELS)) {
    const a = (mine[key as keyof ResumeStore] ?? []) as Identified[]
    const b = (theirs[key as keyof ResumeStore] ?? []) as Identified[]
    const d = diffSection(a, b)
    if (d.added || d.removed || d.changed) {
      sections.push({ section: SECTION_LABELS[key], ...d })
    }
  }

  const profileFields: FieldDiff[] = []
  const mr = mine.resume
  const tr = theirs.resume
  for (const { key, label } of PROFILE_FIELDS) {
    const a = display(mr ? mr[key] : null)
    const b = display(tr ? tr[key] : null)
    if (a !== b) profileFields.push({ field: label, mine: a, theirs: b })
  }

  return {
    identical: sections.length === 0 && profileFields.length === 0,
    sections,
    profileFields,
  }
}
