import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { clearHighlight, findTextRange, highlightTarget, paintHighlight, scrollToRange } from '../../lib/highlight'
import type { Citation } from '../../schemas/answers-schema'
import { I } from '../icons'

// The worker is bundled as app code (see pdf-worker.ts for why not a URL to
// the .mjs file). One worker for the tab, reused by every document.
if (!pdfjs.GlobalWorkerOptions.workerPort) {
  pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' })
}

const BASE_WIDTH = 720
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const STEP = 20

function LazyThumb({ n, current, cited, onSelect }: { n: number; current: boolean; cited: boolean; onSelect: (n: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true)
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [current])
  return (
    <button
      ref={ref}
      className="thumb"
      aria-current={current ? 'page' : undefined}
      aria-label={`Page ${n}${cited ? ', contains the cited passage' : ''}`}
      onClick={() => onSelect(n)}
    >
      {visible ? (
        <Page pageNumber={n} width={100} renderTextLayer={false} renderAnnotationLayer={false} loading={<div className="thumb-ph" />} />
      ) : (
        <div className="thumb-ph" />
      )}
      <span>
        {n}
        {cited ? ' · cited' : ''}
      </span>
    </button>
  )
}

export default function PdfViewer({
  blob,
  page,
  pageCount,
  citation,
  onPage,
  onDownload,
}: {
  blob: Blob
  page: number
  pageCount: number
  citation: Citation | null
  onPage: (n: number) => void
  onDownload: () => void
}) {
  const [numPages, setNumPages] = useState(pageCount || 0)
  const [zoom, setZoom] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState(BASE_WIDTH)
  const [pageInput, setPageInput] = useState(String(page))
  const [hl, setHl] = useState<'none' | 'found' | 'missing'>('none')
  const [error, setError] = useState<string | null>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const total = numPages || pageCount || 1
  const n = Math.min(Math.max(1, page), total)
  const fitZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(((containerWidth - 4) / BASE_WIDTH) * 100)))
  const effectiveZoom = zoom ?? Math.min(100, fitZoom)
  const width = Math.round((BASE_WIDTH * effectiveZoom) / 100)
  const citedPage = citation?.page ?? null

  useEffect(() => setPageInput(String(n)), [n])

  useEffect(() => {
    const el = pagesRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Previous/next with the arrow keys, unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return
      if (e.key === 'ArrowLeft' && n > 1) onPage(n - 1)
      if (e.key === 'ArrowRight' && n < total) onPage(n + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [n, total, onPage])

  useEffect(() => {
    setHl('none')
    return clearHighlight
  }, [n, citation])

  const onTextLayer = useCallback(() => {
    if (!citation || citation.page !== n) return
    const layer = frameRef.current?.querySelector('.textLayer')
    const range = layer ? findTextRange(layer, highlightTarget(citation)) : null
    if (range) {
      paintHighlight(range)
      scrollToRange(range)
      setHl('found')
    } else {
      setHl('missing')
    }
  }, [citation, n])

  function submitPage(e?: ReactKeyboardEvent<HTMLInputElement>) {
    if (e && e.key !== 'Enter') return
    const v = Math.min(Math.max(1, parseInt(pageInput, 10) || n), total)
    setPageInput(String(v))
    if (v !== n) onPage(v)
  }

  if (error) {
    return (
      <div className="banner" role="alert">
        {I.warn}
        <div>
          <b>Couldn&apos;t display this PDF</b>
          {error} You can still download it.{' '}
          <button className="link-btn" onClick={onDownload}>
            Download
          </button>
        </div>
      </div>
    )
  }

  return (
    <Document
      file={blob}
      onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
      onLoadError={(e) => setError(e.message)}
      loading={
        <div className="loading-row">
          <span className="spin spin-lg" aria-hidden="true" />
          Opening PDF…
        </div>
      }
    >
      <div className="toolbar" role="toolbar" aria-label="Document controls">
        <div className="tb-group">
          <button className="tb-btn" disabled={n <= 1} aria-label="Previous page" onClick={() => onPage(n - 1)}>
            {I.left}
          </button>
          <label className="sr-only" htmlFor="pageInput">
            Page number
          </label>
          <input
            className="page-input"
            id="pageInput"
            inputMode="numeric"
            value={pageInput}
            aria-describedby="pageTotal"
            data-testid="page-input"
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={submitPage}
            onBlur={() => submitPage()}
          />
          <span className="tb-text" id="pageTotal">
            of {total}
          </span>
          <button className="tb-btn" disabled={n >= total} aria-label="Next page" onClick={() => onPage(n + 1)}>
            {I.right}
          </button>
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <div className="tb-group">
          <button className="tb-btn" disabled={effectiveZoom <= MIN_ZOOM} aria-label="Zoom out" onClick={() => setZoom(Math.max(MIN_ZOOM, effectiveZoom - STEP))}>
            {I.minus}
          </button>
          <span className="tb-text" aria-live="polite" style={{ minWidth: 44, textAlign: 'center' }}>
            {effectiveZoom}%
          </span>
          <button className="tb-btn" disabled={effectiveZoom >= MAX_ZOOM} aria-label="Zoom in" onClick={() => setZoom(Math.min(MAX_ZOOM, effectiveZoom + STEP))}>
            {I.plus}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setZoom(fitZoom)}>
            Fit width
          </button>
        </div>
        <div className="tb-right">
          <button className="btn btn-ghost btn-sm" onClick={onDownload} data-testid="viewer-download">
            {I.download}
            <span className="hide-sm">Download</span>
          </button>
        </div>
      </div>

      {citation && citation.page === n && hl !== 'none' && (
        <div className="cited-tag" role="status" data-testid="cited-tag">
          {I.check}
          {hl === 'found' ? 'Cited passage highlighted on this page' : 'The cited passage is on this page'}
        </div>
      )}
      {citation && citation.page !== n && (
        <p className="hint" style={{ marginTop: 12 }}>
          The cited passage is on{' '}
          <button className="link-btn" onClick={() => onPage(citation.page)}>
            page {citation.page}
          </button>
          .
        </p>
      )}

      <div className="viewer">
        <nav className="thumbs" aria-label="Pages">
          {Array.from({ length: total }, (_, i) => (
            <LazyThumb key={i + 1} n={i + 1} current={i + 1 === n} cited={citedPage === i + 1} onSelect={onPage} />
          ))}
        </nav>
        <div className="pages" ref={pagesRef}>
          <section className="pdf-frame" ref={frameRef} aria-label={`Page ${n} of ${total}`} data-testid="pdf-page">
            <Page
              key={n}
              pageNumber={n}
              width={width}
              renderAnnotationLayer={false}
              onRenderTextLayerSuccess={onTextLayer}
              loading={<div className="page-ph" style={{ width }}>Loading page {n}…</div>}
              error={<div className="page-ph" style={{ width }}>Couldn&apos;t render page {n}.</div>}
            />
          </section>
        </div>
      </div>
    </Document>
  )
}
