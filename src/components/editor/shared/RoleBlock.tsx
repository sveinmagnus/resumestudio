import { useStore, newId } from '../../../store/useStore'
import { DualField } from '../../ui/DualField'
import { resolve } from '../../../lib/locales'
import type { Project, WorkExperience, ProjectRole } from '../../../types'
import { Plus, X } from 'lucide-react'

type HasRoles = Project | WorkExperience
type Section = 'projects' | 'work_experiences'

/**
 * Per-role editor: each role links to the shared registry and has its own
 * description. Roles are displayed stacked so they read as one flowing block.
 */
export function RoleBlock({ section, entity }: { section: Section; entity: HasRoles }) {
  const { data, updateItem, primaryLocale } = useStore()

  const setRoles = (roles: ProjectRole[]) => updateItem(section, entity.id, { roles } as never)

  const update = (rid: string, patch: Partial<ProjectRole>) =>
    setRoles(entity.roles.map((r) => (r.id === rid ? { ...r, ...patch } : r)))

  const add = () => {
    const role: ProjectRole = {
      id: newId(), role_id: '', name: {}, long_description: {}, summary: {},
      sort_order: entity.roles.length, disabled: false,
    }
    setRoles([...entity.roles, role])
  }
  const remove = (rid: string) => setRoles(entity.roles.filter((r) => r.id !== rid))

  return (
    <div className="role-block">
      <div className="rb-head">Roles &amp; responsibilities</div>
      {entity.roles.map((role) => (
        <div key={role.id} className="role-item">
          <div className="role-top">
            <select className="role-select" value={role.role_id}
              onChange={(e) => {
                const reg = data.roles.find((x) => x.id === e.target.value)
                update(role.id, { role_id: e.target.value, name: reg ? reg.name : role.name })
              }}>
              <option value="">— select role from registry —</option>
              {[...data.roles].sort((a, b) => resolve(a.name, primaryLocale).localeCompare(resolve(b.name, primaryLocale)))
                .map((r) => <option key={r.id} value={r.id}>{resolve(r.name, primaryLocale)}</option>)}
            </select>
            <button className="role-del" onClick={() => remove(role.id)} title="Remove role"><X size={15} /></button>
          </div>
          {!role.role_id && (
            <div className="role-warn">Not linked to registry — won't count toward role experience. Pick a role above or add one in the Role Registry.</div>
          )}
          <DualField label="What was done in this role" value={role.long_description}
            onChange={(v) => update(role.id, { long_description: v })} multiline rows={3} />
        </div>
      ))}
      <button className="rb-add" onClick={add}><Plus size={13} /> Add role</button>

      <style>{`
        .role-block { margin-top: 4px; }
        .rb-head { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
        .role-item { background: var(--paper-raised); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: var(--r-sm); padding: 12px; margin-bottom: 10px; }
        .role-top { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
        .role-select { flex: 1; padding: 8px 11px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--paper); font-weight: 600; }
        .role-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-wash); }
        .role-del { width: 32px; height: 34px; display: grid; place-items: center; color: var(--ink-faint); border-radius: var(--r-sm); flex-shrink: 0; }
        .role-del:hover { background: var(--accent-wash); color: var(--accent); }
        .role-warn { font-size: 12px; color: var(--accent); background: var(--accent-wash); padding: 6px 9px; border-radius: var(--r-sm); margin-bottom: 10px; }
        .rb-add { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; font-size: 13px; font-weight: 600; color: var(--accent); border-radius: var(--r-sm); border: 1px dashed var(--line-strong); }
        .rb-add:hover { background: var(--accent-wash); border-color: var(--accent); }
      `}</style>
    </div>
  )
}
