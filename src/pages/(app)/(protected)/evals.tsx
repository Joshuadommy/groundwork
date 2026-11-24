/**
 * Evals: questions the team flagged as wrong, with each case's latest result.
 * Owners re-run them (runEvals, at most EVAL_RUN_CAP per run, least recently
 * run first); "Changed" means the status or the set of cited (document, page)
 * pairs differs from the previous run, never just the wording.
 */

import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import { I } from '../../../components/icons'
import { SkeletonRows } from '../../../components/SkeletonRows'
import { useAppRole } from '../../../hooks/useAppRole'
import { useLiveQuery } from '../../../hooks/useLiveQuery'
import { useNames } from '../../../hooks/useWorkspace'
import { callAction } from '../../../lib/api'
import { EVAL_RUN_CAP, isManualCase } from '../../../lib/eval-change'
import { shortDate } from '../../../lib/format'
import { canEditDocuments, isOwnerRole } from '../../../roles'
import type { AnswerData, AnswerStatus } from '../../../schemas/answers-schema'
import type { EvalCaseData, EvalRunData } from '../../../schemas/evals-schema'

function ResultPill({ status }: { status: AnswerStatus | undefined }) {
  if (status === 'verified') return <span className="pill p-ready">Verified</span>
  if (status === 'partial') return <span className="pill p-partial">Partially verified</span>
  if (status === 'abstained') return <span className="pill p-none">Not found</span>
  if (status === 'error') return <span className="pill p-fail">Error</span>
  return <span className="pill p-index">Not run yet</span>
}

const QUESTION_MAX = 2000

/** Editors and Owners add a question as an eval case directly (addEvalCase checks the role on the server). */
function AddQuestion() {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { success } = useToast()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const question = value.trim()
    if (!question) return setProblem('Enter a question.')
    if (question.length > QUESTION_MAX) return setProblem(`Questions can be at most ${QUESTION_MAX} characters.`)
    setBusy(true)
    setProblem(null)
    const res = await callAction<{ alreadySaved: boolean }>('addEvalCase', { question })
    setBusy(false)
    if (!res.success) return setProblem(res.error)
    setValue('')
    success(res.data.alreadySaved ? 'That question is already an eval case' : 'Added as an eval case', 'It runs with the next re-run.')
  }

  return (
    <form className="add-case" onSubmit={submit} noValidate data-testid="add-eval-case">
      <div className="field">
        <label htmlFor="evalQuestion">Add a question</label>
        <div className="add-case-row">
          <input
            id="evalQuestion"
            className="input"
            value={value}
            placeholder="A question your documents should answer, or shouldn't"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? 'evalQuestionError' : 'evalQuestionHelp'}
            onChange={(e) => {
              setValue(e.target.value)
              if (problem) setProblem(null)
            }}
            disabled={busy}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spin" aria-hidden="true" />
                Adding
              </>
            ) : (
              'Add question'
            )}
          </button>
        </div>
        {problem ? (
          <span className="field-error" id="evalQuestionError" role="alert">
            {problem}
          </span>
        ) : (
          <span className="field-help" id="evalQuestionHelp">
            Saved without an answer; the next re-run answers it and records the result.
          </span>
        )}
      </div>
    </form>
  )
}

export default function EvalsPage() {
  const { role } = useAppRole()
  const isOwner = isOwnerRole(role)
  const canAdd = canEditDocuments(role)
  const names = useNames()
  const { success, error } = useToast()
  const [running, setRunning] = useState(false)
  const { records: cases, status } = useLiveQuery<EvalCaseData>('evalCases', { orderBy: 'createdAt', orderDir: 'desc', limit: 1000 })
  const { records: runs } = useQuery<EvalRunData>('evalRuns', { orderBy: 'runAt', orderDir: 'desc', limit: 2000 })
  const { records: answers } = useQuery<AnswerData>('answers', { orderBy: 'createdAt', orderDir: 'desc', limit: 500 })

  const latest = useMemo(() => {
    const m = new Map<string, EvalRunData>()
    for (const r of runs) if (!m.has(r.data.evalCaseId)) m.set(r.data.evalCaseId, r.data)
    return m
  }, [runs])
  const answerById = useMemo(() => new Map(answers.map((a) => [a.recordId, a.data])), [answers])

  async function rerun() {
    setRunning(true)
    const res = await callAction<{ ran: number; changed: number; failed: number; notRun: number }>('runEvals')
    setRunning(false)
    if (!res.success) return error('Couldn’t re-run evals', res.error)
    const { ran, changed, failed, notRun } = res.data
    success(
      `Re-ran ${ran} eval case${ran === 1 ? '' : 's'}`,
      [
        `${changed} changed.`,
        failed ? `${failed} failed (AI service).` : '',
        notRun ? `${notRun} more not run this time; run again to cover them.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  const total = cases.length
  const label = total > EVAL_RUN_CAP ? `Re-run ${EVAL_RUN_CAP} of ${total}` : `Re-run all ${total}`

  return (
    <main className="view" id="view" data-testid="page-evals">
      <div className="page-head">
        <div>
          <h2 className="page">Evals</h2>
          <p className="lede">Questions your team flagged as wrong. Re-run them after documents change to see which answers improved.</p>
        </div>
        {isOwner && total > 0 && (
          <button className="btn btn-primary" onClick={() => void rerun()} disabled={running} data-testid="run-evals">
            {running ? (
              <>
                <span className="spin" aria-hidden="true" />
                Re-running…
              </>
            ) : (
              label
            )}
          </button>
        )}
      </div>
      {!isOwner && total > 0 && <div className="locked">Only owners can re-run evals.</div>}
      {canAdd && <AddQuestion />}
      {isOwner && total > EVAL_RUN_CAP && (
        <p className="hint" style={{ marginTop: 12 }}>
          Each run covers up to {EVAL_RUN_CAP} cases, least recently run first.
        </p>
      )}

      {status === 'loading' ? (
        <div className="table-wrap">
          <table role="table" className="table table-cards tc-evals" aria-busy="true" aria-label="Loading eval cases">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">Question</th>
                <th role="columnheader">Latest result</th>
                <th role="columnheader" className="hide-sm">Last run</th>
                <th role="columnheader">Since last run</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              <SkeletonRows cols={4} />
            </tbody>
          </table>
        </div>
      ) : status === 'error' ? (
        <div className="banner" role="alert">
          {I.warn}
          <div>
            <b>Couldn&apos;t load eval cases</b>Check your connection and reload the page.
          </div>
        </div>
      ) : total === 0 ? (
        <div className="empty" data-testid="evals-empty">
          <h3>No eval cases yet</h3>
          <p>
            Eval cases come from answers your team marks as not helpful: on <b>Ask</b>, click the thumbs-down under a wrong
            answer, then <b>Save as eval case</b>. {canAdd ? 'You can also add a question above. ' : ''}After documents change,
            an owner re-runs every case to see which answers improved and which changed.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table role="table" className="table table-cards tc-evals">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">Question</th>
                <th role="columnheader">Latest result</th>
                <th role="columnheader" className="hide-sm">Last run</th>
                <th role="columnheader">Since last run</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {cases.map((c) => {
                const run = latest.get(c.recordId)
                const source = answerById.get(c.data.sourceAnswerId)
                const result = run ?? source
                return (
                  <tr role="row" key={c.recordId} data-testid="eval-row">
                    <td role="cell" className="ev-q">
                      <div className="strong ev-question">{c.data.question}</div>
                      <div className="sub ev-by">
                        {isManualCase(c.data.sourceAnswerId) ? 'Added' : 'Saved from an answer'} by {names.name(c.data.createdBy)}
                      </div>
                      {result && result.status !== 'abstained' && result.answerText && (
                        <details className="ev-details" style={{ marginTop: 6 }}>
                          <summary className="sub" style={{ cursor: 'pointer' }}>
                            {run ? 'Latest answer' : 'Original answer'}
                          </summary>
                          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>{result.answerText}</p>
                          {result.citations.length > 0 && (
                            <p className="sub" style={{ margin: '4px 0 0' }}>
                              Cites:{' '}
                              {[...new Set(result.citations.map((x) => `${x.docTitle} p. ${x.page}`))].join('; ')}
                            </p>
                          )}
                        </details>
                      )}
                    </td>
                    <td role="cell" className="ev-status">
                      <ResultPill status={result?.status} />
                    </td>
                    <td role="cell" className="ev-run">
                      <span className="sub">
                        <span className="card-label">Last run: </span>
                        {run ? (
                          shortDate(run.runAt)
                        ) : (
                          <>
                            <span className="card-label">never</span>
                            <span className="card-hide">Not run</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td role="cell" className="ev-change">
                      {!run ? (
                        <span className="same">Not re-run yet</span>
                      ) : run.changedFromPrevious ? (
                        <span className="changed">Changed</span>
                      ) : (
                        <span className="same">No change</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
