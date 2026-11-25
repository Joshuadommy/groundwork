/**
 * Per-user daily question limit (design/prototype.html "daily question
 * limit"). Each ask is an owner-billed model call, so approved teammates may
 * ask DAILY_QUESTION_LIMIT questions in any rolling 24 hours; Owners are
 * exempt. Enforced on the server in runAsk (every way to ask goes through it);
 * the Ask page uses the same rule to disable the composer.
 */

import type { AppRole } from '../roles'

export const DAILY_QUESTION_LIMIT = 20
export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000
export const DAILY_LIMIT_MESSAGE = `You've reached today's limit of ${DAILY_QUESTION_LIMIT} questions. Try again tomorrow.`

/** How many of these timestamps fall in the last 24 hours. */
export function questionsInWindow(createdAts: string[], now = Date.now()): number {
  return createdAts.filter((iso) => {
    const t = Date.parse(iso)
    return Number.isFinite(t) && now - t < DAILY_WINDOW_MS && t <= now + 60_000
  }).length
}

/** Owners are exempt; everyone else may ask while under the limit. */
export function isOverDailyLimit(role: AppRole | null | undefined, askedInWindow: number): boolean {
  if (role === 'admin') return false
  return askedInWindow >= DAILY_QUESTION_LIMIT
}

/**
 * The server check. `recentAskTimes` returns the createdAt of the caller's
 * most recent answers (at least DAILY_QUESTION_LIMIT of them, newest first).
 */
export async function checkDailyLimit(
  role: AppRole | null,
  recentAskTimes: () => Promise<string[]>,
  now = Date.now(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (role === 'admin') return { ok: true }
  const count = questionsInWindow(await recentAskTimes(), now)
  return isOverDailyLimit(role, count) ? { ok: false, error: DAILY_LIMIT_MESSAGE } : { ok: true }
}
