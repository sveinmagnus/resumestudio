/**
 * Minimal ambient types for pdfmake's browser build submodules. We don't pull
 * in @types/pdfmake — the doc definition is built as loose `Record` shapes and
 * pdfmake validates at runtime, so we only need to type the two entry points we
 * lazy-import in `lib/pdfExporter.ts`.
 */
declare module 'pdfmake/build/pdfmake' {
  interface PdfDocGenerator {
    download(filename?: string): void
    open(): void
    getBlob(cb: (blob: Blob) => void): void
  }
  /**
   * A doc definition's `footer` callback. pdfmake hands it the total page count
   * once layout is done — the only public way to learn the real pagination, and
   * how `countPdfPages` in lib/pdfExporter.ts gets a truthful number.
   */
  type FooterFn = (currentPage: number, pageCount: number, pageSize: unknown) => unknown
  interface PdfMakeStatic {
    vfs: Record<string, string>
    fonts?: Record<string, unknown>
    createPdf(docDefinition: unknown): PdfDocGenerator
  }
  const pdfMake: PdfMakeStatic
  export default pdfMake
  export type { FooterFn, PdfMakeStatic }
}

declare module 'pdfmake/build/vfs_fonts' {
  // pdfmake 0.2.x ships the font table as the module's default export.
  const vfs: Record<string, string>
  export default vfs
}
