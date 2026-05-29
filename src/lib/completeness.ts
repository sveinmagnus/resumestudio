/**
 * Translation completeness — what percentage of translatable fields have
 * content in each supported locale.
 *
 * Pure function. Lives here (not in the component) so it can be tested and
 * so other consumers (e.g. an export warning, a CI check) can call it.
 */

import type { ResumeStore, LocalizedString } from '../types'

/**
 * For each requested locale, return the integer percentage (0–100) of
 * tracked LocalizedString fields that have a non-empty value in that locale.
 *
 * Tracked fields are the user-visible "primary" content fields — not every
 * single LocalizedString in the data. The set is intentionally curated so a
 * locale appearing 100% means the resume reads well in that language.
 *
 * Returns 100 for any locale when there are no tracked fields at all
 * (a fresh resume is trivially "complete").
 */
export function computeCompleteness(
  data: ResumeStore,
  locales: string[],
): Record<string, number> {
  const fields: LocalizedString[] = []
  const collect = (ls: LocalizedString | undefined) => {
    if (ls && Object.keys(ls).length) fields.push(ls)
  }

  if (data.resume) {
    collect(data.resume.title)
    collect(data.resume.nationality)
    collect(data.resume.place_of_residence)
  }
  data.key_qualifications.forEach((k) => { collect(k.summary); collect(k.tag_line) })
  data.projects.forEach((p) => { collect(p.customer); collect(p.description); collect(p.long_description) })
  data.work_experiences.forEach((w) => { collect(w.employer); collect(w.long_description) })
  data.educations.forEach((e) => { collect(e.school); collect(e.degree) })
  data.courses.forEach((c) => collect(c.name))
  data.certifications.forEach((c) => collect(c.name))

  const result: Record<string, number> = {}
  for (const l of locales) {
    if (fields.length === 0) {
      result[l] = 100
      continue
    }
    const present = fields.filter((f) => f[l] && f[l].trim()).length
    result[l] = Math.round((present / fields.length) * 100)
  }
  return result
}
