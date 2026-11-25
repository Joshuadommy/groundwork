/**
 * deleteAnswer — Owners only. Removes an answer and its ratings so a
 * confusing or test answer no longer shows on Ask. Eval cases saved from the
 * answer are kept untouched: each case stores its own copy of the question,
 * and a case whose source answer is gone runs normally (its first run has no
 * baseline to compare with, see baselineFor in ./evals.ts).
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { AnswerData } from '../schemas/answers-schema'
import type { FeedbackData } from '../schemas/feedback-schema'
import { withRole } from '../server/roles'
import { OWNER_ROLES } from '../roles'

/** Shared by the deleteAnswer action and the delete_answer agent tool (callers check the role). */
export async function runDeleteAnswer(tools: ActionTools, userId: string, rawAnswerId: unknown) {
  const answerId = typeof rawAnswerId === 'string' ? rawAnswerId : ''
  if (!answerId) return { success: false as const, error: 'answerId is required.' }
  const got = await tools.get<AnswerData>('answers', answerId)
  if (!got.success) return { success: false as const, error: 'Answer not found.' }
  if (got.data.record.data.status === 'pending') {
    return { success: false as const, error: 'This answer is still being written. Try again when it finishes.' }
  }

  const ratings = await tools.query<FeedbackData>('feedback', { where: { answerId }, limit: 1000 })
  let ratingsRemoved = 0
  if (ratings.success) {
    for (const r of ratings.data.records) {
      const removed = await tools.remove('feedback', r.recordId)
      if (removed.success) ratingsRemoved++
    }
  }
  const removed = await tools.remove('answers', answerId)
  if (!removed.success) return { success: false as const, error: removed.error ?? 'Could not delete the answer.' }
  console.info(`[answers] deleted ${answerId} by ${userId} ratings=${ratingsRemoved}`)
  return { success: true as const, data: { answerId, question: got.data.record.data.question, ratingsRemoved } }
}

export const deleteAnswer: ActionHandler<Env> = withRole(OWNER_ROLES, async ({ userId, params, tools }) =>
  runDeleteAnswer(tools, userId, params.answerId),
)
