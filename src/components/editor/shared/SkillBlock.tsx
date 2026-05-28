import { useStore, newId } from '../../../store/useStore'
import { resolve } from '../../../lib/locales'
import type { Project, WorkExperience, ProjectSkill } from '../../../types'
import { Plus, X } from 'lucide-react'

type HasSkills = Project | WorkExperience
type Section = 'projects' | 'work_experiences'

export function SkillBlock({ section, entity }: { section: Section; entity: HasSkills }) {
  const { data, updateItem, primaryLocale } = useStore()

  const setSkills = (skills: ProjectSkill[]) => updateItem(section, entity.id, { skills } as never)

  const add = () => {
    const s: ProjectSkill = { id: newId(), skill_id: '', name: {}, sort_order: entity.skills.length }
    setSkills([...entity.skills, s])
  }
  const remove = (sid: string) => setSkills(entity.skills.filter((s) => s.id !== sid))
  const link = (sid: string, skillId: string) => {
    const reg = data.skills.find((x) => x.id === skillId)
    setSkills(entity.skills.map((s) => (s.id === sid ? { ...s, skill_id: skillId, name: reg ? reg.name : s.name } : s)))
  }

  const sortedSkills = [...data.skills].sort((a, b) => resolve(a.name, primaryLocale).localeCompare(resolve(b.name, primaryLocale)))

  return (
    <div className="skill-block">
      <div className="sb2-head">Skills used <span className="sb2-hint">linked to registry — drives experience totals</span></div>
      <div className="skill-chips">
        {entity.skills.map((s) => (
          <div key={s.id} className={`skill-chip ${!s.skill_id ? 'unlinked' : ''}`}>
            <select value={s.skill_id} onChange={(e) => link(s.id, e.target.value)} className="skill-chip-sel">
              <option value="">{resolve(s.name, primaryLocale) || '— select —'}</option>
              {sortedSkills.map((reg) => <option key={reg.id} value={reg.id}>{resolve(reg.name, primaryLocale)}</option>)}
            </select>
            <button onClick={() => remove(s.id)}><X size={12} /></button>
          </div>
        ))}
      </div>
      <button className="sb2-add" onClick={add}><Plus size={13} /> Add skill</button>
      <style>{`
        .skill-block { margin: 16px 0; }
        .sb2-head { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
        .sb2-hint { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--ink-faint); }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px; }
        .skill-chip { display: inline-flex; align-items: center; background: var(--paper-raised); border: 1px solid var(--line); border-radius: 20px; padding: 2px 4px 2px 2px; }
        .skill-chip.unlinked { border-color: var(--accent); border-style: dashed; }
        .skill-chip-sel { border: none; background: none; padding: 4px 6px; font-size: 13px; font-weight: 500; max-width: 220px; }
        .skill-chip button { width: 20px; height: 20px; display: grid; place-items: center; color: var(--ink-faint); border-radius: 50%; }
        .skill-chip button:hover { background: var(--accent-wash); color: var(--accent); }
        .sb2-add { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; font-size: 13px; font-weight: 600; color: var(--accent); border-radius: var(--r-sm); }
        .sb2-add:hover { background: var(--accent-wash); }
      `}</style>
    </div>
  )
}
