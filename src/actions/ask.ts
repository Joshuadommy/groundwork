/**
 * askQuestion — approved teammates (Viewer, Editor, Owner).
 *
 * Creates the answer as `pending` first so it appears live for the whole team,
 * moves its `stage` along as the pipeline runs (searching → reading →
 * checking), then writes the result to the same record. If the pipeline
 * fails, the pending record is removed (nothing is saved as an answer) and
 * the asker's page shows the error with Try again. Answers are written only
 * here (clients have create: false on `answers`), so a "Verified" status can
 * only come from verifyCitations.
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { answerQuestion, type ReadyDocument } from '../lib/answer-question'
import { REQUEST_ID_PATTERN, type AnswerData } from '../schemas/answers-schema'
import type { DocumentData } from '../schemas/documents-schema'
import { knowledgeRetriever } from '../server/retrieval'
import { ANSWER_MODEL, modelGenerator } from '../server/generation'
import { modelQueryExpander } from '../server/query-expansion'
import { withRole } from '../server/roles'
import { TEAM_ROLES } from '../roles'

export const QUESTION_MAX_CHARS = 2000
export const AI_ERROR = "The AI service didn't respond. Nothing was saved as an answer."

/** Look up which of `ids` are documents in `ready` status. */
export function readyDocumentsFrom(tools: ActionTools) {
  return async (ids: string[]): Promise<Map<string, ReadyDocument>> => {
    const found = await Promise.all(
      ids.map(async (id) => {
        const r = await tools.get<DocumentData>('documents', id)
        return r.success && r.data.record.data.status === 'ready'
          ? ([id, { title: r.data.record.data.title }] as const)
          : null
      }),
    )
    return new Map(found.filter((x) => x !== null))
  }
}

/** The ask flow, shared by the askQuestion action and the ask_question agent tool. */
export async function runAsk(
  env: Env,
  tools: ActionTools,
  userId: string,
  rawQuestion: unknown,
  rawRequestId?: unknown,
): Promise<ActionResult<{ answerId: string; status: AnswerData['status'] }>> {
  const question = typeof rawQuestion === 'string' ? rawQuestion.trim() : ''
  if (!question) return { success: false, error: 'Enter a question.' }
  if (question.length > QUESTION_MAX_CHARS) {
    return { success: false, error: `Questions can be at most ${QUESTION_MAX_CHARS} characters.` }
  }
  if (rawRequestId !== undefined && (typeof rawRequestId !== 'string' || !REQUEST_ID_PATTERN.test(rawRequestId))) {
    return { success: false, error: 'Invalid request id.' }
  }
  const requestId = rawRequestId as string | undefined

  const pending: AnswerData = {
    question,
    answerText: '',
    citations: [],
    removedCitations: [],
    status: 'pending',
    askedBy: userId,
    model: ANSWER_MODEL,
    stage: 'searching',
    ...(requestId ? { requestId } : {}),
  }
  const created = await tools.create('answers', pending)
  if (!created.success) return created
  const answerId = created.data.recordId

  try {
    const result = await answerQuestion(question, {
      retrieve: knowledgeRetriever(env),
      readyDocuments: readyDocumentsFrom(tools),
      generate: modelGenerator(env),
      expandQuery: modelQueryExpander(env),
      // Progress is best effort: a failed stage write never fails the ask.
      onStage: async (stage) => {
        await tools.update('answers', answerId, { stage }).catch(() => undefined)
      },
    })
    const update: Partial<AnswerData> = {
      status: result.status,
      answerText: result.answerText,
      citations: result.citations,
      removedCitations: result.removedCitations,
      ...(result.coverage ? { coverage: result.coverage } : {}),
    }
    const saved = await tools.update('answers', answerId, update)
    if (!saved.success) return saved
    console.info(
      `[ask] answer=${answerId} status=${result.status} passages=${result.passages.length} ` +
        `cited=${result.citations.length} removed=${result.removedCitations.length} generated=${result.generated} coverage=${result.coverage ?? "-"}` +
        (result.expandedQueries.length ? ` expanded=${JSON.stringify(result.expandedQueries)}` : ''),
    )
    return { success: true, data: { answerId, status: result.status } }
  } catch (error) {
    console.error(`[ask] answer=${answerId} failed: ${error instanceof Error ? error.message : String(error)}`)
    // Nothing is saved as an answer: the pending card disappears for the team,
    // and the asker's page shows the error inline with Try again.
    const removed = await tools.remove('answers', answerId).catch(() => ({ success: false as const }))
    if (!removed.success) {
      await tools.update('answers', answerId, { status: 'error', error: AI_ERROR }).catch(() => undefined)
    }
    return { success: false, error: AI_ERROR }
  }
}

export const askQuestion: ActionHandler<Env> = withRole(TEAM_ROLES, async ({ userId, params, tools, env }) =>
  runAsk(env, tools, userId, params.question, params.requestId),
)
