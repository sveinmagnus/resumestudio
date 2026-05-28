import type { ResumeStore, YearMonth, Duration } from '../types'

// ─── Duration math ──────────────────────────────────────────────────────────

/** Total months between two YearMonth points (end defaults to now if null). */
export function monthsBetween(start: YearMonth | null, end: YearMonth | null): number {
  if (!start) return 0
  const sM = start.month ?? 1
  const startTotal = start.year * 12 + (sM - 1)

  let endYear: number, endMonth: number
  if (end) {
    endYear = end.year
    endMonth = end.month ?? 12
  } else {
    const now = new Date()
    endYear = now.getFullYear()
    endMonth = now.getMonth() + 1
  }
  const endTotal = endYear * 12 + (endMonth - 1)
  return Math.max(0, endTotal - startTotal + 1) // inclusive of start month
}

export function durationToMonths(d: Duration): number {
  return d.years * 12 + d.months
}

export function monthsToDuration(totalMonths: number): Duration {
  const m = Math.max(0, Math.round(totalMonths))
  return { years: Math.floor(m / 12), months: m % 12 }
}

/** Human-readable e.g. "3 yr 7 mo", "11 mo", "2 yr". */
export function formatMonths(totalMonths: number): string {
  const m = Math.max(0, Math.round(totalMonths))
  const y = Math.floor(m / 12)
  const mo = m % 12
  if (y === 0 && mo === 0) return '0 mo'
  const parts: string[] = []
  if (y > 0) parts.push(`${y} yr`)
  if (mo > 0) parts.push(`${mo} mo`)
  return parts.join(' ')
}

export function formatDuration(d: Duration): string {
  return formatMonths(durationToMonths(d))
}

// ─── Contributing item ─────────────────────────────────────────────────────

export interface ContributingItem {
  kind: 'project' | 'employment'
  id: string             // entity id (for linking back)
  label: string          // display name
  months: number         // duration contributed
}

export interface ComputedExperience {
  months: number                  // computed from items only (no offset)
  offsetMonths: number            // manual offset
  totalMonths: number             // months + offset
  items: ContributingItem[]
}

// ─── Engine ───────────────────────────────────────────────────────────────

/**
 * Compute total experience for a ROLE by id.
 * Scans both projects and employments that reference the role,
 * summing their durations. Overlapping periods are NOT deduplicated
 * (a consultant may hold two roles simultaneously — each counts).
 */
export function computeRoleExperience(
  data: ResumeStore,
  roleId: string,
  locale: string,
): ComputedExperience {
  const items: ContributingItem[] = []

  for (const p of data.projects) {
    if (p.disabled) continue
    if (p.roles.some((r) => r.role_id === roleId && !r.disabled)) {
      items.push({
        kind: 'project',
        id: p.id,
        label: resolveLabel(p.customer, p.description, locale),
        months: monthsBetween(p.start, p.end),
      })
    }
  }
  for (const w of data.work_experiences) {
    if (w.disabled) continue
    if (w.roles.some((r) => r.role_id === roleId && !r.disabled)) {
      items.push({
        kind: 'employment',
        id: w.id,
        label: resolveLabel(w.employer, w.role_title, locale),
        months: monthsBetween(w.start, w.end),
      })
    }
  }

  const role = data.roles.find((r) => r.id === roleId)
  const offsetMonths = role ? durationToMonths(role.experience_offset) : 0
  const months = items.reduce((sum, it) => sum + it.months, 0)
  return { months, offsetMonths, totalMonths: months + offsetMonths, items }
}

/**
 * Compute total experience for a SKILL by id.
 * Scans both projects and employments that use the skill.
 */
export function computeSkillExperience(
  data: ResumeStore,
  skillId: string,
  locale: string,
): ComputedExperience {
  const items: ContributingItem[] = []

  for (const p of data.projects) {
    if (p.disabled) continue
    if (p.skills.some((s) => s.skill_id === skillId)) {
      items.push({
        kind: 'project',
        id: p.id,
        label: resolveLabel(p.customer, p.description, locale),
        months: monthsBetween(p.start, p.end),
      })
    }
  }
  for (const w of data.work_experiences) {
    if (w.disabled) continue
    if (w.skills.some((s) => s.skill_id === skillId)) {
      items.push({
        kind: 'employment',
        id: w.id,
        label: resolveLabel(w.employer, w.role_title, locale),
        months: monthsBetween(w.start, w.end),
      })
    }
  }

  const skill = data.skills.find((s) => s.id === skillId)
  const offsetMonths = skill ? durationToMonths(skill.experience_offset) : 0
  const months = items.reduce((sum, it) => sum + it.months, 0)
  return { months, offsetMonths, totalMonths: months + offsetMonths, items }
}

function resolveLabel(a: Record<string, string>, b: Record<string, string>, locale: string): string {
  const pick = (ls: Record<string, string>) => ls[locale] || ls.en || Object.values(ls)[0] || ''
  return pick(a) || pick(b) || 'Untitled'
}
