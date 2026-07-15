import { DualField } from '../../ui/DualField'
import type {
  ViewFooterConfig, FooterSeparator, CopyrightHolder, FooterNotePlacement,
} from '../../../types'
import { Select } from './Select'

// ─── View footer controls ────────────────────────────────────────────────────

export function ViewFooterControls({
  footer, hasCompany, onChange,
}: {
  footer: ViewFooterConfig
  hasCompany: boolean
  onChange: (patch: Partial<ViewFooterConfig>) => void
}) {
  return (
    <>
      <div className="rv-vs-grid">
        <Select<FooterSeparator>
          label="Closing separator"
          value={footer.separator}
          options={[
            ['none', 'None'],
            ['line', 'Thin line'],
            ['thick', 'Thick line'],
            ['double', 'Double line'],
            ['dotted', 'Dotted'],
            ['dashed', 'Dashed'],
          ]}
          onChange={(separator) => onChange({ separator })}
        />
        <Select<CopyrightHolder>
          label="Copyright statement"
          value={footer.copyright}
          options={[
            ['none', 'None'],
            ['person', 'Your name'],
            ['company', hasCompany ? 'Company name' : 'Company (not set)'],
            ['custom', 'Custom…'],
          ]}
          onChange={(copyright) => onChange({ copyright })}
        />
      </div>
      {footer.copyright === 'company' && !hasCompany && (
        <p className="rv-hdr-note" style={{ color: '#b45309' }}>
          No company name is set in Personal Details — the copyright line will be
          omitted until you add one.
        </p>
      )}
      {footer.copyright === 'custom' && (
        <div style={{ marginTop: 12 }}>
          <DualField
            label="Custom copyright holder (this view)"
            value={footer.copyright_custom}
            onChange={(copyright_custom) => onChange({ copyright_custom })}
            placeholder="e.g. Another Consultancy AS"
          />
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <DualField
          label="Footer note (optional)"
          value={footer.note}
          onChange={(note) => onChange({ note })}
          placeholder="e.g. Confidential — do not distribute"
        />
      </div>
      {/* Only meaningful once there's a note AND a copyright to place it
          against — with either missing it renders alone regardless. */}
      {hasNote(footer) && footer.copyright !== 'none' && (
        <div className="rv-vs-grid" style={{ marginTop: 12 }}>
          <Select<FooterNotePlacement>
            label="Note placement"
            value={footer.note_placement ?? 'after'}
            options={[
              ['after', 'After copyright (same line)'],
              ['before', 'Before copyright (same line)'],
              ['above', 'Above copyright (own line)'],
              ['below', 'Below copyright (own line)'],
            ]}
            onChange={(note_placement) => onChange({ note_placement })}
          />
        </div>
      )}
    </>
  )
}

/** True when the note has text in any language. */
function hasNote(footer: ViewFooterConfig): boolean {
  return Object.values(footer.note ?? {}).some((v) => (v ?? '').trim())
}
