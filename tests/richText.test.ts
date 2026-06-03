/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import {
  sanitizeRich, richToPlain, hasMarkup, renderRichHtml, parseRichBlocks,
} from '../src/lib/richText'

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

describe('hasMarkup', () => {
  it('detects allowed inline tags', () => {
    expect(hasMarkup('plain')).toBe(false)
    expect(hasMarkup('<b>x</b>')).toBe(true)
    expect(hasMarkup('<p>x</p>')).toBe(true)
    expect(hasMarkup('a<br>b')).toBe(true)
    expect(hasMarkup('<UL><LI>x</LI></UL>')).toBe(true)
  })
  it('ignores tags outside the allowlist', () => {
    expect(hasMarkup('<span>x</span>')).toBe(false)
    expect(hasMarkup('<div>x</div>')).toBe(false)
  })
})

describe('sanitizeRich', () => {
  it('keeps the allowed tags as-is', () => {
    expect(sanitizeRich('<b>x</b>')).toBe('<b>x</b>')
    expect(sanitizeRich('<strong>x</strong>')).toBe('<strong>x</strong>')
    expect(sanitizeRich('<em>x</em><u>y</u>')).toBe('<em>x</em><u>y</u>')
    expect(sanitizeRich('<p>x</p>')).toBe('<p>x</p>')
    expect(sanitizeRich('<ul><li>x</li></ul>')).toBe('<ul><li>x</li></ul>')
    expect(sanitizeRich('<ol><li>a</li><li>b</li></ol>')).toBe('<ol><li>a</li><li>b</li></ol>')
  })
  it('strips disallowed tags but keeps their text', () => {
    expect(sanitizeRich('<span>hi</span>')).toBe('hi')
    expect(sanitizeRich('<div><b>x</b></div>')).toBe('<b>x</b>')
    expect(sanitizeRich('<a href="http://x">link</a>')).toBe('link')
  })
  it('drops dangerous container tags with their content', () => {
    expect(sanitizeRich('<script>alert(1)</script>safe')).toBe('safe')
    expect(sanitizeRich('<style>body{}</style>x')).toBe('x')
    expect(sanitizeRich('<iframe src=x></iframe>after')).toBe('after')
  })
  it('strips all attributes from allowed tags', () => {
    expect(sanitizeRich('<b style="color:red" onclick="x()">y</b>')).toBe('<b>y</b>')
    expect(sanitizeRich('<p class="foo" id="bar">x</p>')).toBe('<p>x</p>')
  })
  it('handles empty input', () => {
    expect(sanitizeRich('')).toBe('')
  })
})

describe('richToPlain', () => {
  it('passes plain strings through', () => {
    expect(richToPlain('hello world')).toBe('hello world')
  })
  it('strips inline markup', () => {
    expect(richToPlain('<b>hello</b> <em>world</em>')).toBe('hello world')
  })
  it('renders <br> as newline', () => {
    expect(richToPlain('a<br>b')).toBe('a\nb')
  })
  it('renders unordered lists with bullet markers', () => {
    const html = '<ul><li>a</li><li>b</li></ul>'
    expect(richToPlain(html)).toBe('• a\n• b')
  })
  it('renders ordered lists with numbers', () => {
    const html = '<ol><li>a</li><li>b</li></ol>'
    expect(richToPlain(html)).toBe('1. a\n2. b')
  })
})

describe('renderRichHtml', () => {
  it('falls back to escapePlain when the value has no markup', () => {
    expect(renderRichHtml('5 < 6', escape)).toBe('5 &lt; 6')
  })
  it('sanitises a marked-up value (does not escape)', () => {
    expect(renderRichHtml('<b>x</b>', escape)).toBe('<b>x</b>')
  })
  it('returns empty for empty input', () => {
    expect(renderRichHtml('', escape)).toBe('')
  })
})

describe('parseRichBlocks', () => {
  it('returns a single paragraph for plain text', () => {
    const blocks = parseRichBlocks('hello')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('paragraph')
    expect((blocks[0] as { runs: { text: string }[] }).runs[0].text).toBe('hello')
  })
  it('extracts bold/italic/underline flags on runs', () => {
    const blocks = parseRichBlocks('<b>bold</b> <i>italic</i> <u>under</u>')
    const runs = (blocks[0] as { runs: { text: string; bold?: boolean; italic?: boolean; underline?: boolean }[] }).runs
    expect(runs[0]).toMatchObject({ bold: true })
    expect(runs.some((r) => r.italic)).toBe(true)
    expect(runs.some((r) => r.underline)).toBe(true)
  })
  it('emits ordered list items with index', () => {
    const blocks = parseRichBlocks('<ol><li>a</li><li>b</li></ol>')
    const items = blocks.filter((b) => b.kind === 'list-item')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ ordered: true, index: 1 })
    expect(items[1]).toMatchObject({ ordered: true, index: 2 })
  })
  it('emits unordered list items as not ordered', () => {
    const blocks = parseRichBlocks('<ul><li>a</li></ul>')
    expect(blocks[0]).toMatchObject({ kind: 'list-item', ordered: false })
  })
  it('mixes paragraphs and lists in document order', () => {
    const blocks = parseRichBlocks('<p>intro</p><ul><li>a</li></ul>')
    expect(blocks[0].kind).toBe('paragraph')
    expect(blocks[1].kind).toBe('list-item')
  })
})
