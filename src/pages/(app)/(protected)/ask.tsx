/**
 * Ask: the team's shared thread of questions and verified answers, newest
 * first, live for everyone. Answers are written only by the askQuestion
 * action; this page reads them and opens citations in the source panel.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { AnswerCard } from '../../../components/ask/AnswerCard'
import { Feedback } from '../../../components/ask/Feedback'
import { SourcePanel } from '../../../components/ask/SourcePanel'
import { I } from '../../../components/icons'
import { useAppRole } from '../../../hooks/useAppRole'
import { useDocuments, useNames } from '../../../hooks/useWorkspace'
import { callAction } from '../../../lib/api'
import { canEditDocuments } from '../../../roles'
import type { AnswerData, Citation } from '../../../schemas/answers-schema'

const QUESTION_MAX = 2000
const SUGGESTIONS = [
  'How many days a week can I work remotely, and what are the core hours?',
  'What is the home office stipend, and will Northwind pay for a standing desk?',
  'How many weeks of parental leave does Northwind Ops offer?',
]

export default function AskPage() {
  const { role } = useAppRole()
  const names = useNames()
  const { records: docs, status: docsStatus } = useDocuments()
  const { records: answers, status } = useQuery<AnswerData>('answers', { orderBy: 'createdAt', orderDir: 'desc', limit: 50 })
  const [open, setOpen] = useState<{ answerId: string; label: string } | null>(null)
  const [banner, setBanner] = useState<{ question: string; error: string } | null>(null)

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

  async function ask(question: string): Promise<boolean> {
    setBanner(null)
    const res = await callAction<{ answerId: string }>('askQuestion', { question })
    if (!res.success) {
      setBanner({ question, error: res.error })
      return false
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

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

        {banner && (
          <div className="banner" role="alert" data-testid="ask-error">
            {I.warn}
            <div>
              <b>{banner.error.includes('AI service') ? 'Groundwork couldn’t reach the AI service' : 'Your question wasn’t sent'}</b>
              {banner.error}{' '}
              <button className="link-btn" onClick={() => void ask(banner.question)}>
                Try again
              </button>
            </div>
          </div>
        )}

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
            <div className="thread">
              {answers.map((r) => (
                <AnswerCard
                  key={r.recordId}
                  record={r}
                  askedBy={r.data.askedBy === r.createdBy ? names.name(r.data.askedBy) : names.name(r.createdBy)}
                  openLabel={open?.answerId === r.recordId ? open.label : null}
                  onCite={(c: Citation) =>
                    setOpen((cur) => (cur?.answerId === r.recordId && cur.label === c.label ? null : { answerId: r.recordId, label: c.label }))
                  }
                  onRetry={(q) => void ask(q)}
                  footer={<Feedback answer={r} />}
                />
              ))}
            </div>
            {answers.length < 2 && (
              <div className="empty">
                <h3>Try a question</h3>
                <p>These questions about the sample documents show each kind of result.</p>
                <div className="suggest">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => void ask(s)}>
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
      <Composer disabled={loading || noDocs} onAsk={ask} />
    </>
  )
}

function Composer({ disabled, onAsk }: { disabled: boolean; onAsk: (q: string) => Promise<boolean> }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const tooLong = value.length > QUESTION_MAX

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const q = value.trim()
    if (!q || busy || disabled || tooLong) return
    setBusy(true)
    const ok = await onAsk(q)
    setBusy(false)
    if (ok) setValue('')
    ref.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
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
        <button className="btn btn-primary" type="submit" disabled={disabled || busy || !value.trim() || tooLong}>
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </form>
    </div>
  )
}
