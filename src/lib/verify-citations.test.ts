import { describe, expect, it } from 'vitest'
import { ABSTAIN_TEXT, extractInlineLabels, verifyCitations, type LabeledPassage } from './verify-citations'

const passage = (label: string, page: number, text = `Text of ${label}.`): LabeledPassage => ({
  label,
  chunkId: `chunk-${label}`,
  documentId: 'doc1',
  docTitle: 'Remote Work Policy',
  page,
  text,
})

const PASSAGES = [passage('S1', 2), passage('S2', 4)]

describe('verifyCitations', () => {
  it('marks an answer verified when every citation was retrieved', () => {
    const result = verifyCitations(
      {
        answer: 'You can work remotely up to three days a week [S1]. Core hours are 10 to 3 [S2].',
        citations: ['S1', 'S2'],
        answerable: true,
      },
      PASSAGES,
    )
    expect(result.status).toBe('verified')
    expect(result.removedCitations).toEqual([])
    expect(result.citations.map((c) => [c.label, c.page, c.documentId])).toEqual([
      ['S1', 2, 'doc1'],
      ['S2', 4, 'doc1'],
    ])
    expect(result.answerText).toBe(
      'You can work remotely up to three days a week [S1]. Core hours are 10 to 3 [S2].',
    )
  })

  it('strips invented citations and marks the answer partially verified', () => {
    const result = verifyCitations(
      {
        answer: 'Three days a week [S1]. Interns get equity [S7]. Core hours apply [S2, S9].',
        citations: ['S1', 'S7', 'S2'],
        answerable: true,
      },
      PASSAGES,
    )
    expect(result.status).toBe('partial')
    expect(result.removedCitations).toEqual(['S7', 'S9'])
    expect(result.citations.map((c) => c.label)).toEqual(['S1', 'S2'])
    expect(result.answerText).toBe('Three days a week [S1]. Interns get equity. Core hours apply [S2].')
    expect(result.answerText).not.toMatch(/S7|S9/)
  })

  it('abstains when no cited label was retrieved', () => {
    const result = verifyCitations(
      { answer: 'Interns get equity [S5].', citations: ['S5', 'S6'], answerable: true },
      PASSAGES,
    )
    expect(result.status).toBe('abstained')
    expect(result.answerText).toBe(ABSTAIN_TEXT)
    expect(result.citations).toEqual([])
    expect(result.removedCitations).toEqual(['S5', 'S6'])
  })

  it('abstains when the answer cites nothing at all', () => {
    const result = verifyCitations(
      { answer: 'Probably three days a week.', citations: [], answerable: true },
      PASSAGES,
    )
    expect(result.status).toBe('abstained')
    expect(result.answerText).toBe(ABSTAIN_TEXT)
  })

  it('abstains when the model says the passages do not answer the question', () => {
    const result = verifyCitations({ answer: '', citations: [], answerable: false }, PASSAGES)
    expect(result.status).toBe('abstained')
    expect(result.answerText).toBe(ABSTAIN_TEXT)
  })

  it('abstains when nothing was retrieved, even if the model cites labels', () => {
    const result = verifyCitations({ answer: 'Yes [S1].', citations: ['S1'], answerable: true }, [])
    expect(result.status).toBe('abstained')
    expect(result.citations).toEqual([])
  })

  it('counts citations listed only in the citations array, and normalizes case', () => {
    const result = verifyCitations(
      { answer: 'Three days a week [s1].', citations: ['s2', 'not-a-label'], answerable: true },
      PASSAGES,
    )
    expect(result.status).toBe('verified')
    expect(result.citations.map((c) => c.label)).toEqual(['S1', 'S2'])
    expect(result.answerText).toBe('Three days a week [S1].')
  })

  it('deduplicates repeated citations and keeps first-seen order', () => {
    const result = verifyCitations(
      { answer: 'A [S2]. B [S1, S2]. C [S2].', citations: ['S2', 'S1'], answerable: true },
      PASSAGES,
    )
    expect(result.citations.map((c) => c.label)).toEqual(['S2', 'S1'])
  })

  it('snapshots a bounded excerpt of the cited passage', () => {
    const long = 'word '.repeat(200)
    const result = verifyCitations(
      { answer: 'Answer [S1].', citations: ['S1'], answerable: true },
      [passage('S1', 3, long)],
    )
    expect(result.citations[0].excerpt.length).toBeLessThanOrEqual(320)
    expect(result.citations[0].excerpt.endsWith('…')).toBe(true)
  })
})

describe('extractInlineLabels', () => {
  it('reads single and grouped markers in order', () => {
    expect(extractInlineLabels('a [S1] b [S3, s2] c [ S4 ]')).toEqual(['S1', 'S3', 'S2', 'S4'])
  })

  it('ignores brackets that are not passage labels', () => {
    expect(extractInlineLabels('see [1] and [Section 2] and [S]')).toEqual([])
  })
})
