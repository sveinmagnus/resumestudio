import { useStore } from '../../../store/useStore'
import { formatMonths, type ComputedExperience } from '../../../lib/experience'
import type { Duration } from '../../../types'
import { Briefcase, Building2, ExternalLink } from 'lucide-react'

interface Props {
  exp: ComputedExperience
  offset: Duration
  onOffsetChange: (d: Duration) => void
}

export function ExperiencePanel({ exp, offset, onOffsetChange }: Props) {
  const navigateToItem = useStore((s) => s.navigateToItem)

  return (
    <div className="exp-panel">
      <div className="exp-totals">
        <div className="exp-total-main">
          <div className="exp-total-val">{formatMonths(exp.totalMonths)}</div>
          <div className="exp-total-label">total experience</div>
        </div>
        <div className="exp-breakdown">
          <div className="exp-bd-row">
            <span>From {exp.items.length} item{exp.items.length === 1 ? '' : 's'}</span>
            <strong>{formatMonths(exp.months)}</strong>
          </div>
          <div className="exp-bd-row">
            <span>Manual offset</span>
            <strong>{exp.offsetMonths >= 0 ? '+' : ''}{formatMonths(exp.offsetMonths)}</strong>
          </div>
        </div>
      </div>

      <div className="exp-offset">
        <label className="exp-offset-label">Manual offset (added to computed total)</label>
        <div className="exp-offset-inputs">
          <div className="exp-num">
            <input type="number" value={offset.years || 0}
              onChange={(e) => onOffsetChange({ ...offset, years: parseInt(e.target.value) || 0 })} />
            <span>years</span>
          </div>
          <div className="exp-num">
            <input type="number" min={0} max={11} value={offset.months || 0}
              onChange={(e) => onOffsetChange({ ...offset, months: parseInt(e.target.value) || 0 })} />
            <span>months</span>
          </div>
        </div>
      </div>

      {exp.items.length > 0 && (
        <div className="exp-items">
          <div className="exp-items-head">Contributing experience</div>
          {exp.items.map((it) => (
            <button key={`${it.kind}-${it.id}`} className="exp-item"
              onClick={() => navigateToItem(it.kind === 'project' ? 'projects' : 'work_experiences', it.id)}>
              {it.kind === 'project' ? <Briefcase size={14} /> : <Building2 size={14} />}
              <span className="exp-item-label">{it.label}</span>
              <span className="exp-item-dur">{formatMonths(it.months)}</span>
              <ExternalLink size={13} className="exp-item-go" />
            </button>
          ))}
        </div>
      )}

      <style>{`
        .exp-panel { background: var(--paper-sunken); border-radius: var(--r-md); padding: 16px; margin: 4px 0 14px; }
        .exp-totals { display: flex; gap: 20px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
        .exp-total-main { padding-right: 20px; border-right: 1px solid var(--line-strong); }
        .exp-total-val { font-family: var(--serif); font-size: 30px; color: var(--accent); line-height: 1; }
        .exp-total-label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-faint); margin-top: 4px; }
        .exp-breakdown { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 160px; }
        .exp-bd-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink-soft); }
        .exp-bd-row strong { font-variant-numeric: tabular-nums; color: var(--ink); }
        .exp-offset { margin-bottom: 14px; }
        .exp-offset-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 7px; }
        .exp-offset-inputs { display: flex; gap: 10px; }
        .exp-num { display: flex; align-items: center; gap: 6px; }
        .exp-num input { width: 64px; padding: 7px 9px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--paper-raised); }
        .exp-num input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-wash); }
        .exp-num span { font-size: 13px; color: var(--ink-soft); }
        .exp-items-head { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 8px; }
        .exp-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 11px; background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--r-sm); margin-bottom: 5px; text-align: left; transition: all .13s; }
        .exp-item:hover { border-color: var(--accent); background: #fff; }
        .exp-item svg { color: var(--ink-faint); flex-shrink: 0; }
        .exp-item-label { flex: 1; font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .exp-item-dur { font-size: 12.5px; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
        .exp-item-go { opacity: 0; }
        .exp-item:hover .exp-item-go { opacity: 1; color: var(--accent); }
      `}</style>
    </div>
  )
}
