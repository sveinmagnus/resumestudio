import { useStore } from '../../store/useStore'
import type { LocalizedString } from '../../types'
import { LOCALE_LABELS } from '../../lib/locales'

interface DualFieldProps {
  label: string
  value: LocalizedString
  onChange: (next: LocalizedString) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
}

/**
 * Renders a single logical field as two side-by-side inputs:
 * primary language (left) and secondary language (right).
 * If no secondary language is selected, only the primary input shows.
 */
export function DualField({ label, value, onChange, multiline, rows = 3, placeholder }: DualFieldProps) {
  const primary = useStore((s) => s.primaryLocale)
  const secondary = useStore((s) => s.secondaryLocale)

  const set = (locale: string, text: string) => {
    const next = { ...value }
    if (text) next[locale] = text
    else delete next[locale]
    onChange(next)
  }

  const renderInput = (locale: string, variant: 'primary' | 'secondary') => {
    const v = value[locale] || ''
    const common = {
      value: v,
      placeholder: placeholder || `${LOCALE_LABELS[locale]?.name || locale}…`,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(locale, e.target.value),
      className: `df-input df-${variant}`,
    }
    return multiline
      ? <textarea {...common} rows={rows} />
      : <input {...common} type="text" />
  }

  return (
    <div className="df-wrap">
      <label className="df-label">{label}</label>
      <div className={`df-grid ${secondary ? 'df-dual' : 'df-single'}`}>
        <div className="df-col">
          <span className="df-locale-tag df-tag-primary">{LOCALE_LABELS[primary]?.flag} {LOCALE_LABELS[primary]?.name || primary}</span>
          {renderInput(primary, 'primary')}
        </div>
        {secondary && (
          <div className="df-col">
            <span className="df-locale-tag df-tag-secondary">{LOCALE_LABELS[secondary]?.flag} {LOCALE_LABELS[secondary]?.name || secondary}</span>
            {renderInput(secondary, 'secondary')}
          </div>
        )}
      </div>

      <style>{`
        .df-wrap { margin-bottom: 18px; animation: fadeIn .3s ease; }
        .df-label {
          display: block; font-size: 11px; font-weight: 600; letter-spacing: .08em;
          text-transform: uppercase; color: var(--ink-faint); margin-bottom: 7px;
        }
        .df-grid { display: grid; gap: 12px; }
        .df-dual { grid-template-columns: 1fr 1fr; }
        .df-single { grid-template-columns: 1fr; }
        .df-col { display: flex; flex-direction: column; gap: 4px; position: relative; }
        .df-locale-tag {
          font-size: 10px; font-weight: 600; letter-spacing: .04em;
          color: var(--ink-faint); display: flex; align-items: center; gap: 4px;
        }
        .df-tag-secondary { color: var(--secondary-ink); }
        .df-input {
          width: 100%; padding: 9px 11px; background: var(--paper-raised);
          border: 1px solid var(--line); border-radius: var(--r-sm);
          transition: border-color .15s, box-shadow .15s, background .15s;
          resize: vertical; line-height: 1.45;
        }
        .df-input:focus {
          outline: none; border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-wash); background: #fff;
        }
        .df-secondary { background: var(--secondary-tint); border-color: var(--secondary-line); }
        .df-secondary:focus {
          border-color: var(--secondary-ink);
          box-shadow: 0 0 0 3px rgba(58,71,80,0.10);
        }
      `}</style>
    </div>
  )
}
