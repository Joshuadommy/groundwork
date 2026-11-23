/**
 * Document viewer: /documents/:id/:page[?answer=<answerId>&cite=<label>].
 *
 * The original file comes through GET /api/documents/:id/file (role-checked,
 * with the user's token), never a public URL. PDFs render with react-pdf;
 * Markdown and text render as styled text. With `answer` and `cite`, the
 * cited passage is highlighted on its page (src/lib/highlight.ts).
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { I } from '../../../../../components/icons'
import ViewerBoundary from '../../../../../components/viewer/ViewerBoundary'
import { useDocuments, useNames } from '../../../../../hooks/useWorkspace'
import { fetchDocumentFile } from '../../../../../lib/api'
import { documentMeta } from '../../../../../lib/format'
import type { AnswerData, Citation } from '../../../../../schemas/answers-schema'
import type { DocumentData } from '../../../../../schemas/documents-schema'

const PdfViewer = lazy(() => import('../../../../../components/viewer/PdfViewer'))
const TextViewer = lazy(() => import('../../../../../components/viewer/TextViewer'))

function useCitation(documentId: string | undefined): Citation | null {
  const [params] = useSearchParams()
  const answerId = params.get('answer')
  const label = params.get('cite')
  const { records } = useQuery<AnswerData>('answers', { orderBy: 'createdAt', orderDir: 'desc', limit: 200 })
  return useMemo(() => {
    if (!answerId || !label) return null
    const a = records.find((r) => r.recordId === answerId)
    const c = a?.data.citations.find((x) => x.label === label)
    return c && c.documentId === documentId ? c : null
  }, [records, answerId, label, documentId])
}

export default function DocumentViewerPage() {
  const { id = '', page: pageParam = '1' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const names = useNames()
  const { records: docs, status } = useDocuments()
  const record = docs.find((d) => d.recordId === id)
  const doc: DocumentData | undefined = record?.data
  const citation = useCitation(id)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const ready = doc?.status === 'ready'
  useEffect(() => {
    if (!ready) return
    const ctrl = new AbortController()
    setBlob(null)
    setLoadError(null)
    fetchDocumentFile(id, ctrl.signal)
      .then(setBlob)
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : 'Could not load the file.')
      })
    return () => ctrl.abort()
  }, [id, ready])

  const page = Math.max(1, parseInt(pageParam, 10) || 1)
  const query = params.toString()
  const goTo = (n: number) => navigate(`/documents/${encodeURIComponent(id)}/${n}${query ? `?${query}` : ''}`)

  function download() {
    if (!blob || !doc) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title}.${doc.kind}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const back = (
    <Link className="back" to="/documents">
      {I.left}Documents
    </Link>
  )

  if (status === 'loading') {
    return (
      <main className="view view-wide" id="view">
        {back}
        <div className="loading-row">
          <span className="spin spin-lg" aria-hidden="true" />
          Loading document…
        </div>
      </main>
    )
  }

  if (!doc) {
    return (
      <main className="view" id="view" data-testid="viewer-not-found">
        {back}
        <div className="empty">
          <h3>This document doesn&apos;t exist</h3>
          <p>It may have been deleted, or the link is wrong. Answers that cited it keep their saved excerpts.</p>
        </div>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="view" id="view">
        {back}
        <h2 className="viewer-title">{doc.title}</h2>
        <div className="empty">
          <h3>{doc.status === 'indexing' ? 'Still indexing' : "Couldn't read this file"}</h3>
          <p>
            {doc.status === 'indexing'
              ? 'This document opens here as soon as it is ready to search.'
              : (doc.error ?? 'Indexing failed.') + ' An editor can retry it from the Documents page.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="view view-wide" id="view" data-testid="page-viewer">
      {back}
      <div className="viewer-head">
        <div>
          <h2 className="viewer-title">{doc.title}</h2>
          <div className="sub">
            {documentMeta(doc)}, uploaded by {names.name(doc.uploadedBy)}
          </div>
        </div>
        {doc.kind !== 'pdf' && (
          <button className="btn btn-ghost" onClick={download} disabled={!blob} data-testid="viewer-download">
            {I.download}Download
          </button>
        )}
      </div>
      {loadError ? (
        <div className="banner" role="alert">
          {I.warn}
          <div>
            <b>Couldn&apos;t open this document</b>
            {loadError}
          </div>
        </div>
      ) : !blob ? (
        <div className="loading-row" aria-busy="true">
          <span className="spin spin-lg" aria-hidden="true" />
          Loading document…
        </div>
      ) : (
        <ViewerBoundary resetKey={id} onDownload={download}>
          <Suspense
            fallback={
              <div className="loading-row">
                <span className="spin spin-lg" aria-hidden="true" />
                Loading viewer…
              </div>
            }
          >
            {doc.kind === 'pdf' ? (
              <PdfViewer
                blob={blob}
                page={page}
                pageCount={doc.pageCount}
                citation={citation}
                onPage={goTo}
                onDownload={download}
              />
            ) : (
              <TextViewer blob={blob} kind={doc.kind} citation={citation} />
            )}
          </Suspense>
        </ViewerBoundary>
      )}
    </main>
  )
}
