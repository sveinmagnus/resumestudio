/**
 * @vitest-environment jsdom
 *
 * Covers the pure doc-definition builder. The actual pdfmake render + download
 * (exportPdf) needs the browser + the ~1.5 MB font vfs, so it isn't unit-tested
 * here — we assert the structure pdfmake will consume instead.
 */
import { describe, it, expect } from 'vitest'
import { buildPdfDocDefinition } from '../src/lib/pdfExporter'
import { emptyStore, makeResume, makeProject, makeView } from './fixtures'

/** Recursively gather every `text` string in a pdfmake content tree. */
function collectText(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') { if (node) out.push(node); return out }
  if (Array.isArray(node)) { for (const n of node) collectText(n, out); return out }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if ('text' in rec) collectText(rec.text, out)
    if ('stack' in rec) collectText(rec.stack, out)
    if ('columns' in rec) collectText(rec.columns, out)
    if ('content' in rec) collectText(rec.content, out)
    if ('table' in rec) collectText((rec.table as Record<string, unknown>).body, out)
  }
  return out
}

describe('buildPdfDocDefinition', () => {
  it('produces an A4 doc with identity, section heading and item content', async () => {
    const store = {
      ...emptyStore(),
      resume: makeResume({ full_name: 'Jane Doe', title: { en: 'Architect' } }),
      projects: [makeProject({
        id: 'p1', customer: { en: 'AcmeCorp' }, description: { en: 'Built the platform' },
        start: { year: 2020, month: 1 }, end: { year: 2021, month: 6 },
      })],
    }
    const view = makeView({ name: 'Board CV', sections: [{ key: 'projects', detail: 'full', sort_order: 0 }] })

    const dd = await buildPdfDocDefinition(store, view, 'en')
    expect(dd.pageSize).toBe('A4')
    expect(Array.isArray(dd.pageMargins)).toBe(true)
    expect((dd.pageMargins as number[])).toHaveLength(4)

    const text = collectText(dd.content).join(' | ')
    expect(text).toContain('Jane Doe')            // identity
    expect(text).toContain('Architect')           // title
    expect(text).toContain('PROJECTS')            // section heading, uppercased
    expect(text).toContain('AcmeCorp')            // item title (project customer)
  })

  it('renders a summary section as one-line entries (no full body)', async () => {
    const store = {
      ...emptyStore(),
      resume: makeResume({ full_name: 'Jane Doe' }),
      projects: [makeProject({ id: 'p1', customer: { en: 'AcmeCorp' }, long_description: { en: 'Long private detail' } })],
    }
    const view = makeView({ sections: [{ key: 'projects', detail: 'summary', sort_order: 0 }] })

    const dd = await buildPdfDocDefinition(store, view, 'en')
    const text = collectText(dd.content).join(' | ')
    expect(text).toContain('AcmeCorp')
    expect(text).not.toContain('Long private detail') // summary omits the body
  })

  it('includes the introduction and a footer copyright line', async () => {
    const store = { ...emptyStore(), resume: makeResume({ full_name: 'Jane Doe' }) }
    const view = makeView({
      introduction: { en: 'Tailored for boards.' },
      footer: { separator: 'line', copyright: 'person', copyright_custom: {}, note: {} },
    })

    const dd = await buildPdfDocDefinition(store, view, 'en')
    const text = collectText(dd.content).join(' | ')
    expect(text).toContain('Tailored for boards.')
    expect(text).toContain('Jane Doe') // copyright resolves the person's name
  })
})

// ─── Footer note placement ──────────────────────────────────────────────────
// The placement is computed once in viewHeader.footerLines and consumed by
// every path; these pin that the PDF actually honours it, so it can't drift
// from the HTML preview.

describe('footer note placement', () => {
  const build = async (placement: string) => {
    const store = emptyStore()
    store.resume = makeResume({ full_name: 'Ada Lovelace' })
    const view = makeView({
      sections: [],
      footer: {
        separator: 'line', copyright: 'person', copyright_custom: {},
        note: { en: 'Confidential' }, note_placement: placement as never,
      },
    })
    const dd = await buildPdfDocDefinition(store, view, 'en')
    // Only the footer's own text blocks, in order.
    return collectText(dd.content)
      .filter((t) => t.includes('Confidential') || t.includes('Ada Lovelace'))
  }
  const year = new Date().getFullYear()

  it('after: one line, note trailing the copyright', async () => {
    expect((await build('after')).at(-1)).toBe(`© ${year} Ada Lovelace  ·  Confidential`)
  })

  it('before: one line, note leading', async () => {
    expect((await build('before')).at(-1)).toBe(`Confidential  ·  © ${year} Ada Lovelace`)
  })

  it('above: two blocks, note first', async () => {
    expect((await build('above')).slice(-2)).toEqual(['Confidential', `© ${year} Ada Lovelace`])
  })

  it('below: two blocks, copyright first', async () => {
    expect((await build('below')).slice(-2)).toEqual([`© ${year} Ada Lovelace`, 'Confidential'])
  })
})
