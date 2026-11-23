/**
 * An answer in progress and a failed ask, from design/prototype.html.
 *
 * The steps follow the pending answer's real `stage`, written by the
 * askQuestion action as the pipeline runs: searching (retrieval) → reading
 * (the model reads the passages) → checking (citations verified). Before the
 * server has created the record, the asker's own card shows the first step.
 */

import type { AnswerStage } from '../../schemas/answers-schema'
import { I } from '../icons'

const STAGE_INDEX: Record<AnswerStage, number> = { searching: 0, reading: 1, checking: 2 }

export function PendingCard({
  question,
  askedBy,
  stage,
  documentCount,
}: {
  question: string
  askedBy: string
  stage: AnswerStage
  documentCount: number
}) {
  const at = STAGE_INDEX[stage] ?? 0
  const steps = [
    `Searching ${documentCount} document${documentCount === 1 ? '' : 's'}`,
    'Reading the most relevant passages',
    'Checking every citation against the sources',
  ]
  return (
    <article className="pending reveal" aria-busy="true" aria-live="polite" data-testid="answer-pending" data-stage={stage}>
      <h3 className="q">{question}</h3>
      <div className="q-meta">Asked by {askedBy}, just now</div>
      <div className="steps">
        {steps.map((text, i) => (
          <div key={text} className={`step${i < at ? ' done' : i === at ? ' active' : ''}`} data-testid={`step-${i}`}>
            <span className="step-ico">{i < at ? I.tick : <span className="ring" />}</span>
            {text}
          </div>
        ))}
      </div>
      <div className="skel-lines" aria-hidden="true">
        <div className="skel" style={{ width: '92%' }} />
        <div className="skel" style={{ width: '84%' }} />
        <div className="skel" style={{ width: '58%' }} />
      </div>
    </article>
  )
}

/** The inline error for an ask that failed (nothing was saved), with Try again. */
export function AskErrorCard({
  question,
  askedBy,
  message,
  onRetry,
}: {
  question: string
  askedBy: string
  message: string
  onRetry: () => void
}) {
  return (
    <article className="reveal" data-testid="ask-error">
      <h3 className="q">{question}</h3>
      <div className="q-meta">Asked by {askedBy}, just now</div>
      <div className="status st-error" role="alert">
        {I.warn}
        <div>
          <b>Couldn&apos;t answer this question</b>
          <span>
            {message}{' '}
            <button className="link-btn" onClick={onRetry} data-testid="ask-retry">
              Try again
            </button>
          </span>
        </div>
      </div>
    </article>
  )
}
