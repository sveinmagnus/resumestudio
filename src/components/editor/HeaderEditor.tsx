import { useStore } from '../../store/useStore'
import { DualField } from '../ui/DualField'
import { TextField } from '../ui/Fields'

export function HeaderEditor() {
  const { data, updateResume } = useStore()
  const r = data.resume
  if (!r) return null

  return (
    <div className="section-pane">
      <div className="editor-block">
        <h3 className="eb-title">Identity</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <TextField label="Full name" value={r.full_name} onChange={(v) => updateResume({ full_name: v })} />
          <TextField label="Email" value={r.email} type="email" onChange={(v) => updateResume({ email: v })} />
          <TextField label="Phone" value={r.phone || ''} onChange={(v) => updateResume({ phone: v })} />
          <TextField label="Date of birth" value={r.date_of_birth || ''} type="date" onChange={(v) => updateResume({ date_of_birth: v })} />
        </div>
      </div>

      <div className="editor-block">
        <h3 className="eb-title">Professional</h3>
        <DualField label="Title" value={r.title} onChange={(v) => updateResume({ title: v })} placeholder="e.g. Technology Architect" />
        <DualField label="Nationality" value={r.nationality} onChange={(v) => updateResume({ nationality: v })} />
        <DualField label="Place of residence" value={r.place_of_residence} onChange={(v) => updateResume({ place_of_residence: v })} />
      </div>

      <div className="editor-block">
        <h3 className="eb-title">Links</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <TextField label="LinkedIn URL" value={r.linkedin_url || ''} onChange={(v) => updateResume({ linkedin_url: v })} />
          <TextField label="Website" value={r.website_url || ''} onChange={(v) => updateResume({ website_url: v })} />
          <TextField label="Twitter / X" value={r.twitter || ''} onChange={(v) => updateResume({ twitter: v })} />
          <TextField label="Profile image URL" value={r.profile_image_url || ''} onChange={(v) => updateResume({ profile_image_url: v })} />
        </div>
      </div>
    </div>
  )
}
