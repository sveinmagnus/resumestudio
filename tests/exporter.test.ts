/**
 * @vitest-environment jsdom
 *
 * The exporter relies on `Blob`, `URL.createObjectURL`, `document.createElement`,
 * and `URL.revokeObjectURL` to trigger a browser download. jsdom provides
 * everything except `URL.createObjectURL`, which we stub below.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exportDocx } from '../src/lib/exporter'
import { buildViewSections } from '../src/lib/viewFilter'
import {
  emptyStore, makeProject, makeWork, makeEducation, makeView,
  makeKQ, makeReference,
} from './fixtures'

// ─── Capture the blob the exporter wants to download ────────────────────────
let lastBlob: Blob | null = null

beforeEach(() => {
  lastBlob = null
  // jsdom doesn't implement these — stub them so we can inspect the blob.
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: (b: Blob) => { lastBlob = b; return 'blob:fake' },
  })
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: () => {} })
  // The anchor's .click() must be a no-op (jsdom's default tries to navigate).
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A real .docx is a zip — its first bytes are the local file header PK\x03\x04. */
async function isZip(blob: Blob): Promise<boolean> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
}

/** Search the binary docx for a substring (XML payload is uncompressed enough for tiny tests). */
async function blobContains(blob: Blob, needle: string): Promise<boolean> {
  // Use JSZip-free check: scan raw bytes for the UTF-8 sequence.
  // Word stores body text in word/document.xml; even though the archive entries
  // are deflated, short user strings often survive in stored mode or in the
  // central directory's filename list. To avoid flakiness we just verify
  // the file *is* a zip and inspect the size / count of expected entries.
  const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()))
  return text.includes(needle)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('exportDocx()', () => {
  it('produces a valid zipped .docx blob from an empty store', async () => {
    const store = emptyStore()
    const view  = makeView({ sections: buildViewSections() })
    await exportDocx(store, view, 'en')

    expect(lastBlob).not.toBeNull()
    expect(lastBlob!.size).toBeGreaterThan(0)
    expect(await isZip(lastBlob!)).toBe(true)
  })

  it('includes the standard Word OOXML parts (word/document.xml etc.)', async () => {
    const store = emptyStore()
    const view  = makeView({ sections: buildViewSections() })
    await exportDocx(store, view, 'en')

    // Central directory carries filenames in plaintext — easy to grep for.
    expect(await blobContains(lastBlob!, 'word/document.xml')).toBe(true)
    expect(await blobContains(lastBlob!, '[Content_Types].xml')).toBe(true)
  })

  it('produces a larger document when there is more content', async () => {
    const small = emptyStore()
    const big   = emptyStore()
    big.projects.push(makeProject({ customer: { en: 'BigCustomer' } }))
    big.projects.push(makeProject({ customer: { en: 'AnotherOne' } }))
    big.work_experiences.push(makeWork())
    big.educations.push(makeEducation())
    big.key_qualifications.push(makeKQ())

    const view = makeView({ sections: buildViewSections() })
    await exportDocx(small, view, 'en')
    const smallSize = lastBlob!.size

    await exportDocx(big, view, 'en')
    const bigSize = lastBlob!.size

    expect(bigSize).toBeGreaterThan(smallSize)
  })

  it('honours view.excluded_item_ids by skipping those items', async () => {
    const storeA = emptyStore()
    storeA.projects.push(makeProject({ id: 'p1', customer: { en: 'KeepMe' } }))
    storeA.projects.push(makeProject({ id: 'p2', customer: { en: 'DropMe' } }))

    const storeB = emptyStore()
    storeB.projects.push(makeProject({ id: 'p1', customer: { en: 'KeepMe' } }))

    const viewAll = makeView({ sections: buildViewSections() })
    const viewExcluding = makeView({
      sections: buildViewSections(),
      excluded_item_ids: ['p2'],
    })

    await exportDocx(storeA, viewExcluding, 'en')
    const excludedSize = lastBlob!.size

    await exportDocx(storeB, viewAll, 'en')
    const onlyOneSize = lastBlob!.size

    // Excluding p2 from storeA should produce essentially the same as storeB.
    // Allow a few bytes of difference for ordering/whitespace.
    expect(Math.abs(excludedSize - onlyOneSize)).toBeLessThan(200)
  })

  it('does not include references where include_in_exports is false', async () => {
    const storeWithPublic = emptyStore()
    storeWithPublic.references.push(makeReference({
      name: 'PublicRef', include_in_exports: true,
    }))

    const storeWithPrivate = emptyStore()
    storeWithPrivate.references.push(makeReference({
      name: 'PrivateRef', include_in_exports: false,
    }))

    const view = makeView({ sections: buildViewSections() })
    await exportDocx(storeWithPublic, view, 'en')
    const sizePublic = lastBlob!.size

    await exportDocx(storeWithPrivate, view, 'en')
    const sizePrivate = lastBlob!.size

    // Private reference should be filtered out → smaller output.
    expect(sizePrivate).toBeLessThan(sizePublic)
  })

  it('triggers a download by creating an anchor with the resume_view filename', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement')
    const store = emptyStore()
    if (store.resume) store.resume.full_name = 'Ada Lovelace'
    const view = makeView({ name: 'Board CV', sections: buildViewSections() })
    await exportDocx(store, view, 'en')

    // Find the anchor that the exporter created
    const anchors = createElementSpy.mock.results
      .map((r) => r.value as HTMLElement)
      .filter((el) => el.tagName === 'A') as HTMLAnchorElement[]
    expect(anchors.length).toBeGreaterThan(0)
    const dl = anchors[anchors.length - 1].download
    expect(dl).toBe('Ada_Lovelace_Board_CV.docx')
  })

  it('still works when view.sections is empty (defaults to all enabled)', async () => {
    const store = emptyStore()
    store.projects.push(makeProject())
    const view = makeView({ sections: [] })
    await exportDocx(store, view, 'en')
    expect(await isZip(lastBlob!)).toBe(true)
  })

  it('renders the view introduction when set', async () => {
    const store = emptyStore()
    const withIntro = makeView({
      sections: buildViewSections(),
      introduction: { en: 'My custom intro paragraph' },
    })
    const withoutIntro = makeView({
      sections: buildViewSections(),
      introduction: {},
    })
    await exportDocx(store, withoutIntro, 'en')
    const baseline = lastBlob!.size
    await exportDocx(store, withIntro, 'en')
    expect(lastBlob!.size).toBeGreaterThan(baseline)
  })
})
