/**
 * Resume Studio — limited rich-text support.
 *
 * Description-shaped fields (long_description, summary, abstract, …) allow a
 * narrow inline-formatting subset: bold, italic, underline, unordered list,
 * ordered list. No headings, font sizes, alignment, colors, links, or images
 * — those belong to the export template.
 *
 * Storage format: HTML string per locale. Allowed tag set:
 *   <p>, <br>, <strong>/<b>, <em>/<i>, <u>, <ul>, <ol>, <li>
 *
 * Everything else is stripped on save. This keeps a single shape (string)
 * across LocalizedString, plain-text imports (CVpartner), translation drafts,
 * and exports — at the cost of one sanitise step per write.
 *
 * Pure module — no React, no DOM globals at module load. We do touch the DOM
 * via DOMParser inside helpers (used in both browser and jsdom tests).
 */

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI',
])

/**
 * Strip everything that isn't on the allowlist. Children of disallowed
 * elements are kept (lifted) when their content is meaningful; the parent
 * tag itself is removed. Attributes are wiped wholesale — we never emit any.
 *
 * `<script>` and `<style>` are removed *with* their children (their content
 * is executable / unsafe and not user-meaningful as flowing text).
 */
export function sanitizeRich(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return ''

  // Drop dangerous container tags entirely (with subtree).
  for (const danger of Array.from(root.querySelectorAll('script,style,iframe,object,embed,form,input,textarea,button,svg'))) {
    danger.remove()
  }

  walk(root)
  return root.innerHTML
}

function walk(node: Element): void {
  // Iterate over a snapshot since we mutate as we go.
  const children = Array.from(node.children)
  for (const child of children) {
    walk(child)
    if (!ALLOWED_TAGS.has(child.tagName)) {
      // Unwrap: move child's nodes up to where it was, then remove the wrapper.
      const parent = child.parentNode
      if (!parent) continue
      while (child.firstChild) parent.insertBefore(child.firstChild, child)
      parent.removeChild(child)
    } else {
      // Wipe all attributes — we never need them.
      while (child.attributes.length) child.removeAttribute(child.attributes[0].name)
    }
  }
}

/**
 * Extract plain text from a rich-text HTML string. Used wherever the UI shows
 * a preview (EditorCard preview pane, completeness check) — those contexts
 * shouldn't render markup.
 *
 * Lists render with "• " / "1. " prefixes so the preview still reads as a
 * list, since whitespace alone would lose the structure.
 */
export function richToPlain(html: string): string {
  if (!html) return ''
  if (!hasMarkup(html)) return html  // fast path for plain-text values
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return ''
  return nodeText(root).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function nodeText(node: Node): string {
  if (node.nodeType === 3 /* text */) return node.textContent || ''
  if (node.nodeType !== 1 /* element */) return ''
  const el = node as Element
  const tag = el.tagName
  if (tag === 'BR') return '\n'
  if (tag === 'LI') {
    const inner = childrenText(el).trim()
    const parentTag = el.parentElement?.tagName
    if (parentTag === 'OL') {
      const idx = Array.from(el.parentElement!.children).indexOf(el) + 1
      return `${idx}. ${inner}\n`
    }
    return `• ${inner}\n`
  }
  if (tag === 'P' || tag === 'UL' || tag === 'OL') {
    return childrenText(el) + (tag === 'P' ? '\n' : '')
  }
  return childrenText(el)
}

function childrenText(el: Element): string {
  let out = ''
  for (const child of Array.from(el.childNodes)) out += nodeText(child)
  return out
}

/**
 * Cheap probe: does this string contain *any* HTML markup we care about?
 * Used by callers (HTML export, plain extractor) to skip work for the
 * overwhelmingly common plain-text case (imported CVpartner data, etc.).
 */
export function hasMarkup(s: string): boolean {
  if (!s) return false
  return /<\/?(p|br|strong|b|em|i|u|ul|ol|li)\b/i.test(s)
}

/**
 * Render a rich-text value into safe HTML for inclusion in the printable
 * preview / PDF output. If the input has no markup, the caller-supplied
 * `escapePlain` is used to keep escape-at-render semantics for raw text.
 *
 * NEVER call this on a value of unknown shape — always go through here so the
 * allowlist is enforced even on the export path.
 */
export function renderRichHtml(value: string, escapePlain: (s: string) => string): string {
  if (!value) return ''
  if (!hasMarkup(value)) return escapePlain(value)
  return sanitizeRich(value)
}

// ─── DOCX helpers ────────────────────────────────────────────────────────────

/**
 * Inline run with formatting flags. The DOCX exporter turns this into a
 * `TextRun`. Block structure (paragraph / list) is described by RichBlock
 * below; runs only carry inline state.
 */
export interface RichRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export type RichBlock =
  | { kind: 'paragraph'; runs: RichRun[] }
  | { kind: 'list-item'; ordered: boolean; level: number; index: number; runs: RichRun[] }

/**
 * Parse a rich-text HTML string into a structured block list the DOCX
 * exporter can consume. Plain-text input becomes a single paragraph.
 *
 * Nested lists are flattened: the `level` field carries depth so the DOCX
 * exporter can indent. CVpartner rarely produces nested lists so this is
 * good enough — the alternative would be docx's numbering instances and a
 * lot of plumbing.
 */
export function parseRichBlocks(html: string): RichBlock[] {
  if (!html) return []
  if (!hasMarkup(html)) {
    return [{ kind: 'paragraph', runs: [{ text: html }] }]
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return []
  const out: RichBlock[] = []
  walkBlocks(root, out, { bold: false, italic: false, underline: false }, { listKind: null, level: 0, counter: 0 })
  // Coalesce consecutive paragraphs with empty runs (markup-only artefacts).
  return out.filter((b) => b.runs.some((r) => r.text.length))
}

interface InlineState { bold: boolean; italic: boolean; underline: boolean }
interface ListCtx { listKind: 'ul' | 'ol' | null; level: number; counter: number }

function walkBlocks(node: Element, out: RichBlock[], inline: InlineState, list: ListCtx): void {
  let currentRuns: RichRun[] = []
  const flushParagraph = () => {
    if (currentRuns.length) {
      out.push({ kind: 'paragraph', runs: currentRuns })
      currentRuns = []
    }
  }

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      const text = (child.textContent || '').replace(/\s+/g, ' ')
      if (text) currentRuns.push({ text, ...activeFlags(inline) })
      continue
    }
    if (child.nodeType !== 1) continue
    const el = child as Element
    const tag = el.tagName
    if (tag === 'BR') {
      currentRuns.push({ text: '\n', ...activeFlags(inline) })
      continue
    }
    if (tag === 'STRONG' || tag === 'B' || tag === 'EM' || tag === 'I' || tag === 'U') {
      const flagged: InlineState = {
        bold: inline.bold || tag === 'STRONG' || tag === 'B',
        italic: inline.italic || tag === 'EM' || tag === 'I',
        underline: inline.underline || tag === 'U',
      }
      const runs = collectInlineRuns(el, flagged)
      currentRuns.push(...runs)
      continue
    }
    if (tag === 'P') {
      flushParagraph()
      const runs = collectInlineRuns(el, inline)
      if (runs.length) out.push({ kind: 'paragraph', runs })
      continue
    }
    if (tag === 'UL' || tag === 'OL') {
      flushParagraph()
      walkBlocks(el, out, inline, {
        listKind: tag === 'UL' ? 'ul' : 'ol',
        level: list.listKind ? list.level + 1 : 0,
        counter: 0,
      })
      continue
    }
    if (tag === 'LI') {
      if (!list.listKind) continue  // stray <li>
      list.counter += 1
      const runs = collectInlineRuns(el, inline)
      if (runs.length) {
        out.push({
          kind: 'list-item',
          ordered: list.listKind === 'ol',
          level: list.level,
          index: list.counter,
          runs,
        })
      }
      continue
    }
    // Unknown / unhandled — descend, treating it as transparent.
    walkBlocks(el, out, inline, list)
  }

  flushParagraph()
}

/**
 * Walk an inline element gathering runs but ignoring block boundaries.
 * Block-level children (p, ul, ol, li) inside an inline tag are vanishingly
 * rare in our domain; if they appear we treat them as transparent text.
 */
function collectInlineRuns(node: Element, inline: InlineState): RichRun[] {
  const out: RichRun[] = []
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      const text = (child.textContent || '').replace(/\s+/g, ' ')
      if (text) out.push({ text, ...activeFlags(inline) })
      continue
    }
    if (child.nodeType !== 1) continue
    const el = child as Element
    const tag = el.tagName
    if (tag === 'BR') {
      out.push({ text: '\n', ...activeFlags(inline) })
      continue
    }
    const next: InlineState = {
      bold: inline.bold || tag === 'STRONG' || tag === 'B',
      italic: inline.italic || tag === 'EM' || tag === 'I',
      underline: inline.underline || tag === 'U',
    }
    out.push(...collectInlineRuns(el, next))
  }
  return out
}

function activeFlags(inline: InlineState): Partial<RichRun> {
  const flags: Partial<RichRun> = {}
  if (inline.bold)      flags.bold = true
  if (inline.italic)    flags.italic = true
  if (inline.underline) flags.underline = true
  return flags
}
