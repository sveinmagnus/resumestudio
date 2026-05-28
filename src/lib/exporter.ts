import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageOrientation, convertInchesToTwip, BorderStyle, LevelFormat, ImageRun,
} from 'docx'
import type {
  ResumeStore, ExportTemplate, TemplateSection,
  Project, WorkExperience, KeyQualification, Education, Course,
  Certification, SpokenLanguage, TechnologyCategory, Position,
  Presentation, HonorAward, Publication, Reference, LocalizedString,
} from '../types'
import { resolve, fmtRange, fmtDate } from './locales'
import { computeSkillExperience, formatMonths } from './experience'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function L(ls: LocalizedString | undefined, locale: string): string {
  return resolve(ls, locale)
}

function isSectionEnabled(template: ExportTemplate, key: string): TemplateSection | null {
  const s = template.sections.find((s) => s.key === key)
  return s && s.enabled ? s : null
}

function sectionHeading(sec: TemplateSection, fallback: string, locale: string): string {
  if (sec.heading) {
    const h = resolve(sec.heading, locale)
    if (h) return h
  }
  return fallback
}

function fmtDateForTemplate(d: { year: number; month: number | null } | null, template: ExportTemplate): string {
  if (!d) return ''
  if (template.date_style === 'yearOnly') return String(d.year)
  return fmtDate(d)
}

function fmtRangeForTemplate(start: { year: number; month: number | null } | null, end: { year: number; month: number | null } | null, template: ExportTemplate): string {
  const s = fmtDateForTemplate(start, template)
  const e = end ? fmtDateForTemplate(end, template) : 'Present'
  if (!s) return e === 'Present' ? '' : e
  return `${s} – ${e}`
}

// ─── .docx export ─────────────────────────────────────────────────────────────

function hexFromColor(hex: string): string {
  return hex.replace('#', '').toUpperCase()
}

export async function exportDocx(data: ResumeStore, template: ExportTemplate, locale: string): Promise<void> {
  const accent = hexFromColor(template.accent_color)
  const bodyFontSize = template.font_size * 2  // docx uses half-points
  const children: Paragraph[] = []

  // Build sections in template order
  for (const sec of template.sections) {
    if (!sec.enabled) continue

    switch (sec.key) {
      case 'header':
        children.push(...buildDocxHeader(data, sec, locale, accent, template))
        break
      case 'key_qualifications':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Profile', locale), accent,
          () => buildDocxProfile(data, sec, locale)))
        break
      case 'projects':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Projects', locale), accent,
          () => buildDocxProjects(data, sec, locale, template)))
        break
      case 'work_experiences':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Employment', locale), accent,
          () => buildDocxEmployment(data, sec, locale, template)))
        break
      case 'educations':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Education', locale), accent,
          () => buildDocxEducation(data, sec, locale, template)))
        break
      case 'courses':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Courses', locale), accent,
          () => buildDocxCourses(data, sec, locale, template)))
        break
      case 'certifications':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Certifications', locale), accent,
          () => buildDocxCertifications(data, sec, locale, template)))
        break
      case 'technology_categories':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Skills', locale), accent,
          () => buildDocxTechCategories(data, sec, locale)))
        break
      case 'spoken_languages':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Languages', locale), accent,
          () => buildDocxLanguages(data, sec, locale)))
        break
      case 'positions':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Positions', locale), accent,
          () => buildDocxPositions(data, sec, locale, template)))
        break
      case 'presentations':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Presentations', locale), accent,
          () => buildDocxPresentations(data, sec, locale, template)))
        break
      case 'publications':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Publications', locale), accent,
          () => buildDocxPublications(data, sec, locale, template)))
        break
      case 'honor_awards':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'Awards', locale), accent,
          () => buildDocxAwards(data, sec, locale, template)))
        break
      case 'references':
        children.push(...buildDocxSection(sec, sectionHeading(sec, 'References', locale), accent,
          () => buildDocxReferences(data, sec, locale)))
        break
    }
  }

  // Page setup
  const pageWidth = template.page_size === 'A4' ? 11906 : 12240  // twips
  const pageHeight = template.page_size === 'A4' ? 16838 : 15840

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: template.body_font, size: bodyFontSize },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT, width: pageWidth, height: pageHeight },
          margin: { top: convertInchesToTwip(0.75), bottom: convertInchesToTwip(0.75), left: convertInchesToTwip(0.85), right: convertInchesToTwip(0.85) },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${data.resume?.full_name?.replace(/\s+/g, '_') || 'resume'}_${template.name.replace(/\s+/g, '_')}.docx`)
}

// ── Section wrapper ─────────────────────────────────────────────────────────

function buildDocxSection(_sec: TemplateSection, heading: string, accent: string, body: () => Paragraph[]): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 280, after: 100 },
      border: { bottom: { color: accent, space: 1, style: BorderStyle.SINGLE, size: 6 } },
      children: [
        new TextRun({ text: heading.toUpperCase(), bold: true, color: accent, size: 22, font: 'DM Sans' }),
      ],
    }),
    ...body(),
  ]
}

// ── Header ─────────────────────────────────────────────────────────────────

function buildDocxHeader(data: ResumeStore, sec: TemplateSection, locale: string, accent: string, template: ExportTemplate): Paragraph[] {
  const r = data.resume
  if (!r) return []
  const f = (k: string) => sec.fields.includes(k)
  const out: Paragraph[] = []

  if (f('full_name')) {
    out.push(new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: r.full_name, bold: true, size: 44, font: template.heading_font, color: accent })],
    }))
  }
  if (f('title') && L(r.title, locale)) {
    out.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: L(r.title, locale), size: 26, font: template.heading_font })],
    }))
  }

  const contactBits: string[] = []
  if (f('email') && r.email) contactBits.push(r.email)
  if (f('phone') && r.phone) contactBits.push(r.phone)
  if (f('place_of_residence') && L(r.place_of_residence, locale)) contactBits.push(L(r.place_of_residence, locale))
  if (f('nationality') && L(r.nationality, locale)) contactBits.push(L(r.nationality, locale))
  if (f('date_of_birth') && r.date_of_birth) contactBits.push(r.date_of_birth)
  if (f('linkedin_url') && r.linkedin_url) contactBits.push(r.linkedin_url)
  if (f('website_url') && r.website_url) contactBits.push(r.website_url)

  if (contactBits.length) {
    out.push(new Paragraph({
      spacing: { after: 180 },
      children: [new TextRun({ text: contactBits.join('  •  '), size: 20, color: '666666' })],
    }))
  }
  return out
}

// ── Profile / key qualifications ───────────────────────────────────────────

function buildDocxProfile(data: ResumeStore, sec: TemplateSection, locale: string): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const kq of data.key_qualifications.filter((k) => !k.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    if (f('tag_line') && L(kq.tag_line, locale)) {
      out.push(para(L(kq.tag_line, locale), { italic: true, after: 100 }))
    }
    if (f('summary') && L(kq.summary, locale)) {
      out.push(para(L(kq.summary, locale), { after: 120 }))
    }
    if (f('key_points')) {
      for (const kp of kq.key_points.filter((p) => !p.disabled)) {
        const name = L(kp.name, locale); const desc = L(kp.long_description, locale)
        if (!name && !desc) continue
        out.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            ...(name ? [new TextRun({ text: `• ${name}`, bold: true })] : []),
            ...(name && desc ? [new TextRun({ text: ' — ' })] : []),
            ...(desc ? [new TextRun({ text: desc })] : []),
          ],
        }))
      }
    }
  }
  return out
}

// ── Projects ───────────────────────────────────────────────────────────────

function buildDocxProjects(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  const projects = data.projects.filter((p) => !p.disabled).sort((a, b) => {
    const aDate = a.start ? a.start.year * 12 + (a.start.month || 0) : 0
    const bDate = b.start ? b.start.year * 12 + (b.start.month || 0) : 0
    return bDate - aDate
  })
  for (const p of projects) {
    const customer = p.use_anonymized ? L(p.customer_anonymized, locale) : L(p.customer, locale)
    const title = f('customer') ? (customer || L(p.description, locale)) : L(p.description, locale)
    const dateStr = f('dates') ? fmtRangeForTemplate(p.start, p.end, template) : ''
    out.push(new Paragraph({
      spacing: { before: 180, after: 40 },
      children: [
        new TextRun({ text: title, bold: true, size: 24 }),
        ...(dateStr ? [new TextRun({ text: `   ${dateStr}`, size: 20, color: '888888' })] : []),
      ],
    }))
    const subBits: string[] = []
    if (f('industry') && L(p.industry, locale)) subBits.push(L(p.industry, locale))
    if (f('team_size') && p.team_size) subBits.push(`Team of ${p.team_size}`)
    if (f('allocation') && p.percent_allocated) subBits.push(`${p.percent_allocated}% allocation`)
    if (subBits.length) out.push(para_text(subBits.join(' · '), { italic: true, after: 80, color: '666666' }))

    if (f('description') && L(p.description, locale) && L(p.description, locale) !== title) {
      out.push(para(L(p.description, locale), { after: 80 }))
    }
    if (f('long_description') && L(p.long_description, locale)) {
      out.push(para(L(p.long_description, locale), { after: 100 }))
    }
    if (f('roles')) {
      for (const role of p.roles.filter((r) => !r.disabled)) {
        const roleName = L(role.name, locale)
        const roleDesc = L(role.long_description, locale)
        if (!roleName && !roleDesc) continue
        out.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            ...(roleName ? [new TextRun({ text: `${roleName}: `, bold: true })] : []),
            ...(roleDesc ? [new TextRun({ text: roleDesc })] : []),
          ],
        }))
      }
    }
    if (f('highlights') && p.highlights.length) {
      for (const h of p.highlights) {
        const txt = L(h, locale); if (!txt) continue
        out.push(para_text(`• ${txt}`, { after: 40 }))
      }
    }
    if (f('skills') && p.skills.length) {
      const skillNames = p.skills.map((s) => L(s.name, locale)).filter(Boolean)
      if (skillNames.length) {
        out.push(new Paragraph({
          spacing: { before: 60, after: 80 },
          children: [
            new TextRun({ text: 'Skills: ', italics: true, color: '666666' }),
            new TextRun({ text: skillNames.join(', '), color: '666666' }),
          ],
        }))
      }
    }
  }
  return out
}

// ── Employment ─────────────────────────────────────────────────────────────

function buildDocxEmployment(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  const list = data.work_experiences.filter((w) => !w.disabled).sort((a, b) => {
    const aD = a.start ? a.start.year * 12 + (a.start.month || 0) : 0
    const bD = b.start ? b.start.year * 12 + (b.start.month || 0) : 0
    return bD - aD
  })
  for (const w of list) {
    const employer = f('employer') ? L(w.employer, locale) : ''
    const role = f('role_title') ? L(w.role_title, locale) : ''
    const title = [employer, role].filter(Boolean).join(' — ')
    const dateStr = f('dates') ? fmtRangeForTemplate(w.start, w.end, template) : ''
    out.push(new Paragraph({
      spacing: { before: 160, after: 40 },
      children: [
        new TextRun({ text: title, bold: true, size: 24 }),
        ...(dateStr ? [new TextRun({ text: `   ${dateStr}`, size: 20, color: '888888' })] : []),
      ],
    }))
    if (f('employment_type') && w.employment_type) {
      out.push(para_text(w.employment_type.replace('_', ' '), { italic: true, color: '666666', after: 80 }))
    }
    if (f('long_description') && L(w.long_description, locale)) {
      out.push(para(L(w.long_description, locale), { after: 80 }))
    }
    if (f('roles')) {
      for (const role of w.roles.filter((r) => !r.disabled)) {
        const n = L(role.name, locale); const d = L(role.long_description, locale)
        if (!n && !d) continue
        out.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            ...(n ? [new TextRun({ text: `${n}: `, bold: true })] : []),
            ...(d ? [new TextRun({ text: d })] : []),
          ],
        }))
      }
    }
    if (f('skills') && w.skills.length) {
      const names = w.skills.map((s) => L(s.name, locale)).filter(Boolean)
      if (names.length) out.push(para_text(`Skills: ${names.join(', ')}`, { italic: true, color: '666666', after: 80 }))
    }
  }
  return out
}

// ── Education ──────────────────────────────────────────────────────────────

function buildDocxEducation(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const e of data.educations.filter((e) => !e.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    const left = f('school') ? L(e.school, locale) : ''
    const right = f('degree') ? L(e.degree, locale) : ''
    const dateStr = f('dates') ? fmtRangeForTemplate(e.start, e.end, template) : ''
    out.push(new Paragraph({
      spacing: { before: 120, after: 30 },
      children: [
        new TextRun({ text: left, bold: true }),
        ...(right ? [new TextRun({ text: ` — ${right}` })] : []),
        ...(dateStr ? [new TextRun({ text: `   ${dateStr}`, color: '888888' })] : []),
      ],
    }))
    if (f('description') && L(e.description, locale)) out.push(para(L(e.description, locale), { after: 40 }))
    if (f('grade') && e.grade) out.push(para_text(`Grade: ${e.grade}`, { italic: true, after: 40 }))
  }
  return out
}

// ── Courses ────────────────────────────────────────────────────────────────

function buildDocxCourses(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const c of data.courses.filter((c) => !c.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    const parts: TextRun[] = []
    if (f('name')) parts.push(new TextRun({ text: L(c.name, locale), bold: true }))
    if (f('program') && L(c.program, locale)) parts.push(new TextRun({ text: ` — ${L(c.program, locale)}` }))
    if (f('completed')) parts.push(new TextRun({ text: `   ${fmtDateForTemplate(c.completed, template)}`, color: '888888' }))
    out.push(new Paragraph({ spacing: { after: 30 }, children: parts }))
    if (f('description') && L(c.description, locale)) out.push(para(L(c.description, locale), { after: 50 }))
  }
  return out
}

// ── Certifications ─────────────────────────────────────────────────────────

function buildDocxCertifications(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const c of data.certifications.filter((c) => !c.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    const runs: TextRun[] = []
    if (f('name')) runs.push(new TextRun({ text: L(c.name, locale), bold: true }))
    if (f('organiser') && L(c.organiser, locale)) runs.push(new TextRun({ text: ` — ${L(c.organiser, locale)}` }))
    if (f('issued')) runs.push(new TextRun({ text: `   ${fmtDateForTemplate(c.issued, template)}`, color: '888888' }))
    if (f('expires') && c.expires) runs.push(new TextRun({ text: ` (expires ${fmtDateForTemplate(c.expires, template)})`, color: '888888' }))
    out.push(new Paragraph({ spacing: { after: 50 }, children: runs }))
    if (f('credential_url') && c.credential_url) out.push(para_text(c.credential_url, { color: '666666', after: 30 }))
  }
  return out
}

// ── Tech categories ────────────────────────────────────────────────────────

function buildDocxTechCategories(data: ResumeStore, sec: TemplateSection, locale: string): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const cat of data.technology_categories.filter((c) => !c.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    const catName = f('name') ? L(cat.name, locale) : ''
    const names = cat.skills.map((cs) => {
      let s = L(cs.name, locale)
      if (f('experience')) {
        const exp = computeSkillExperience(data, cs.skill_id, locale)
        if (exp.totalMonths > 0) s += ` (${formatMonths(exp.totalMonths)})`
      }
      return s
    }).filter(Boolean)
    if (!catName && !names.length) continue
    out.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        ...(catName ? [new TextRun({ text: `${catName}: `, bold: true })] : []),
        new TextRun({ text: names.join(', ') }),
      ],
    }))
  }
  return out
}

// ── Languages ──────────────────────────────────────────────────────────────

function buildDocxLanguages(data: ResumeStore, sec: TemplateSection, locale: string): Paragraph[] {
  const f = (k: string) => sec.fields.includes(k)
  return data.spoken_languages.filter((l) => !l.disabled).map((l) =>
    new Paragraph({
      spacing: { after: 30 },
      children: [
        ...(f('name') ? [new TextRun({ text: L(l.name, locale), bold: true })] : []),
        ...(f('level') && L(l.level, locale) ? [new TextRun({ text: ` — ${L(l.level, locale)}` })] : []),
      ],
    })
  )
}

// ── Positions ──────────────────────────────────────────────────────────────

function buildDocxPositions(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const p of data.positions.filter((p) => !p.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    const dateStr = f('dates') ? fmtRangeForTemplate(p.start, p.end, template) : ''
    out.push(new Paragraph({
      spacing: { after: 30 },
      children: [
        ...(f('name') ? [new TextRun({ text: L(p.name, locale), bold: true })] : []),
        ...(f('organisation') && L(p.organisation, locale) ? [new TextRun({ text: ` — ${L(p.organisation, locale)}` })] : []),
        ...(dateStr ? [new TextRun({ text: `   ${dateStr}`, color: '888888' })] : []),
      ],
    }))
    if (f('description') && L(p.description, locale)) out.push(para(L(p.description, locale), { after: 50 }))
  }
  return out
}

// ── Presentations / publications / awards / references ─────────────────────

function buildDocxPresentations(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const p of data.presentations.filter((p) => !p.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    out.push(new Paragraph({
      spacing: { after: 30 },
      children: [
        ...(f('title') ? [new TextRun({ text: L(p.title, locale), bold: true })] : []),
        ...(f('event') && L(p.event, locale) ? [new TextRun({ text: ` — ${L(p.event, locale)}` })] : []),
        ...(f('date') ? [new TextRun({ text: `   ${fmtDateForTemplate(p.date, template)}`, color: '888888' })] : []),
      ],
    }))
    if (f('description') && L(p.description, locale)) out.push(para(L(p.description, locale), { after: 30 }))
    if (f('url') && p.url) out.push(para_text(p.url, { color: '666666', after: 40 }))
  }
  return out
}

function buildDocxPublications(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const p of data.publications.filter((x) => !x.disabled).sort((a, b) => a.sort_order - b.sort_order)) {
    out.push(new Paragraph({
      spacing: { after: 30 },
      children: [
        ...(f('title') ? [new TextRun({ text: L(p.title, locale), bold: true })] : []),
        ...(f('publisher') && L(p.publisher, locale) ? [new TextRun({ text: ` — ${L(p.publisher, locale)}` })] : []),
        ...(f('date') ? [new TextRun({ text: `   ${fmtDateForTemplate(p.date, template)}`, color: '888888' })] : []),
      ],
    }))
    if (f('abstract') && L(p.abstract, locale)) out.push(para(L(p.abstract, locale), { after: 30 }))
    if (f('url') && p.url) out.push(para_text(p.url, { color: '666666', after: 40 }))
  }
  return out
}

function buildDocxAwards(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const a of data.honor_awards.filter((x) => !x.disabled).sort((x, y) => x.sort_order - y.sort_order)) {
    out.push(new Paragraph({
      spacing: { after: 30 },
      children: [
        ...(f('name') ? [new TextRun({ text: L(a.name, locale), bold: true })] : []),
        ...(f('issuer') && L(a.issuer, locale) ? [new TextRun({ text: ` — ${L(a.issuer, locale)}` })] : []),
        ...(f('date') ? [new TextRun({ text: `   ${fmtDateForTemplate(a.date, template)}`, color: '888888' })] : []),
      ],
    }))
    if (f('description') && L(a.description, locale)) out.push(para(L(a.description, locale), { after: 50 }))
  }
  return out
}

function buildDocxReferences(data: ResumeStore, sec: TemplateSection, locale: string): Paragraph[] {
  const out: Paragraph[] = []
  const f = (k: string) => sec.fields.includes(k)
  for (const ref of data.references.filter((r) => r.include_in_exports)) {
    const bits: TextRun[] = []
    if (f('name')) bits.push(new TextRun({ text: ref.name || 'Reference', bold: true }))
    if (f('title') && ref.title) bits.push(new TextRun({ text: `, ${ref.title}` }))
    if (f('company') && ref.company) bits.push(new TextRun({ text: `, ${ref.company}` }))
    out.push(new Paragraph({ spacing: { after: 30 }, children: bits }))
    const ctx: string[] = []
    if (f('relationship') && L(ref.relationship, locale)) ctx.push(L(ref.relationship, locale))
    if (f('email') && ref.email) ctx.push(ref.email)
    if (f('phone') && ref.phone) ctx.push(ref.phone)
    if (ctx.length) out.push(para_text(ctx.join(' · '), { color: '666666', after: 50 }))
  }
  return out
}

// ── Tiny paragraph helpers ─────────────────────────────────────────────────

interface PStyle { italic?: boolean; bold?: boolean; color?: string; after?: number }

function para(text: string, opts: PStyle = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 60 },
    children: [new TextRun({ text, italics: opts.italic, bold: opts.bold, color: opts.color })],
  })
}
function para_text(text: string, opts: PStyle = {}): Paragraph { return para(text, opts) }

// ─── .pdf export — render to HTML, open print dialog ──────────────────────────

export async function exportPdf(data: ResumeStore, template: ExportTemplate, locale: string): Promise<void> {
  const html = buildHtml(data, template, locale)

  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to export PDF.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()

  // Give fonts/styles a moment to settle, then trigger print
  setTimeout(() => {
    win.focus()
    win.print()
  }, 500)
}

function buildHtml(data: ResumeStore, template: ExportTemplate, locale: string): string {
  const r = data.resume
  if (!r) return ''
  const accent = template.accent_color
  const sections: string[] = []

  for (const sec of template.sections) {
    if (!sec.enabled) continue
    sections.push(renderHtmlSection(data, sec, locale, template))
  }

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(r.full_name)} — ${escapeHtml(template.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page { size: ${template.page_size}; margin: 18mm 20mm; }
  html, body { background: #fff; color: #1a1714; }
  body {
    font-family: '${template.body_font}', Georgia, serif;
    font-size: ${template.font_size}pt;
    line-height: 1.5;
    margin: 0;
  }
  h1 { font-family: '${template.heading_font}', serif; color: ${accent}; font-weight: 400; font-size: 28pt; margin: 0 0 4px; line-height: 1.1; }
  h2 { font-family: '${template.heading_font}', serif; font-weight: 400; font-size: 16pt; margin: 0 0 14px; color: #444; }
  h3 {
    font-family: '${template.body_font}', sans-serif;
    font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: ${accent}; font-size: 10.5pt;
    margin: 22px 0 10px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid ${accent};
  }
  h4 { font-size: ${template.font_size + 1}pt; margin: 14px 0 2px; }
  .contact { color: #666; font-size: ${template.font_size - 0.5}pt; margin-bottom: 20px; }
  .item { margin-bottom: 14px; }
  .item-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 3px; }
  .item-title { font-weight: 700; }
  .item-dates { color: #888; font-size: ${template.font_size - 0.5}pt; white-space: nowrap; }
  .item-meta { color: #666; font-style: italic; font-size: ${template.font_size - 0.5}pt; margin-bottom: 5px; }
  .role { margin: 5px 0; }
  .role-name { font-weight: 600; }
  .skills-line { color: #666; font-style: italic; font-size: ${template.font_size - 0.5}pt; margin-top: 4px; }
  .key-point { margin: 4px 0; }
  .key-point-name { font-weight: 600; }
  ul.highlights { margin: 4px 0; padding-left: 18px; }
  ul.highlights li { margin: 2px 0; }
  p { margin: 4px 0; }
  .tech-cat { margin-bottom: 6px; }
  .tech-cat-name { font-weight: 700; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
${sections.join('\n')}
</body>
</html>`
}

function renderHtmlSection(data: ResumeStore, sec: TemplateSection, locale: string, template: ExportTemplate): string {
  const f = (k: string) => sec.fields.includes(k)
  const r = data.resume!

  switch (sec.key) {
    case 'header': {
      const contactBits: string[] = []
      if (f('email') && r.email) contactBits.push(r.email)
      if (f('phone') && r.phone) contactBits.push(r.phone)
      if (f('place_of_residence') && L(r.place_of_residence, locale)) contactBits.push(L(r.place_of_residence, locale))
      if (f('nationality') && L(r.nationality, locale)) contactBits.push(L(r.nationality, locale))
      if (f('linkedin_url') && r.linkedin_url) contactBits.push(r.linkedin_url)
      if (f('website_url') && r.website_url) contactBits.push(r.website_url)
      return `
        ${f('full_name') ? `<h1>${escapeHtml(r.full_name)}</h1>` : ''}
        ${f('title') && L(r.title, locale) ? `<h2>${escapeHtml(L(r.title, locale))}</h2>` : ''}
        ${contactBits.length ? `<div class="contact">${contactBits.map(escapeHtml).join(' &nbsp;•&nbsp; ')}</div>` : ''}
      `
    }
    case 'key_qualifications': {
      const heading = sectionHeading(sec, 'Profile', locale)
      const blocks = data.key_qualifications.filter((k) => !k.disabled).sort((a, b) => a.sort_order - b.sort_order).map((kq) => `
        ${f('tag_line') && L(kq.tag_line, locale) ? `<p><em>${escapeHtml(L(kq.tag_line, locale))}</em></p>` : ''}
        ${f('summary') && L(kq.summary, locale) ? `<p>${escapeHtml(L(kq.summary, locale))}</p>` : ''}
        ${f('key_points') ? kq.key_points.filter((p) => !p.disabled).map((kp) => `
          <div class="key-point"><span class="key-point-name">${escapeHtml(L(kp.name, locale))}</span>${L(kp.long_description, locale) ? ` — ${escapeHtml(L(kp.long_description, locale))}` : ''}</div>
        `).join('') : ''}
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${blocks}</section>`
    }
    case 'projects': {
      const heading = sectionHeading(sec, 'Projects', locale)
      const items = data.projects.filter((p) => !p.disabled).sort((a, b) => {
        const aD = a.start ? a.start.year * 12 + (a.start.month || 0) : 0
        const bD = b.start ? b.start.year * 12 + (b.start.month || 0) : 0
        return bD - aD
      }).map((p) => {
        const customer = p.use_anonymized ? L(p.customer_anonymized, locale) : L(p.customer, locale)
        const title = f('customer') ? (customer || L(p.description, locale)) : L(p.description, locale)
        const subBits: string[] = []
        if (f('industry') && L(p.industry, locale)) subBits.push(L(p.industry, locale))
        if (f('team_size') && p.team_size) subBits.push(`Team of ${p.team_size}`)
        if (f('allocation') && p.percent_allocated) subBits.push(`${p.percent_allocated}% allocation`)
        return `<div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml(title)}</div>
            ${f('dates') ? `<div class="item-dates">${fmtRangeForTemplate(p.start, p.end, template)}</div>` : ''}
          </div>
          ${subBits.length ? `<div class="item-meta">${escapeHtml(subBits.join(' · '))}</div>` : ''}
          ${f('description') && L(p.description, locale) && L(p.description, locale) !== title ? `<p>${escapeHtml(L(p.description, locale))}</p>` : ''}
          ${f('long_description') && L(p.long_description, locale) ? `<p>${escapeHtml(L(p.long_description, locale))}</p>` : ''}
          ${f('roles') ? p.roles.filter((r) => !r.disabled).map((r) => `
            <div class="role"><span class="role-name">${escapeHtml(L(r.name, locale))}:</span> ${escapeHtml(L(r.long_description, locale))}</div>
          `).join('') : ''}
          ${f('highlights') && p.highlights.length ? `<ul class="highlights">${p.highlights.map((h) => L(h, locale)).filter(Boolean).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
          ${f('skills') && p.skills.length ? `<div class="skills-line"><strong>Skills:</strong> ${p.skills.map((s) => escapeHtml(L(s.name, locale))).filter(Boolean).join(', ')}</div>` : ''}
        </div>`
      }).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'work_experiences': {
      const heading = sectionHeading(sec, 'Employment', locale)
      const items = data.work_experiences.filter((w) => !w.disabled).sort((a, b) => {
        const aD = a.start ? a.start.year * 12 + (a.start.month || 0) : 0
        const bD = b.start ? b.start.year * 12 + (b.start.month || 0) : 0
        return bD - aD
      }).map((w) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('employer') ? L(w.employer, locale) : '', f('role_title') ? L(w.role_title, locale) : ''].filter(Boolean).join(' — '))}</div>
            ${f('dates') ? `<div class="item-dates">${fmtRangeForTemplate(w.start, w.end, template)}</div>` : ''}
          </div>
          ${f('employment_type') && w.employment_type ? `<div class="item-meta">${escapeHtml(w.employment_type.replace('_', ' '))}</div>` : ''}
          ${f('long_description') && L(w.long_description, locale) ? `<p>${escapeHtml(L(w.long_description, locale))}</p>` : ''}
          ${f('roles') ? w.roles.filter((r) => !r.disabled).map((r) => `
            <div class="role"><span class="role-name">${escapeHtml(L(r.name, locale))}:</span> ${escapeHtml(L(r.long_description, locale))}</div>
          `).join('') : ''}
          ${f('skills') && w.skills.length ? `<div class="skills-line"><strong>Skills:</strong> ${w.skills.map((s) => escapeHtml(L(s.name, locale))).filter(Boolean).join(', ')}</div>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'educations': {
      const heading = sectionHeading(sec, 'Education', locale)
      const items = data.educations.filter((e) => !e.disabled).sort((a, b) => a.sort_order - b.sort_order).map((e) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('school') ? L(e.school, locale) : '', f('degree') ? L(e.degree, locale) : ''].filter(Boolean).join(' — '))}</div>
            ${f('dates') ? `<div class="item-dates">${fmtRangeForTemplate(e.start, e.end, template)}</div>` : ''}
          </div>
          ${f('description') && L(e.description, locale) ? `<p>${escapeHtml(L(e.description, locale))}</p>` : ''}
          ${f('grade') && e.grade ? `<div class="item-meta">Grade: ${escapeHtml(e.grade)}</div>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'courses': {
      const heading = sectionHeading(sec, 'Courses', locale)
      const items = data.courses.filter((c) => !c.disabled).sort((a, b) => a.sort_order - b.sort_order).map((c) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('name') ? L(c.name, locale) : '', f('program') ? L(c.program, locale) : ''].filter(Boolean).join(' — '))}</div>
            ${f('completed') ? `<div class="item-dates">${fmtDateForTemplate(c.completed, template)}</div>` : ''}
          </div>
          ${f('description') && L(c.description, locale) ? `<p>${escapeHtml(L(c.description, locale))}</p>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'certifications': {
      const heading = sectionHeading(sec, 'Certifications', locale)
      const items = data.certifications.filter((c) => !c.disabled).sort((a, b) => a.sort_order - b.sort_order).map((c) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('name') ? L(c.name, locale) : '', f('organiser') ? L(c.organiser, locale) : ''].filter(Boolean).join(' — '))}</div>
            <div class="item-dates">${f('issued') ? fmtDateForTemplate(c.issued, template) : ''}${f('expires') && c.expires ? ` (exp. ${fmtDateForTemplate(c.expires, template)})` : ''}</div>
          </div>
          ${f('credential_url') && c.credential_url ? `<div class="item-meta">${escapeHtml(c.credential_url)}</div>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'technology_categories': {
      const heading = sectionHeading(sec, 'Skills', locale)
      const items = data.technology_categories.filter((c) => !c.disabled).sort((a, b) => a.sort_order - b.sort_order).map((cat) => {
        const skills = cat.skills.map((cs) => {
          let s = L(cs.name, locale)
          if (f('experience')) {
            const exp = computeSkillExperience(data, cs.skill_id, locale)
            if (exp.totalMonths > 0) s += ` (${formatMonths(exp.totalMonths)})`
          }
          return s
        }).filter(Boolean).join(', ')
        return `<div class="tech-cat"><span class="tech-cat-name">${escapeHtml(f('name') ? L(cat.name, locale) : '')}:</span> ${escapeHtml(skills)}</div>`
      }).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'spoken_languages': {
      const heading = sectionHeading(sec, 'Languages', locale)
      const items = data.spoken_languages.filter((l) => !l.disabled).map((l) =>
        `<div class="item"><strong>${escapeHtml(f('name') ? L(l.name, locale) : '')}</strong> — ${escapeHtml(f('level') ? L(l.level, locale) : '')}</div>`
      ).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'positions': {
      const heading = sectionHeading(sec, 'Positions', locale)
      const items = data.positions.filter((p) => !p.disabled).sort((a, b) => a.sort_order - b.sort_order).map((p) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('name') ? L(p.name, locale) : '', f('organisation') ? L(p.organisation, locale) : ''].filter(Boolean).join(' — '))}</div>
            ${f('dates') ? `<div class="item-dates">${fmtRangeForTemplate(p.start, p.end, template)}</div>` : ''}
          </div>
          ${f('description') && L(p.description, locale) ? `<p>${escapeHtml(L(p.description, locale))}</p>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'presentations': {
      const heading = sectionHeading(sec, 'Presentations', locale)
      const items = data.presentations.filter((p) => !p.disabled).sort((a, b) => a.sort_order - b.sort_order).map((p) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('title') ? L(p.title, locale) : '', f('event') ? L(p.event, locale) : ''].filter(Boolean).join(' — '))}</div>
            ${f('date') ? `<div class="item-dates">${fmtDateForTemplate(p.date, template)}</div>` : ''}
          </div>
          ${f('description') && L(p.description, locale) ? `<p>${escapeHtml(L(p.description, locale))}</p>` : ''}
          ${f('url') && p.url ? `<div class="item-meta">${escapeHtml(p.url)}</div>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'publications': {
      const heading = sectionHeading(sec, 'Publications', locale)
      const items = data.publications.filter((p) => !p.disabled).sort((a, b) => a.sort_order - b.sort_order).map((p) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('title') ? L(p.title, locale) : '', f('publisher') ? L(p.publisher, locale) : ''].filter(Boolean).join(' — '))}</div>
            ${f('date') ? `<div class="item-dates">${fmtDateForTemplate(p.date, template)}</div>` : ''}
          </div>
          ${f('abstract') && L(p.abstract, locale) ? `<p>${escapeHtml(L(p.abstract, locale))}</p>` : ''}
          ${f('url') && p.url ? `<div class="item-meta">${escapeHtml(p.url)}</div>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'honor_awards': {
      const heading = sectionHeading(sec, 'Awards', locale)
      const items = data.honor_awards.filter((a) => !a.disabled).sort((a, b) => a.sort_order - b.sort_order).map((a) => `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml([f('name') ? L(a.name, locale) : '', f('issuer') ? L(a.issuer, locale) : ''].filter(Boolean).join(' — '))}</div>
            ${f('date') ? `<div class="item-dates">${fmtDateForTemplate(a.date, template)}</div>` : ''}
          </div>
          ${f('description') && L(a.description, locale) ? `<p>${escapeHtml(L(a.description, locale))}</p>` : ''}
        </div>
      `).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    case 'references': {
      const heading = sectionHeading(sec, 'References', locale)
      const items = data.references.filter((r) => r.include_in_exports).map((ref) => {
        const head = [f('name') ? ref.name : '', f('title') ? ref.title : '', f('company') ? ref.company : ''].filter(Boolean).join(', ')
        const ctx = [f('relationship') ? L(ref.relationship, locale) : '', f('email') ? ref.email : '', f('phone') ? ref.phone : ''].filter(Boolean).join(' · ')
        return `<div class="item"><strong>${escapeHtml(head)}</strong>${ctx ? `<div class="item-meta">${escapeHtml(ctx)}</div>` : ''}</div>`
      }).join('')
      return `<section><h3>${escapeHtml(heading)}</h3>${items}</section>`
    }
    default:
      return ''
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
