/**
 * Ask: the team's shared thread of questions and verified answers, newest
 * first, live for everyone. Answers are written only by the askQuestion
 * action; this page reads them and opens citations in the source panel.
 *
 * Asking (design/prototype.html "Ask flow"): the textbox clears at once and
 * the question appears in the thread with live steps. The steps follow the
 * pending answer's real `stage`, found by the request id this page sends.
 * The answer fades in when it arrives; a failed ask shows an inline error
 * with Try again (the server saves nothing for it).
 */

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { AnswerCard } from '../../../components/ask/AnswerCard'
import { Feedback } from '../../../components/ask/Feedback'
import { AskErrorCard, PendingCard } from '../../../components/ask/PendingCard'
import { SourcePanel } from '../../../components/ask/SourcePanel'
import { I } from '../../../components/icons'
import { useAppRole } from '../../../hooks/useAppRole'
import { useLiveQuery } from '../../../hooks/useLiveQuery'
import { useDocuments, useNames } from '../../../hooks/useWorkspace'
import { callAction } from '../../../lib/api'
import { canEditDocuments } from '../../../roles'
import type { AnswerData, Citation } from '../../../schemas/answers-schema'
import type { EvalCaseData } from '../../../schemas/evals-schema'
import type { FeedbackData } from '../../../schemas/feedback-schema'

const QUESTION_MAX = 2000
/** A pending answer older than this didn't finish (the worker stopped); show it as failed. */
const STALE_PENDING_MS = 3 * 60 * 1000

/** One question asked from this page, until its answer is saved (or it fails). */
interface LocalAsk {
  requestId: string
  question: string
  error?: string
}

function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}
const SUGGESTIONS = [
  'How many days a week can I work remotely, and what are the core hours?',
  'What is the home office stipend, and will Northwind pay for a standing desk?',
  'How many weeks of parental leave does Northwind Ops offer?',
]

export default function AskPage() {
  const { role } = useAppRole()
  const names = useNames()
  const { records: docs, status: docsStatus } = useDocuments()
  const { records: answers, status } = useLiveQuery<AnswerData>('answers', { orderBy: 'createdAt', orderDir: 'desc', limit: 50 })
  // One live subscription each for all ratings and saved cases, grouped per answer.
  const { records: ratings } = useQuery<FeedbackData>('feedback', { limit: 5000 })
  const { records: cases } = useQuery<EvalCaseData>('evalCases', { limit: 1000 })
  const ratingsByAnswer = useMemo(() => {
    const m = new Map<string, typeof ratings>()
    for (const r of ratings) m.set(r.data.answerId, [...(m.get(r.data.answerId) ?? []), r])
    return m
  }, [ratings])
  const savedAnswers = useMemo(() => new Set(cases.map((c) => c.data.sourceAnswerId)), [cases])
  const [open, setOpen] = useState<{ answerId: string; label: string } | null>(null)
  const [local, setLocal] = useState<LocalAsk[]>([])
  const { user: me } = useUser()
  // Answers created after this page opened fade in; older ones render still.
  const [openedAt] = useState(() => Date.now() - 2000)

  const readyCount = docs.filter((d) => d.data.status === 'ready').length
  const docsById = useMemo(() => new Map(docs.map((d) => [d.recordId, d.data])), [docs])
  const openAnswer = open ? answers.find((a) => a.recordId === open.answerId) : undefined
  const openCitation = openAnswer?.data.citations.find((c) => c.label === open?.label)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const byRequest = useMemo(() => {
    const m = new Map<string, (typeof answers)[number]>()
    for (const a of answers) if (a.data.requestId) m.set(a.data.requestId, a)
    return m
  }, [answers])
  // My question is in flight until its answer is final or it failed.
  const busy = local.some((l) => !l.error && (byRequest.get(l.requestId)?.data.status ?? 'pending') === 'pending')

  function ask(question: string) {
    const requestId = newRequestId()
    setLocal((cur) => [{ requestId, question }, ...cur])
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    void callAction<{ answerId: string }>('askQuestion', { question, requestId }).then((res) => {
      setLocal((cur) =>
        res.success ? cur.filter((l) => l.requestId !== requestId) : cur.map((l) => (l.requestId === requestId ? { ...l, error: res.error } : l)),
      )
    })
  }

  function retry(requestId: string, question: string) {
    setLocal((cur) => cur.filter((l) => l.requestId !== requestId))
    ask(question)
  }

  const askedByName = (userId: string) => (userId === me?.id ? 'you' : names.name(userId))
  const localByRequest = new Map(local.map((l) => [l.requestId, l]))

  const loading = status === 'loading' || docsStatus === 'loading'
  const noDocs = !loading && readyCount === 0

  return (
    <>
      <main className="view" id="view" data-testid="page-ask">
        <h2 className="page">Ask your documents</h2>
        <p className="lede">
          Every answer cites the exact passage it came from. If a citation doesn&apos;t match what was retrieved, it&apos;s
          removed before you see it.
        </p>

        {loading ? (
          <div aria-busy="true" style={{ marginTop: 36 }}>
            <div className="skel skel-line" style={{ width: '60%', height: 20 }} />
            <div className="skel skel-line" style={{ width: '95%' }} />
            <div className="skel skel-line" style={{ width: '88%' }} />
            <div className="skel skel-line" style={{ width: '40%' }} />
          </div>
        ) : noDocs ? (
          <div className="empty" data-testid="ask-empty-no-docs">
            <h3>No documents yet</h3>
            <p>
              {canEditDocuments(role)
                ? docs.length
                  ? 'Your documents are still being indexed. You can ask questions as soon as one is ready.'
                  : 'Upload a policy, handbook, or notes file and you can start asking questions about it.'
                : 'An editor needs to upload documents before anyone can ask questions. Ask an owner or editor on your team.'}
            </p>
            {canEditDocuments(role) && (
              <div className="row" style={{ marginTop: 16 }}>
                <Link className="btn btn-primary" to="/documents?upload=1">
                  Upload document
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="thread" data-testid="thread">
              {/* My questions the server hasn't created a record for yet, or that failed. */}
              {local
                .filter((l) => l.error || !byRequest.has(l.requestId))
                .map((l) =>
                  l.error ? (
                    <AskErrorCard
                      key={l.requestId}
                      question={l.question}
                      askedBy="you"
                      message={l.error}
                      onRetry={() => retry(l.requestId, l.question)}
                    />
                  ) : (
                    <PendingCard key={l.requestId} question={l.question} askedBy="you" stage="searching" documentCount={readyCount} />
                  ),
                )}
              {answers.map((r) => {
                const failedHere = r.data.requestId ? localByRequest.get(r.data.requestId)?.error : undefined
                if (failedHere) return null // shown above as the inline error
                const askedBy = askedByName(r.data.askedBy || r.createdBy)
                const pending = r.data.status === 'pending' && Date.now() - Date.parse(r.createdAt) < STALE_PENDING_MS
                if (pending) {
                  return (
                    <PendingCard
                      key={`${r.recordId}:pending`}
                      question={r.data.question}
                      askedBy={askedBy}
                      stage={r.data.stage ?? 'searching'}
                      documentCount={readyCount}
                    />
                  )
                }
                return (
                  <AnswerCard
                    key={r.recordId}
                    record={r}
                    askedBy={askedBy}
                    fresh={Date.parse(r.createdAt) >= openedAt}
                    openLabel={open?.answerId === r.recordId ? open.label : null}
                    onCite={(c: Citation) =>
                      setOpen((cur) => (cur?.answerId === r.recordId && cur.label === c.label ? null : { answerId: r.recordId, label: c.label }))
                    }
                    onRetry={(q) => ask(q)}
                    footer={<Feedback answer={r} ratings={ratingsByAnswer.get(r.recordId) ?? []} saved={savedAnswers.has(r.recordId)} />}
                  />
                )
              })}
            </div>
            {answers.length + local.length < 2 && (
              <div className="empty">
                <h3>Try a question</h3>
                <p>These questions about the sample documents show each kind of result.</p>
                <div className="suggest">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} disabled={busy}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      {openAnswer && openCitation && (
        <SourcePanel
          citation={openCitation}
          answerId={openAnswer.recordId}
          kind={docsById.get(openCitation.documentId)?.kind}
          deleted={!docsById.has(openCitation.documentId)}
          onClose={() => setOpen(null)}
        />
      )}
      <Composer disabled={loading || noDocs} busy={busy} onAsk={ask} />
    </>
  )
}

function Composer({ disabled, busy, onAsk }: { disabled: boolean; busy: boolean; onAsk: (q: string) => void }) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const tooLong = value.length > QUESTION_MAX

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const q = value.trim()
    if (!q || busy || disabled || tooLong) return
    // Clear at once: the question is already in the thread.
    setValue('')
    onAsk(q)
    ref.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [value])

  return (
    <div className="composer-wrap">
      {tooLong && <div className="composer-error">Questions can be at most {QUESTION_MAX} characters.</div>}
      <form className={`composer${disabled ? ' disabled' : ''}`} onSubmit={submit} data-testid="composer">
        <label htmlFor="qInput" className="sr-only">
          Ask a question about your documents
        </label>
        <textarea
          id="qInput"
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          aria-invalid={tooLong}
          placeholder={disabled ? 'Add a document before asking questions' : "Ask a question about your team's documents"}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className="btn btn-primary send"
          type="submit"
          disabled={disabled || busy || tooLong}
          aria-label={busy ? 'Answering your question' : 'Send question'}
          data-testid="send"
        >
          {busy ? <span className="spin" aria-hidden="true" /> : I.send}
        </button>
      </form>
    </div>
  )
}
