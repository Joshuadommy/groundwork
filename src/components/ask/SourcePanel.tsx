import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Citation } from '../../schemas/answers-schema'
import type { DocumentKind } from '../../schemas/documents-schema'
import { I } from '../icons'

export function viewerHref(c: Citation, answerId: string, kind: DocumentKind | undefined): string {
  const page = kind && kind !== 'pdf' ? 1 : c.page
  return `/documents/${encodeURIComponent(c.documentId)}/${page}?answer=${encodeURIComponent(answerId)}&cite=${encodeURIComponent(c.label)}`
}

/** The excerpt, with the verified supporting quote marked. */
function Excerpt({ c }: { c: Citation }) {
  const i = c.quote ? c.excerpt.indexOf(c.quote) : -1
  if (!c.quote || i < 0) return <div className="excerpt">{c.excerpt}</div>
  return (
    <div className="excerpt">
      {c.excerpt.slice(0, i)}
      <mark>{c.quote}</mark>
      {c.excerpt.slice(i + c.quote.length)}
    </div>
  )
}

export function SourcePanel({
  citation,
  answerId,
  kind,
  deleted,
  onClose,
}: {
  citation: Citation
  answerId: string
  kind: DocumentKind | undefined
  deleted: boolean
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus(), [citation.label, answerId])
  const isPdf = !kind || kind === 'pdf'
  return (
    <aside className="source" id="source-panel" aria-label="Source passage" data-testid="source-panel">
      <div className="source-head">
        <div>
          <h3>{citation.docTitle}</h3>
          <div className="doc">
            {isPdf ? `Page ${citation.page}` : 'Document'}
            {deleted ? ' · deleted document' : ''}
          </div>
        </div>
        <button ref={closeRef} className="close" aria-label="Close source" onClick={onClose}>
          {I.x}
        </button>
      </div>
      <Excerpt c={citation} />
      <div className="source-note">
        {I.shield}
        <span>This passage was retrieved for the answer and matched the citation on the server.</span>
      </div>
      {deleted ? (
        <p className="hint" style={{ marginTop: 16 }}>
          This document has been deleted, so it can&apos;t be opened. The excerpt above was saved with the answer.
        </p>
      ) : (
        <Link className="btn btn-ghost btn-block open-page" to={viewerHref(citation, answerId, kind)} data-testid="open-page">
          {isPdf ? `Open page ${citation.page}` : 'Open document'} in {citation.docTitle}
        </Link>
      )}
    </aside>
  )
}
