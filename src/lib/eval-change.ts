/**
 * Eval re-run change detection. A re-run "changed" when the verification
 * status differs from the previous run, or the set of cited (document, page)
 * pairs differs. Wording never counts: the model's phrasing varies between
 * runs even at temperature 0. Pure: shared by the runEvals action and tests.
 */

import type { AnswerStatus } from '../schemas/answers-schema'

export interface RunOutcome {
  status: AnswerStatus
  citations: Array<{ documentId: string; page: number }>
}

/** The cited (document, page) pairs as a sorted, de-duplicated list of keys. */
export function citedPages(citations: RunOutcome['citations']): string[] {
  return [...new Set(citations.map((c) => `${c.documentId}#${c.page}`))].sort()
}

/** Cases added with "Add question" have no source answer; their sourceAnswerId is `manual:<id>`. */
export const MANUAL_CASE_PREFIX = 'manual:'
export const isManualCase = (sourceAnswerId: string) => sourceAnswerId.startsWith(MANUAL_CASE_PREFIX)

/** Same question, ignoring case and whitespace (to avoid adding one twice). */
export const sameQuestion = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

/** `previous` is null for a case's first run, which is never "changed". */
export function hasChanged(previous: RunOutcome | null, current: RunOutcome): boolean {
  if (!previous) return false
  if (previous.status !== current.status) return true
  const a = citedPages(previous.citations)
  const b = citedPages(current.citations)
  return a.length !== b.length || a.some((key, i) => key !== b[i])
}

/** Re-runs are capped so one action stays within the request time and cost budget. */
export const EVAL_RUN_CAP = 10

/** Which cases a run covers: the cap's worth, least recently run first. */
export function pickCasesToRun<T extends { id: string; lastRunAt: string | null }>(cases: T[], cap = EVAL_RUN_CAP): T[] {
  return [...cases]
    .sort((a, b) => {
      if (a.lastRunAt === b.lastRunAt) return a.id.localeCompare(b.id)
      if (a.lastRunAt === null) return -1
      if (b.lastRunAt === null) return 1
      return a.lastRunAt.localeCompare(b.lastRunAt)
    })
    .slice(0, cap)
}
