import { useStore } from '../../store/useStore'
import { resolve, fmtRange } from '../../lib/locales'
import { computeSkillExperience, formatMonths } from '../../lib/experience'
import { Star, Eye, EyeOff, Pencil } from 'lucide-react'

/**
 * Read-only overview of all projects with full descriptions and full skill
 * details. Click anywhere on a project to open it in edit mode.
 */
export function ProjectsOverview() {
  const { data, primaryLocale, setExpandedItem, setActiveSection } = useStore()
  const projects = [...data.projects].sort((a, b) => {
    const aD = a.start ? a.start.year * 12 + (a.start.month || 0) : 0
    const bD = b.start ? b.start.year * 12 + (b.start.month || 0) : 0
    return bD - aD
  })

  const openForEdit = (id: string) => {
    setActiveSection('projects')
    setExpandedItem(id)
    // scroll to the card after render
    setTimeout(() => {
      const el = document.querySelector(`[data-card-id="${id}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  return (
    <div className="po-wrap">
      <div className="po-intro">
        <h3>Project overview</h3>
        <p>Read-only view showing the full content of each project. Click any project to open it for editing.</p>
      </div>

      {projects.map((p) => {
        const customer = p.use_anonymized ? resolve(p.customer_anonymized, primaryLocale) : resolve(p.customer, primaryLocale)
        return (
          <div key={p.id} className={`po-card ${p.disabled ? 'is-off' : ''}`} onClick={() => openForEdit(p.id)}>
            <div className="po-card-head">
              <div>
                <div className="po-card-title">
                  {p.starred && <Star size={14} className="po-star" fill="currentColor" />}
                  {customer || resolve(p.description, primaryLocale) || 'Untitled project'}
                </div>
                <div className="po-card-sub">{resolve(p.description, primaryLocale)}</div>
              </div>
              <div className="po-card-meta">
                <div className="po-dates">{fmtRange(p.start, p.end)}</div>
                {p.disabled && <span className="po-pill"><EyeOff size={11} /> Hidden</span>}
                {!p.disabled && p.starred && <span className="po-pill on"><Star size={11} fill="currentColor" /> Featured</span>}
              </div>
              <button className="po-edit-btn" onClick={(e) => { e.stopPropagation(); openForEdit(p.id) }} title="Edit">
                <Pencil size={14} />
              </button>
            </div>

            <div className="po-card-body">
              {resolve(p.industry, primaryLocale) && (
                <div className="po-line"><span className="po-tag">Industry</span> {resolve(p.industry, primaryLocale)}</div>
              )}
              {(p.team_size || p.percent_allocated) && (
                <div className="po-line">
                  {p.team_size && <><span className="po-tag">Team</span> {p.team_size} people </>}
                  {p.percent_allocated && <><span className="po-tag">Allocation</span> {p.percent_allocated}%</>}
                </div>
              )}
              {resolve(p.long_description, primaryLocale) && (
                <div className="po-section">
                  <div className="po-section-label">Background</div>
                  <p className="po-prose">{resolve(p.long_description, primaryLocale)}</p>
                </div>
              )}
              {p.roles.length > 0 && (
                <div className="po-section">
                  <div className="po-section-label">Roles &amp; responsibilities</div>
                  {p.roles.filter((r) => !r.disabled).map((role) => (
                    <div key={role.id} className="po-role">
                      <div className="po-role-name">{resolve(role.name, primaryLocale) || '— unnamed role —'}</div>
                      {resolve(role.long_description, primaryLocale) && (
                        <p className="po-prose">{resolve(role.long_description, primaryLocale)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {p.highlights.length > 0 && (
                <div className="po-section">
                  <div className="po-section-label">Highlights</div>
                  <ul className="po-highlights">
                    {p.highlights.map((h, i) => {
                      const txt = resolve(h, primaryLocale)
                      return txt ? <li key={i}>{txt}</li> : null
                    })}
                  </ul>
                </div>
              )}
              {p.skills.length > 0 && (
                <div className="po-section">
                  <div className="po-section-label">Skills used</div>
                  <div className="po-skills">
                    {p.skills.map((s) => {
                      const exp = s.skill_id ? computeSkillExperience(data, s.skill_id, primaryLocale) : null
                      const linked = !!s.skill_id
                      return (
                        <span key={s.id} className={`po-skill ${linked ? '' : 'unlinked'}`}>
                          <strong>{resolve(s.name, primaryLocale) || '— unlinked —'}</strong>
                          {exp && exp.totalMonths > 0 && <span className="po-skill-exp">{formatMonths(exp.totalMonths)} total</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {p.skill_tags.length > 0 && (
                <div className="po-line po-line-tags">
                  <span className="po-tag">Tags</span>
                  {p.skill_tags.map((t) => <span key={t} className="po-skill-tag">{t}</span>)}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <style>{`
        .po-wrap { animation: fadeUp .3s ease; }
        .po-intro { margin-bottom: 18px; padding: 14px 16px; background: var(--paper-sunken); border-left: 3px solid var(--accent); border-radius: var(--r-md); }
        .po-intro h3 { font-size: 17px; margin-bottom: 4px; }
        .po-intro p { font-size: 13.5px; color: var(--ink-soft); }
        .po-card { position: relative; background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--r-md); margin-bottom: 14px; padding: 16px 20px; cursor: pointer; transition: all .15s; }
        .po-card:hover { border-color: var(--accent); box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .po-card.is-off { opacity: .5; }
        .po-card-head { display: flex; gap: 16px; align-items: flex-start; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--line); }
        .po-card-head > div:first-child { flex: 1; min-width: 0; }
        .po-card-title { font-family: var(--serif); font-size: 19px; line-height: 1.2; display: flex; align-items: center; gap: 7px; }
        .po-star { color: var(--gold); }
        .po-card-sub { font-size: 13.5px; color: var(--ink-soft); margin-top: 3px; }
        .po-card-meta { text-align: right; font-size: 13px; color: var(--ink-soft); white-space: nowrap; flex-shrink: 0; }
        .po-dates { font-variant-numeric: tabular-nums; font-weight: 500; }
        .po-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--paper-sunken); border-radius: 10px; font-size: 11px; font-weight: 600; margin-top: 5px; }
        .po-pill.on { color: var(--gold); }
        .po-edit-btn { width: 32px; height: 32px; display: grid; place-items: center; color: var(--ink-faint); border-radius: var(--r-sm); flex-shrink: 0; }
        .po-edit-btn:hover { background: var(--accent-wash); color: var(--accent); }
        .po-card-body { display: flex; flex-direction: column; gap: 11px; }
        .po-line { font-size: 13.5px; color: var(--ink-soft); display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; }
        .po-line-tags { flex-wrap: wrap; gap: 5px; }
        .po-tag { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-faint); margin-right: 4px; }
        .po-section { margin-top: 2px; }
        .po-section-label { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin-bottom: 5px; }
        .po-prose { font-size: 14px; line-height: 1.55; color: var(--ink); margin: 0 0 6px; white-space: pre-wrap; }
        .po-role { margin-bottom: 8px; }
        .po-role-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
        .po-highlights { margin: 0; padding-left: 20px; font-size: 14px; }
        .po-highlights li { margin: 3px 0; }
        .po-skills { display: flex; flex-wrap: wrap; gap: 6px; }
        .po-skill { display: inline-flex; align-items: baseline; gap: 5px; padding: 4px 10px; background: var(--paper-sunken); border: 1px solid var(--line); border-radius: 12px; font-size: 13px; }
        .po-skill.unlinked { border-color: var(--accent); border-style: dashed; color: var(--accent); }
        .po-skill-exp { font-size: 11px; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
        .po-skill-tag { display: inline-block; padding: 2px 8px; background: var(--accent-wash); color: var(--accent); border-radius: 10px; font-size: 11px; font-weight: 600; }
      `}</style>
    </div>
  )
}
