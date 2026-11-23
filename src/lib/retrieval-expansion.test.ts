/**
 * Guards the retrieval fix for "Not in your documents" on reworded questions
 * (morning review, Nov 23): managed-knowledge search returned nothing unless
 * the query's wording was close to the page's (a relevance cutoff that mode
 * and matchThreshold did not change). This fake retriever approximates that
 * strictly: a page comes back only if it contains every content word of the
 * query. Pages are fictional, shaped like the uploaded Workplace
 * Relationships Policy.
 */
import { describe, expect, it, vi } from 'vitest'
import { answerQuestion, cleanQueries, mergeChunks, type AnswerDeps, type RetrievedChunk } from './answer-question'

const DOC = 'doc_relationships'
const PAGES: Record<number, string> = {
  3: 'Romantic relationships between colleagues. Employees in a romantic relationship with a colleague must disclose it to People Operations within 30 days.',
  4: 'Gifts and hospitality. A manager may not give a direct report gifts worth more than $75 in a calendar year.',
  5: 'Reporting harassment. People Operations will respond quickly to a harassment report, within two business days.',
}

const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9$]+/g) ?? []
const STOP = new Set(['do', 'i', 'to', 'if', 'im', 'a', 'the', 'can', 'what', 's', 'whats', 'how', 'will', 'is', 'my', 'need', 'anyone', 'tell', 'someone'])

/** A page matches only if it contains every content word of the query: a strict stand-in for "wording close to the page". */
function lexicalRetriever(query: string): RetrievedChunk[] {
  const terms = words(query).filter((w) => !STOP.has(w))
  if (terms.length === 0) return []
  return Object.entries(PAGES)
    .filter(([, text]) => terms.every((t) => words(text).includes(t)))
    .map(([page, text]) => ({
      id: `${DOC}-p${page}`,
      score: 0.9,
      text,
      key: `docs/${DOC}/p${String(page).padStart(4, '0')}.txt`,
    }))
}

function deps(expand?: (q: string) => Promise<string[]>) {
  const generate = vi.fn(async (_q: string, passages: { label: string; page: number }[]) => {
    const hit = passages.find((p) => p.page === 3 || p.page === 4)
    return hit
      ? { answer: `Yes [${hit.label}].`, citations: [hit.label], answerable: true }
      : { answer: '', citations: [], answerable: false }
  })
  const d: AnswerDeps = {
    retrieve: vi.fn(async (q: string) => lexicalRetriever(q)),
    readyDocuments: async () => new Map([[DOC, { title: 'Workplace Relationships Policy' }]]),
    generate,
    ...(expand ? { expandQuery: vi.fn(expand) } : {}),
  }
  return { d, generate }
}

describe('retrieval on a lexical-only search', () => {
  it('reproduces the bug: a reworded question retrieves nothing and abstains before the model', async () => {
    const { d, generate } = deps()
    const r = await answerQuestion("Do I need to tell anyone if I'm dating a coworker?", d)
    expect(r.status).toBe('abstained')
    expect(r.generated).toBe(false)
    expect(generate).not.toHaveBeenCalled()
  })

  it('finds page 3 for the dating question through expanded keyword searches', async () => {
    const { d } = deps(async () => ['dating', 'romantic relationship', 'colleague relationship'])
    const r = await answerQuestion("Do I need to tell anyone if I'm dating a coworker?", d)
    expect(r.status).toBe('verified')
    expect(r.citations.map((c) => c.page)).toEqual([3])
    expect(r.expandedQueries).toEqual(['dating', 'romantic relationship', 'colleague relationship'])
  })

  it('finds page 4 for the gift question through expanded keyword searches', async () => {
    const { d } = deps(async () => ['gifts', 'gift limit', 'direct report gifts'])
    const r = await answerQuestion("What's the maximum gift I can give someone I manage?", d)
    expect(r.status).toBe('verified')
    expect(r.citations.map((c) => c.page)).toEqual([4])
  })

  it('does not expand when the question itself retrieves passages (no extra model call)', async () => {
    const expand = vi.fn(async () => ['should not run'])
    const { d } = deps(expand)
    const r = await answerQuestion('How quickly will People Operations respond to a harassment report?', d)
    expect(expand).not.toHaveBeenCalled()
    expect(r.passages.map((p) => p.page)).toEqual([5])
    expect(r.expandedQueries).toEqual([])
  })

  it('still abstains, without the answer model, when expanded searches find nothing either', async () => {
    const { d, generate } = deps(async () => ['dress code', 'attire', 'clothing'])
    const r = await answerQuestion("What's the dress code?", d)
    expect(r.status).toBe('abstained')
    expect(generate).not.toHaveBeenCalled()
  })

  it('treats a failed expansion as no expansion, not a failed ask', async () => {
    const { d } = deps(async () => {
      throw new Error('model unavailable')
    })
    const r = await answerQuestion("Do I need to tell anyone if I'm dating a coworker?", d)
    expect(r.status).toBe('abstained')
    expect(r.expandedQueries).toEqual([])
  })
})

describe('mergeChunks and cleanQueries', () => {
  it('keeps one entry per chunk with its best score, best first', () => {
    const c = (id: string, score: number) => ({ id, score, text: id })
    expect(mergeChunks([c('a', 0.2), c('b', 0.5)], [c('a', 0.9)]).map((x) => [x.id, x.score])).toEqual([
      ['a', 0.9],
      ['b', 0.5],
    ])
  })

  it('trims, drops blanks, duplicates and the question itself, and caps at five', () => {
    expect(cleanQueries([' Gifts ', 'gifts', '', 'Q?', 'a', 'b', 'c', 'd', 'e'], 'q?')).toEqual(['Gifts', 'a', 'b', 'c', 'd'])
  })
})
