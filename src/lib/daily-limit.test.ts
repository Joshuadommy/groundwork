import { describe, expect, it, vi } from 'vitest'
import { checkDailyLimit, DAILY_LIMIT_MESSAGE, DAILY_QUESTION_LIMIT, isOverDailyLimit, questionsInWindow } from './daily-limit'

const NOW = Date.parse('2026-11-25T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString()

describe('daily question limit', () => {
  it('counts only questions from the last 24 hours', () => {
    expect(questionsInWindow([hoursAgo(1), hoursAgo(23.9), hoursAgo(24), hoursAgo(30), 'not a date'], NOW)).toBe(2)
  })

  it('allows the 20th question and refuses the 21st for Viewers and Editors', () => {
    expect(DAILY_QUESTION_LIMIT).toBe(20)
    for (const role of ['member', 'editor'] as const) {
      expect(isOverDailyLimit(role, 19)).toBe(false)
      expect(isOverDailyLimit(role, 20)).toBe(true)
    }
  })

  it('exempts Owners, however many they asked', () => {
    expect(isOverDailyLimit('admin', 500)).toBe(false)
  })

  it('refuses on the server with the friendly message once 20 were asked in 24 hours', async () => {
    const recent = Array.from({ length: 20 }, (_, i) => hoursAgo(i))
    expect(await checkDailyLimit('member', async () => recent, NOW)).toEqual({ ok: false, error: DAILY_LIMIT_MESSAGE })
    expect(DAILY_LIMIT_MESSAGE).toBe("You've reached today's limit of 20 questions. Try again tomorrow.")
  })

  it('allows again once older questions leave the 24-hour window', async () => {
    const recent = [...Array.from({ length: 19 }, (_, i) => hoursAgo(i)), hoursAgo(25)]
    expect(await checkDailyLimit('editor', async () => recent, NOW)).toEqual({ ok: true })
  })

  it('does not even look up an Owner’s history', async () => {
    const lookup = vi.fn(async () => [] as string[])
    expect(await checkDailyLimit('admin', lookup, NOW)).toEqual({ ok: true })
    expect(lookup).not.toHaveBeenCalled()
  })
})
