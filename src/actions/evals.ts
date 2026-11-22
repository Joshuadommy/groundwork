/**
 * Eval cases and re-runs.
 *
 *   saveEvalCase  Editors and Owners: save an answer's question as an eval
 *                 case (one per source answer; saving twice is a no-op).
 *   runEvals      Owners: re-run up to EVAL_RUN_CAP cases through the same
 *                 pipeline as askQuestion, inside this action (no job), and
 *                 record whether each outcome changed (src/lib/eval-change.ts).
 *
 * Eval cases and runs have create: false for every client role, so these
 * actions are the only writers.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { answerQuestion } from '../lib/answer-question'
import { EVAL_RUN_CAP, hasChanged, pickCasesToRun, type RunOutcome } from '../lib/eval-change'
import type { AnswerData } from '../schemas/answers-schema'
import type { EvalCaseData, EvalRunData } from '../schemas/evals-schema'
import { modelGenerator } from '../server/generation'
import { knowledgeRetriever } from '../server/retrieval'
import { withRole } from '../server/roles'
import { EDITOR_ROLES, OWNER_ROLES } from '../roles'
import { readyDocumentsFrom } from './ask'

const RUN_CONCURRENCY = 3

export const saveEvalCase: ActionHandler<Env> = withRole(EDITOR_ROLES, async ({ userId, params, tools }) => {
  const answerId = typeof params.answerId === 'string' ? params.answerId : ''
  if (!answerId) return { success: false, error: 'answerId is required.' }
  const answer = await tools.get<AnswerData>('answers', answerId)
  if (!answer.success) return { success: false, error: 'Answer not found.' }
  const a = answer.data.record.data
  if (a.status === 'pending' || a.status === 'error') {
    return { success: false, error: 'Only finished answers can be saved as eval cases.' }
  }

  const existing = await tools.query<EvalCaseData>('evalCases', { where: { sourceAnswerId: answerId }, limit: 1 })
  if (existing.success && existing.data.records.length > 0) {
    return { success: true, data: { evalCaseId: existing.data.records[0].recordId, alreadySaved: true } }
  }
  const created = await tools.create<EvalCaseData>('evalCases', {
    question: a.question,
    sourceAnswerId: answerId,
    createdBy: userId,
  })
  if (!created.success) return created
  console.info(`[evals] case ${created.data.recordId} from answer ${answerId} by ${userId}`)
  return { success: true, data: { evalCaseId: created.data.recordId, alreadySaved: false } }
})

async function latestRuns(tools: ActionTools): Promise<Map<string, EvalRunData>> {
  const runs = await tools.query<EvalRunData>('evalRuns', { orderBy: 'runAt', orderDir: 'desc', limit: 2000 })
  const latest = new Map<string, EvalRunData>()
  if (runs.success) {
    for (const r of runs.data.records) if (!latest.has(r.data.evalCaseId)) latest.set(r.data.evalCaseId, r.data)
  }
  return latest
}

/** The outcome a run is compared with: the case's last run, else the answer it was saved from. */
async function baselineFor(tools: ActionTools, c: EvalCaseData, last: EvalRunData | undefined): Promise<RunOutcome | null> {
  if (last) return { status: last.status, citations: last.citations }
  const source = await tools.get<AnswerData>('answers', c.sourceAnswerId)
  if (!source.success) return null
  return { status: source.data.record.data.status, citations: source.data.record.data.citations }
}

export const runEvals: ActionHandler<Env> = withRole(OWNER_ROLES, async ({ tools, env }) => {
  const cases = await tools.query<EvalCaseData>('evalCases', { limit: 500 })
  if (!cases.success) return { success: false, error: 'Could not load eval cases.' }
  if (cases.data.records.length === 0) return { success: false, error: 'There are no eval cases to run.' }

  const latest = await latestRuns(tools)
  const chosen = pickCasesToRun(
    cases.data.records.map((r) => ({ id: r.recordId, data: r.data, lastRunAt: latest.get(r.recordId)?.runAt ?? null })),
  )
  const batchId = `batch_${Date.now().toString(36)}`
  const deps = {
    retrieve: knowledgeRetriever(env),
    readyDocuments: readyDocumentsFrom(tools),
    generate: modelGenerator(env),
  }

  let changed = 0
  let failed = 0
  let next = 0
  async function worker() {
    while (next < chosen.length) {
      const c = chosen[next++]
      try {
        const baseline = await baselineFor(tools, c.data, latest.get(c.id))
        const result = await answerQuestion(c.data.question, deps)
        const isChanged = hasChanged(baseline, { status: result.status, citations: result.citations })
        if (isChanged) changed++
        const run: EvalRunData = {
          evalCaseId: c.id,
          batchId,
          answerText: result.answerText,
          citations: result.citations,
          status: result.status,
          changedFromPrevious: isChanged,
          runAt: new Date().toISOString(),
        }
        await tools.create('evalRuns', run)
      } catch (error) {
        failed++
        console.error(`[evals] case ${c.id} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(RUN_CONCURRENCY, chosen.length) }, worker))

  const total = cases.data.records.length
  console.info(`[evals] ${batchId} ran=${chosen.length} changed=${changed} failed=${failed} total=${total}`)
  return {
    success: true,
    data: {
      batchId,
      ran: chosen.length - failed,
      changed,
      failed,
      notRun: Math.max(0, total - chosen.length),
      cap: EVAL_RUN_CAP,
    },
  }
})
