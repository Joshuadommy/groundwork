import { Fragment, type ReactNode } from 'react'
import type { RecordData } from 'deepspace'
import type { AnswerData, Citation } from '../../schemas/answers-schema'
import { I } from '../icons'

export const COVERAGE_NOTE = "Answers part of your question; your documents don't cover the rest."
const MARKER = /\[\s*(S\d+(?:\s*,\s*S\d+)*)\s*\]/gi

export function StatusBlock({ answer }: { answer: AnswerData }) {
  const n = answer.citations.length
  if (answer.status === 'verified')
    return (
      <div className="status st-verified" data-testid="status-verified">
        {I.check}
        <div>
          <b>Verified</b>
          <span>
            {n} of {n} citation{n === 1 ? '' : 's'} match{n === 1 ? 'es' : ''} passages retrieved from your documents.
          </span>
        </div>
      </div>
    )
  if (answer.status === 'partial') {
    const r = answer.removedCitations.length
    return (
      <div className="status st-partial" data-testid="status-partial">
        {I.warn}
        <div>
          <b>Partially verified</b>
          <span>
            {r} citation{r === 1 ? " didn't" : "s didn't"} match a retrieved passage and {r === 1 ? 'was' : 'were'} removed.
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className="status st-none" data-testid="status-abstained">
      {I.search}
      <div>
        <b>Not in your documents</b>
        <span>No retrieved passage supports an answer, so Groundwork didn&apos;t guess.</span>
      </div>
    </div>
  )
}

/** Answer text with [S1]-style markers turned into numbered citation chips. */
function AnswerBody({
  answer,
  openLabel,
  onCite,
  answerId,
}: {
  answer: AnswerData
  openLabel: string | null
  onCite: (label: string) => void
  answerId: string
}) {
  if (answer.status === 'abstained')
    return <p>I couldn&apos;t find this in your documents. Try rephrasing, or ask an editor to upload a document that covers it.</p>
  const index = new Map(answer.citations.map((c, i) => [c.label.toUpperCase(), { c, n: i + 1 }]))
  const paragraphs = answer.answerText.split(/\n{2,}/).filter((p) => p.trim())
  return (
    <>
      {paragraphs.map((para, pi) => {
        const parts: ReactNode[] = []
        let last = 0
        for (const m of para.matchAll(MARKER)) {
          parts.push(para.slice(last, m.index))
          for (const raw of m[1].split(',')) {
            const hit = index.get(raw.trim().toUpperCase())
            if (!hit) continue
            parts.push(
              <button
                key={`${m.index}-${hit.n}`}
                type="button"
                className="cite"
                aria-expanded={openLabel === hit.c.label}
                aria-controls="source-panel"
                aria-label={`Source ${hit.n}: ${hit.c.docTitle}, page ${hit.c.page}`}
                data-testid={`cite-${answerId}-${hit.n}`}
                onClick={() => onCite(hit.c.label)}
              >
                {hit.n}
              </button>,
            )
          }
          last = (m.index ?? 0) + m[0].length
        }
        parts.push(para.slice(last))
        return (
          <p key={pi}>
            {parts.map((p, i) => (
              <Fragment key={i}>{p}</Fragment>
            ))}
          </p>
        )
      })}
    </>
  )
}

export function AnswerCard({
  record,
  askedBy,
  openLabel,
  onCite,
  onRetry,
  footer,
  fresh,
}: {
  record: RecordData<AnswerData>
  askedBy: string
  openLabel: string | null
  onCite: (citation: Citation) => void
  onRetry: (question: string) => void
  footer?: ReactNode
  /** Fade in: the answer just arrived on this page. */
  fresh?: boolean
}) {
  const a = record.data
  const id = record.recordId
  const when = new Date(record.createdAt)
  return (
    <article aria-labelledby={`q-${id}`} data-testid="answer" data-status={a.status} className={fresh ? 'reveal' : undefined}>
      <h3 className="q" id={`q-${id}`}>
        {a.question}
      </h3>
      <div className="q-meta">
        Asked by {askedBy} ·{' '}
        <time dateTime={record.createdAt}>{when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
      </div>
      {a.status === 'pending' || a.status === 'error' ? (
        // Pending answers render as PendingCard on the Ask page; this covers a
        // stuck pending record and error records saved before failures were removed.
        <div className="status st-error" role="alert">
          {I.warn}
          <div>
            <b>Couldn&apos;t answer this question</b>
            <span>
              {a.status === 'pending' ? 'This question didn’t finish.' : a.error || 'The AI service didn’t respond.'}{' '}
              <button className="link-btn" onClick={() => onRetry(a.question)}>
                Try again
              </button>
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="answer" data-testid="answer-text">
            <AnswerBody
              answer={a}
              answerId={id}
              openLabel={openLabel}
              onCite={(label) => {
                const c = a.citations.find((x) => x.label === label)
                if (c) onCite(c)
              }}
            />
          </div>
          <StatusBlock answer={a} />
          {a.coverage === 'partial' && a.status !== 'abstained' && (
            <div className="coverage" data-testid="coverage-note">
              {I.warn}
              <span>{COVERAGE_NOTE}</span>
            </div>
          )}
          {a.removedCitations.length > 0 && (
            <div className="removed">
              Removed citation{a.removedCitations.length === 1 ? '' : 's'}:{' '}
              {a.removedCitations.map((l, i) => (
                <Fragment key={l}>
                  {i > 0 && ', '}
                  <s>[{l}]</s>
                </Fragment>
              ))}
              , not among the retrieved passages.
            </div>
          )}
          {footer}
        </>
      )}
    </article>
  )
}
