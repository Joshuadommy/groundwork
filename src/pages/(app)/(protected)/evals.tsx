/**
 * Evals: questions the team flagged as wrong, with each case's latest result.
 * Owners re-run them (runEvals, at most EVAL_RUN_CAP per run, least recently
 * run first); "Changed" means the status or the set of cited (document, page)
 * pairs differs from the previous run, never just the wording.
 */

import { useMemo, useState } from 'react'
import { useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import { I } from '../../../components/icons'
import { useAppRole } from '../../../hooks/useAppRole'
import { useNames } from '../../../hooks/useWorkspace'
import { callAction } from '../../../lib/api'
import { EVAL_RUN_CAP } from '../../../lib/eval-change'
import { shortDate } from '../../../lib/format'
import { isOwnerRole } from '../../../roles'
import type { AnswerData, AnswerStatus } from '../../../schemas/answers-schema'
import type { EvalCaseData, EvalRunData } from '../../../schemas/evals-schema'

function ResultPill({ status }: { status: AnswerStatus | undefined }) {
  if (status === 'verified') return <span className="pill p-ready">Verified</span>
  if (status === 'partial') return <span className="pill p-partial">Partially verified</span>
  if (status === 'abstained') return <span className="pill p-none">Not found</span>
  if (status === 'error') return <span className="pill p-fail">Error</span>
  return <span className="pill p-none">Unknown</span>
}

export default function EvalsPage() {
  const { role } = useAppRole()
  const isOwner = isOwnerRole(role)
  const names = useNames()
  const { success, error } = useToast()
  const [running, setRunning] = useState(false)
  const { records: cases, status } = useQuery<EvalCaseData>('evalCases', { orderBy: 'createdAt', orderDir: 'desc', limit: 1000 })
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
      {isOwner && total > EVAL_RUN_CAP && (
        <p className="hint" style={{ marginTop: 12 }}>
          Each run covers up to {EVAL_RUN_CAP} cases, least recently run first.
        </p>
      )}

      {status === 'loading' ? (
        <div className="loading-row">
          <span className="spin spin-lg" aria-hidden="true" />
          Loading eval cases…
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
            When an answer is wrong, mark it not helpful and save it as an eval case. You can re-run every case after documents
            change.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Latest result</th>
                <th className="hide-sm">Last run</th>
                <th>Since last run</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const run = latest.get(c.recordId)
                const source = answerById.get(c.data.sourceAnswerId)
                const result = run ?? source
                return (
                  <tr key={c.recordId} data-testid="eval-row">
                    <td>
                      <div className="strong">{c.data.question}</div>
                      <div className="sub">Saved by {names.name(c.data.createdBy)}</div>
                      {result && result.status !== 'abstained' && result.answerText && (
                        <details style={{ marginTop: 6 }}>
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
                    <td>
                      <ResultPill status={result?.status} />
                    </td>
                    <td className="hide-sm">
                      <span className="sub">{run ? shortDate(run.runAt) : 'Not run'}</span>
                    </td>
                    <td>
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
