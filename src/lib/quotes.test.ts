import { describe, expect, it } from 'vitest'
import type { Citation } from '../schemas/answers-schema'
import { attachQuotes, locateQuote, windowAround } from './quotes'
import type { LabeledPassage } from './verify-citations'

const page2 =
  'Northwind Ops - Remote Work Policy Page 2 of 6\n2. Eligibility and remote days\nEmployees become eligible after 90 days.\n' +
  'Once eligible, an employee may work remotely up to three days per week. The remaining two\ndays are worked in the office. ' +
  'Tuesday and Thursday are company-wide anchor days.'

const passage: LabeledPassage = { label: 'S1', chunkId: 'c1', documentId: 'remote', docTitle: 'Remote Work Policy', page: 2, text: page2 }
const citation: Citation = { label: 'S1', documentId: 'remote', docTitle: 'Remote Work Policy', page: 2, excerpt: 'start…', chunkId: 'c1' }

describe('locateQuote', () => {
  it('finds a quote across line breaks, ignoring whitespace and case', () => {
    const hit = locateQuote(page2, 'the remaining two days are worked in the office')
    expect(hit).not.toBeNull()
    expect(hit!.flat.slice(hit!.start, hit!.end)).toBe('The remaining two days are worked in the office')
  })

  it('rejects text that is not in the passage, and trivially short quotes', () => {
    expect(locateQuote(page2, 'employees may work remotely five days per week')).toBeNull()
    expect(locateQuote(page2, 'days')).toBeNull()
  })
})

describe('attachQuotes', () => {
  it('keeps a verbatim quote and centres the excerpt on it', () => {
    const [c] = attachQuotes([citation], [passage], [{ label: 's1', quote: '“work remotely up to three days per week”' }])
    expect(c.quote).toBe('work remotely up to three days per week')
    expect(c.excerpt).toContain('work remotely up to three days per week')
    expect(c.excerpt.length).toBeLessThanOrEqual(322)
  })

  it('drops a quote the passage does not contain and leaves the citation unchanged', () => {
    const [c] = attachQuotes([citation], [passage], [{ label: 'S1', quote: 'up to five days per week from anywhere' }])
    expect(c).toEqual(citation)
  })

  it('ignores quotes for labels that were not cited', () => {
    const [c] = attachQuotes([citation], [passage], [{ label: 'S2', quote: 'work remotely up to three days per week' }])
    expect(c.quote).toBeUndefined()
  })
})

describe('windowAround', () => {
  it('adds ellipses only where text was cut', () => {
    const flat = 'a '.repeat(300) + 'TARGET' + ' b'.repeat(300)
    const start = flat.indexOf('TARGET')
    const w = windowAround(flat, start, start + 6, 100)
    expect(w.startsWith('…')).toBe(true)
    expect(w.endsWith('…')).toBe(true)
    expect(w).toContain('TARGET')
    expect(windowAround('short text', 0, 5)).toBe('short text')
  })
})
