import { useStore } from '../../store/useStore'
import { LOCALE_LABELS, resolve } from '../../lib/locales'
import type { LocalizedString } from '../../types'

export function Overview() {
  const { data, setActiveSection } = useStore()
  const locales = data.resume?.supported_locales || ['en']

  const stats = [
    { label: 'Projects', count: data.projects.length, key: 'projects' },
    { label: 'Employment', count: data.work_experiences.length, key: 'work_experiences' },
    { label: 'Education', count: data.educations.length, key: 'educations' },
    { label: 'Courses', count: data.courses.length, key: 'courses' },
    { label: 'Certifications', count: data.certifications.length, key: 'certifications' },
    { label: 'Skills', count: data.skills.length, key: 'skills' },
    { label: 'Roles', count: data.roles.length, key: 'roles' },
    { label: 'Languages', count: data.spoken_languages.length, key: 'spoken_languages' },
  ]

  // translation completeness: scan all localized fields
  const completeness = computeCompleteness(data, locales)

  return (
    <div className="section-pane">
      <div className="ov-hero">
        <div>
          <h2 className="ov-name">{data.resume?.full_name}</h2>
          <p className="ov-title">{resolve(data.resume?.title, locales[0])}</p>
        </div>
      </div>

      <div className="ov-grid">
        {stats.map((s) => (
          <button key={s.key} className="ov-stat" onClick={() => setActiveSection(s.key)}>
            <div className="ov-stat-count">{s.count}</div>
            <div className="ov-stat-label">{s.label}</div>
          </button>
        ))}
      </div>

      <h3 className="ov-section-title">Translation completeness</h3>
      <div className="ov-trans">
        {locales.map((l) => {
          const pct = completeness[l] || 0
          return (
            <div key={l} className="ov-trans-row">
              <div className="ov-trans-label">{LOCALE_LABELS[l]?.flag} {LOCALE_LABELS[l]?.name || l}</div>
              <div className="ov-trans-bar"><div className="ov-trans-fill" style={{ width: `${pct}%` }} /></div>
              <div className="ov-trans-pct">{pct}%</div>
            </div>
          )
        })}
      </div>

      <style>{`
        .ov-hero { margin-bottom: 28px; }
        .ov-name { font-size: 38px; }
        .ov-title { color: var(--ink-soft); font-size: 17px; margin-top: 2px; }
        .ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-bottom: 36px; }
        .ov-stat {
          background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--r-md);
          padding: 18px; text-align: left; transition: all .15s;
        }
        .ov-stat:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .ov-stat-count { font-family: var(--serif); font-size: 32px; color: var(--accent); line-height: 1; }
        .ov-stat-label { font-size: 13px; color: var(--ink-soft); margin-top: 6px; }
        .ov-section-title { font-size: 22px; margin-bottom: 16px; }
        .ov-trans { display: flex; flex-direction: column; gap: 12px; max-width: 560px; }
        .ov-trans-row { display: flex; align-items: center; gap: 14px; }
        .ov-trans-label { width: 110px; font-size: 14px; font-weight: 500; }
        .ov-trans-bar { flex: 1; height: 9px; background: var(--paper-sunken); border-radius: 5px; overflow: hidden; }
        .ov-trans-fill { height: 100%; background: var(--accent); border-radius: 5px; transition: width .5s ease; }
        .ov-trans-pct { width: 42px; text-align: right; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  )
}

function computeCompleteness(data: ReturnType<typeof useStore.getState>['data'], locales: string[]): Record<string, number> {
  const result: Record<string, number> = {}
  const fields: LocalizedString[] = []

  const collect = (ls: LocalizedString | undefined) => { if (ls && Object.keys(ls).length) fields.push(ls) }

  if (data.resume) { collect(data.resume.title); collect(data.resume.nationality); collect(data.resume.place_of_residence) }
  data.key_qualifications.forEach((k) => { collect(k.summary); collect(k.tag_line) })
  data.projects.forEach((p) => { collect(p.customer); collect(p.description); collect(p.long_description) })
  data.work_experiences.forEach((w) => { collect(w.employer); collect(w.long_description) })
  data.educations.forEach((e) => { collect(e.school); collect(e.degree) })
  data.courses.forEach((c) => collect(c.name))
  data.certifications.forEach((c) => collect(c.name))

  for (const l of locales) {
    if (fields.length === 0) { result[l] = 100; continue }
    const present = fields.filter((f) => f[l] && f[l].trim()).length
    result[l] = Math.round((present / fields.length) * 100)
  }
  return result
}
