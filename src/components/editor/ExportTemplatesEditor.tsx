import { useStore, newId } from '../../store/useStore'
import { TextField } from '../ui/Fields'
import { DualField } from '../ui/DualField'
import { EditorCard, AddButton, FieldRow } from '../ui/EditorCard'
import { SECTION_CATALOG, FONT_CHOICES, defaultTemplateSections } from '../../lib/templateCatalog'
import type { ExportTemplate, TemplateSection } from '../../types'
import { ArrowUp, ArrowDown, Eye, EyeOff, Download, FileDown } from 'lucide-react'
import { exportDocx, exportPdf } from '../../lib/exporter'

export function ExportTemplatesEditor() {
  const { data, addItem, updateItem, primaryLocale, secondaryLocale } = useStore()
  const items = [...data.export_templates].sort((a, b) => a.name.localeCompare(b.name))

  const add = () => {
    const now = new Date().toISOString()
    const t: ExportTemplate = {
      id: newId(), resume_id: data.resume!.id,
      name: 'New template',
      format: 'both', page_size: 'A4',
      accent_color: '#8a2b2e',
      heading_font: 'DM Serif Display',
      body_font: 'DM Sans',
      font_size: 11,
      show_photo: false,
      date_style: 'monthYear',
      sections: defaultTemplateSections(),
      created_at: now, updated_at: now,
    }
    addItem('export_templates', t)
  }

  return (
    <div className="section-pane">
      <p className="registry-note">
        Design reusable templates for .docx and .pdf export. Pick which sections and
        fields to include, reorder them, and set basic styling.
      </p>
      {items.map((t) => (
        <EditorCard key={t.id} section="export_templates" id={t.id}
          title={t.name || 'Untitled template'}
          subtitle={`${t.format.toUpperCase()} · ${t.page_size}`}
          meta={`${t.sections.filter((s) => s.enabled).length}/${t.sections.length} sections`}
          canStar={false} canDisable={false}>

          <TemplateBasics template={t} />
          <TemplateStyling template={t} />
          <TemplateSections template={t} />
          <TemplateExportActions template={t} />
        </EditorCard>
      ))}
      <AddButton label="Add export template" onClick={add} />
      <style>{`
        .registry-note { font-size: 13.5px; color: var(--ink-soft); background: var(--paper-sunken); padding: 11px 15px; border-radius: var(--r-md); margin-bottom: 16px; border-left: 3px solid var(--accent); }
      `}</style>
    </div>
  )
}

// ── Basics: name, format, page size ─────────────────────────────────────────

function TemplateBasics({ template: t }: { template: ExportTemplate }) {
  const updateItem = useStore((s) => s.updateItem)
  return (
    <div className="tpl-block">
      <h4 className="tpl-block-title">Basics</h4>
      <FieldRow>
        <TextField label="Template name" value={t.name}
          onChange={(v) => updateItem('export_templates', t.id, { name: v })} />
        <div className="pf-wrap">
          <label className="pf-label">Output format</label>
          <select className="pf-input" value={t.format}
            onChange={(e) => updateItem('export_templates', t.id, { format: e.target.value as ExportTemplate['format'] })}>
            <option value="docx">.docx only</option>
            <option value="pdf">.pdf only</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="pf-wrap">
          <label className="pf-label">Page size</label>
          <select className="pf-input" value={t.page_size}
            onChange={(e) => updateItem('export_templates', t.id, { page_size: e.target.value as ExportTemplate['page_size'] })}>
            <option value="A4">A4</option>
            <option value="Letter">US Letter</option>
          </select>
        </div>
      </FieldRow>
    </div>
  )
}

// ── Styling controls ─────────────────────────────────────────────────────────

function TemplateStyling({ template: t }: { template: ExportTemplate }) {
  const updateItem = useStore((s) => s.updateItem)
  return (
    <div className="tpl-block">
      <h4 className="tpl-block-title">Styling</h4>
      <FieldRow>
        <div className="pf-wrap">
          <label className="pf-label">Heading font</label>
          <select className="pf-input" value={t.heading_font}
            onChange={(e) => updateItem('export_templates', t.id, { heading_font: e.target.value })}
            style={{ fontFamily: t.heading_font }}>
            {FONT_CHOICES.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
          </select>
        </div>
        <div className="pf-wrap">
          <label className="pf-label">Body font</label>
          <select className="pf-input" value={t.body_font}
            onChange={(e) => updateItem('export_templates', t.id, { body_font: e.target.value })}
            style={{ fontFamily: t.body_font }}>
            {FONT_CHOICES.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
          </select>
        </div>
        <div className="pf-wrap">
          <label className="pf-label">Body font size (pt)</label>
          <input className="pf-input" type="number" min={8} max={16} value={t.font_size}
            onChange={(e) => updateItem('export_templates', t.id, { font_size: parseInt(e.target.value) || 11 })} />
        </div>
      </FieldRow>
      <FieldRow>
        <div className="pf-wrap">
          <label className="pf-label">Accent colour</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={t.accent_color}
              onChange={(e) => updateItem('export_templates', t.id, { accent_color: e.target.value })}
              style={{ width: 44, height: 38, border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
            <input className="pf-input" value={t.accent_color}
              onChange={(e) => updateItem('export_templates', t.id, { accent_color: e.target.value })}
              style={{ flex: 1 }} />
          </div>
        </div>
        <div className="pf-wrap">
          <label className="pf-label">Date style</label>
          <select className="pf-input" value={t.date_style}
            onChange={(e) => updateItem('export_templates', t.id, { date_style: e.target.value as ExportTemplate['date_style'] })}>
            <option value="monthYear">Mar 2021</option>
            <option value="yearOnly">2021</option>
          </select>
        </div>
        <label className="check-row" style={{ marginTop: 24 }}>
          <input type="checkbox" checked={t.show_photo}
            onChange={(e) => updateItem('export_templates', t.id, { show_photo: e.target.checked })} />
          Include profile photo
        </label>
      </FieldRow>
    </div>
  )
}

// ── Sections: ordering, field selection ─────────────────────────────────────

function TemplateSections({ template: t }: { template: ExportTemplate }) {
  const updateItem = useStore((s) => s.updateItem)

  const updateSection = (idx: number, patch: Partial<TemplateSection>) => {
    const next = t.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    updateItem('export_templates', t.id, { sections: next })
  }
  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= t.sections.length) return
    const next = [...t.sections]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    updateItem('export_templates', t.id, { sections: next })
  }
  const toggleField = (idx: number, fieldKey: string) => {
    const sec = t.sections[idx]
    const next = sec.fields.includes(fieldKey)
      ? sec.fields.filter((f) => f !== fieldKey)
      : [...sec.fields, fieldKey]
    updateSection(idx, { fields: next })
  }

  return (
    <div className="tpl-block">
      <h4 className="tpl-block-title">Sections & fields</h4>
      <p className="tpl-hint">Toggle visibility, reorder, customize headings, and choose which fields to include in each section.</p>
      <div className="tpl-sections">
        {t.sections.map((sec, idx) => {
          const cat = SECTION_CATALOG.find((c) => c.key === sec.key)
          if (!cat) return null
          return (
            <div key={sec.key} className={`tpl-section ${!sec.enabled ? 'is-off' : ''}`}>
              <div className="tpl-sec-head">
                <button className="tpl-sec-toggle" onClick={() => updateSection(idx, { enabled: !sec.enabled })}
                  title={sec.enabled ? 'Hide section' : 'Show section'}>
                  {sec.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <div className="tpl-sec-label">{cat.label}</div>
                <div className="tpl-sec-actions">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up"><ArrowUp size={14} /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === t.sections.length - 1} title="Move down"><ArrowDown size={14} /></button>
                </div>
              </div>
              {sec.enabled && (
                <div className="tpl-sec-body">
                  <DualField label="Custom heading (optional)" value={sec.heading || {}}
                    onChange={(v) => updateSection(idx, { heading: Object.keys(v).length ? v : null })}
                    placeholder={cat.label} />
                  <div className="tpl-fields-label">Fields to include</div>
                  <div className="tpl-fields">
                    {cat.fields.map((f) => (
                      <label key={f.key} className={`tpl-field-chip ${sec.fields.includes(f.key) ? 'on' : ''}`}>
                        <input type="checkbox" checked={sec.fields.includes(f.key)}
                          onChange={() => toggleField(idx, f.key)} />
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <style>{`
        .tpl-hint { font-size: 13px; color: var(--ink-faint); margin-bottom: 12px; }
        .tpl-sections { display: flex; flex-direction: column; gap: 8px; }
        .tpl-section { background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
        .tpl-section.is-off { opacity: .55; background: var(--paper-sunken); }
        .tpl-sec-head { display: flex; align-items: center; gap: 10px; padding: 9px 12px; }
        .tpl-sec-toggle { width: 30px; height: 30px; display: grid; place-items: center; color: var(--ink-soft); border-radius: var(--r-sm); }
        .tpl-sec-toggle:hover { background: var(--paper-sunken); color: var(--ink); }
        .tpl-section:not(.is-off) .tpl-sec-toggle { color: var(--accent); }
        .tpl-sec-label { flex: 1; font-weight: 600; font-size: 14px; }
        .tpl-sec-actions { display: flex; gap: 2px; }
        .tpl-sec-actions button { width: 28px; height: 28px; display: grid; place-items: center; color: var(--ink-faint); border-radius: var(--r-sm); }
        .tpl-sec-actions button:hover:not(:disabled) { background: var(--paper-sunken); color: var(--ink); }
        .tpl-sec-actions button:disabled { opacity: .3; cursor: default; }
        .tpl-sec-body { padding: 4px 14px 14px; border-top: 1px solid var(--line); }
        .tpl-fields-label { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-faint); margin: 8px 0 8px; }
        .tpl-fields { display: flex; flex-wrap: wrap; gap: 6px; }
        .tpl-field-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; background: var(--paper-sunken); border: 1px solid var(--line); border-radius: 20px; font-size: 12.5px; cursor: pointer; transition: all .13s; }
        .tpl-field-chip:hover { border-color: var(--line-strong); }
        .tpl-field-chip.on { background: var(--accent-wash); border-color: var(--accent); color: var(--accent); font-weight: 500; }
        .tpl-field-chip input { display: none; }
      `}</style>
    </div>
  )
}

// ── Export actions ───────────────────────────────────────────────────────────

function TemplateExportActions({ template: t }: { template: ExportTemplate }) {
  const data = useStore((s) => s.data)
  const primaryLocale = useStore((s) => s.primaryLocale)

  const doExport = async (format: 'docx' | 'pdf') => {
    try {
      if (format === 'docx') await exportDocx(data, t, primaryLocale)
      else await exportPdf(data, t, primaryLocale)
    } catch (e) {
      alert(`Export failed: ${(e as Error).message}`)
      console.error(e)
    }
  }

  return (
    <div className="tpl-block tpl-actions">
      <h4 className="tpl-block-title">Export</h4>
      <p className="tpl-hint" style={{ marginBottom: 12 }}>
        Generates the resume using this template, in the current primary language ({primaryLocale}).
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(t.format === 'docx' || t.format === 'both') && (
          <button className="tpl-export-btn" onClick={() => doExport('docx')}>
            <FileDown size={16} /> Export .docx
          </button>
        )}
        {(t.format === 'pdf' || t.format === 'both') && (
          <button className="tpl-export-btn alt" onClick={() => doExport('pdf')}>
            <Download size={16} /> Export .pdf
          </button>
        )}
      </div>
      <style>{`
        .tpl-export-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; background: var(--ink); color: var(--paper); border-radius: var(--r-md); font-weight: 600; font-size: 14px; }
        .tpl-export-btn:hover { background: var(--accent); }
        .tpl-export-btn.alt { background: var(--accent); }
        .tpl-export-btn.alt:hover { background: var(--accent-bright); }
        .tpl-block { margin-bottom: 22px; }
        .tpl-block-title { font-size: 14px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 12px; padding-bottom: 5px; border-bottom: 1px solid var(--line); }
        .tpl-hint { font-size: 13px; color: var(--ink-faint); }
        .check-row { display: flex; align-items: center; gap: 9px; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
        .check-row input { width: 16px; height: 16px; accent-color: var(--accent); }
      `}</style>
    </div>
  )
}
