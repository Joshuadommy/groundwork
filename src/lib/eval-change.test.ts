import { describe, expect, it } from 'vitest'
import { citedPages, EVAL_RUN_CAP, hasChanged, pickCasesToRun, type RunOutcome } from './eval-change'

const run = (status: RunOutcome['status'], ...pages: Array<[string, number]>): RunOutcome => ({
  status,
  citations: pages.map(([documentId, page]) => ({ documentId, page })),
})

describe('hasChanged', () => {
  it('is false for the first run of a case', () => {
    expect(hasChanged(null, run('verified', ['remote', 2]))).toBe(false)
  })

  it('is true when the status changes', () => {
    expect(hasChanged(run('abstained'), run('verified', ['remote', 2]))).toBe(true)
    expect(hasChanged(run('verified', ['remote', 2]), run('partial', ['remote', 2]))).toBe(true)
  })

  it('is true when the set of cited pages changes', () => {
    expect(hasChanged(run('verified', ['remote', 2]), run('verified', ['remote', 4]))).toBe(true)
    expect(hasChanged(run('verified', ['remote', 2]), run('verified', ['remote', 2], ['expenses', 8]))).toBe(true)
    expect(hasChanged(run('verified', ['remote', 2]), run('verified', ['other', 2]))).toBe(true)
  })

  it('ignores citation order, repeats and labels (wording is not part of the outcome)', () => {
    const before = run('verified', ['remote', 2], ['remote', 4])
    const after = run('verified', ['remote', 4], ['remote', 2], ['remote', 2])
    expect(hasChanged(before, after)).toBe(false)
  })

  it('is false when both runs abstain', () => {
    expect(hasChanged(run('abstained'), run('abstained'))).toBe(false)
  })
})

describe('citedPages', () => {
  it('sorts and de-duplicates (document, page) pairs', () => {
    expect(citedPages(run('verified', ['b', 3], ['a', 9], ['b', 3]).citations)).toEqual(['a#9', 'b#3'])
  })
})

describe('pickCasesToRun', () => {
  it('runs never-run cases first, then the least recently run, up to the cap', () => {
    const cases = Array.from({ length: 14 }, (_, i) => ({ id: `c${String(i).padStart(2, '0')}`, lastRunAt: `2026-11-${10 + i}T00:00:00Z` as string | null }))
    cases[13].lastRunAt = null
    const picked = pickCasesToRun(cases)
    expect(picked).toHaveLength(EVAL_RUN_CAP)
    expect(picked[0].id).toBe('c13')
    expect(picked[1].id).toBe('c00')
    expect(picked.map((c) => c.id)).not.toContain('c12')
  })
})
