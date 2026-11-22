import { describe, expect, it, vi } from 'vitest'
import { answerQuestion, MAX_PASSAGES, type AnswerDeps, type GeneratedAnswer, type RetrievedChunk } from './answer-question'
import { ABSTAIN_TEXT, type LabeledPassage } from './verify-citations'

const chunk = (id: string, documentId: string, page: number, score: number, text = `Text ${id}`): RetrievedChunk => ({
  id,
  score,
  text,
  key: `docs/${documentId}/p${String(page).padStart(4, '0')}.txt`,
  folder: `docs/${documentId}/`,
  filename: `p${String(page).padStart(4, '0')}.txt`,
})

const READY = new Map([
  ['remote', { title: 'Remote Work Policy' }],
  ['expenses', { title: 'Expense Guidelines' }],
])

function deps(
  chunks: RetrievedChunk[],
  answer: GeneratedAnswer | ((passages: LabeledPassage[]) => GeneratedAnswer),
  ready = READY,
) {
  const generate = vi.fn(async (_q: string, passages: LabeledPassage[]) =>
    typeof answer === 'function' ? answer(passages) : answer,
  )
  const d: AnswerDeps = {
    retrieve: vi.fn(async () => chunks),
    readyDocuments: vi.fn(async (ids: string[]) => new Map([...ready].filter(([id]) => ids.includes(id)))),
    generate,
  }
  return { d, generate }
}

describe('answerQuestion', () => {
  it('returns a verified answer whose citations carry document and page', async () => {
    const { d, generate } = deps(
      [chunk('c1', 'remote', 2, 0.9), chunk('c2', 'remote', 4, 0.8)],
      { answer: 'Three days a week [S1]. Core hours 10–3 [S2].', citations: ['S1', 'S2'], answerable: true },
    )
    const result = await answerQuestion('How many remote days?', d)

    expect(result.status).toBe('verified')
    expect(result.generated).toBe(true)
    expect(result.citations).toMatchObject([
      { label: 'S1', documentId: 'remote', docTitle: 'Remote Work Policy', page: 2, chunkId: 'c1' },
      { label: 'S2', documentId: 'remote', docTitle: 'Remote Work Policy', page: 4, chunkId: 'c2' },
    ])
    // The model saw the labelled passages, best score first.
    const shown = generate.mock.calls[0][1]
    expect(shown.map((p) => [p.label, p.chunkId])).toEqual([
      ['S1', 'c1'],
      ['S2', 'c2'],
    ])
  })

  it('returns partially verified and strips the invented label', async () => {
    const { d } = deps([chunk('c1', 'expenses', 5, 0.9)], {
      answer: 'The meal allowance is $60 [S1]. International travel gets $90 [S4].',
      citations: ['S1', 'S4'],
      answerable: true,
    })
    const result = await answerQuestion('Meal allowance?', d)

    expect(result.status).toBe('partial')
    expect(result.removedCitations).toEqual(['S4'])
    expect(result.answerText).toBe('The meal allowance is $60 [S1]. International travel gets $90.')
  })

  it('abstains without calling the model when nothing is retrieved', async () => {
    const { d, generate } = deps([], { answer: 'x [S1]', citations: ['S1'], answerable: true })
    const result = await answerQuestion('Do interns get equity?', d)

    expect(result.status).toBe('abstained')
    expect(result.answerText).toBe(ABSTAIN_TEXT)
    expect(result.generated).toBe(false)
    expect(generate).not.toHaveBeenCalled()
  })

  it('abstains without calling the model when hits belong to documents that are not ready', async () => {
    const { d, generate } = deps(
      [chunk('c1', 'deleted-doc', 1, 0.95), { id: 'junk', score: 0.9, text: 'stray', key: 'other/thing.txt' }],
      { answer: 'x [S1]', citations: ['S1'], answerable: true },
    )
    const result = await answerQuestion('Anything?', d)

    expect(result.status).toBe('abstained')
    expect(generate).not.toHaveBeenCalled()
  })

  it('abstains when the model says the passages do not answer the question', async () => {
    const { d, generate } = deps([chunk('c1', 'remote', 1, 0.4)], {
      answer: '',
      citations: [],
      answerable: false,
    })
    const result = await answerQuestion('Do interns get equity?', d)

    expect(generate).toHaveBeenCalledOnce()
    expect(result.status).toBe('abstained')
    expect(result.citations).toEqual([])
  })

  it('drops hits from documents that are not ready and labels the rest S1..Sn', async () => {
    const { d, generate } = deps(
      [chunk('gone', 'deleted-doc', 1, 0.99), chunk('c1', 'remote', 2, 0.7), chunk('c2', 'expenses', 5, 0.8)],
      (passages) => ({ answer: `A [${passages[0].label}].`, citations: [], answerable: true }),
    )
    const result = await answerQuestion('q', d)

    const shown = generate.mock.calls[0][1]
    expect(shown.map((p) => [p.label, p.documentId, p.page])).toEqual([
      ['S1', 'expenses', 5],
      ['S2', 'remote', 2],
    ])
    expect(result.citations[0]).toMatchObject({ label: 'S1', documentId: 'expenses', page: 5 })
  })

  it('deduplicates repeated chunks and caps the passages shown to the model', async () => {
    const many = Array.from({ length: MAX_PASSAGES + 4 }, (_, i) => chunk(`c${i}`, 'remote', i + 1, 1 - i / 100))
    const { d, generate } = deps([...many, many[0]], { answer: 'A [S1].', citations: [], answerable: true })
    await answerQuestion('q', d)

    const shown = generate.mock.calls[0][1]
    expect(shown).toHaveLength(MAX_PASSAGES)
    expect(new Set(shown.map((p) => p.chunkId)).size).toBe(MAX_PASSAGES)
    expect(shown.at(-1)!.label).toBe(`S${MAX_PASSAGES}`)
  })

  it('propagates generation failures so the caller can record an error', async () => {
    const d: AnswerDeps = {
      retrieve: async () => [chunk('c1', 'remote', 2, 0.9)],
      readyDocuments: async () => READY,
      generate: async () => {
        throw new Error('AI service unavailable')
      },
    }
    await expect(answerQuestion('q', d)).rejects.toThrow('AI service unavailable')
  })
})

describe('answerQuestion coverage', () => {
  const passages = [chunk('c1', 'remote', 3, 0.9)]

  it('keeps the status verified and reports partial coverage when the model says so', async () => {
    const { d } = deps(passages, {
      answer: 'The stipend is $450 [S1]. The documents do not mention standing desks.',
      citations: ['S1'],
      answerable: true,
      coverage: 'partial',
    })
    const result = await answerQuestion('Stipend, and standing desks?', d)
    expect(result.status).toBe('verified')
    expect(result.coverage).toBe('partial')
  })

  it('reports partial coverage on a partially verified answer too', async () => {
    const { d } = deps(passages, {
      answer: 'The stipend is $450 [S1]. Desks are covered [S7].',
      citations: ['S1', 'S7'],
      answerable: true,
      coverage: 'partial',
    })
    const result = await answerQuestion('q', d)
    expect(result.status).toBe('partial')
    expect(result.coverage).toBe('partial')
  })

  it('defaults to full coverage when the model omits it', async () => {
    const { d } = deps(passages, { answer: 'The stipend is $450 [S1].', citations: ['S1'], answerable: true })
    expect((await answerQuestion('q', d)).coverage).toBe('full')
  })

  it('has no coverage when the answer abstains, whatever the model claimed', async () => {
    const uncited = deps(passages, { answer: 'No citation here.', citations: [], answerable: true, coverage: 'partial' })
    expect(await answerQuestion('q', uncited.d)).toMatchObject({ status: 'abstained', coverage: null })

    const nothing = deps([], { answer: 'x [S1]', citations: ['S1'], answerable: true, coverage: 'full' })
    expect(await answerQuestion('q', nothing.d)).toMatchObject({ status: 'abstained', coverage: null })
  })
})

describe('answerQuestion quotes', () => {
  it('attaches a quote found in the passage and drops one that is not', async () => {
    const { d } = deps(
      [chunk('c1', 'remote', 2, 0.9, 'Employees may work remotely up to three days per week.'), chunk('c2', 'remote', 4, 0.8, 'Core hours are 10 to 3.')],
      {
        answer: 'Three days [S1]. Core hours 10–3 [S2].',
        citations: ['S1', 'S2'],
        answerable: true,
        quotes: [
          { label: 'S1', quote: 'work remotely up to three days per week' },
          { label: 'S2', quote: 'core hours are nine to five' },
        ],
      },
    )
    const result = await answerQuestion('q', d)
    expect(result.status).toBe('verified')
    expect(result.citations[0].quote).toBe('work remotely up to three days per week')
    expect(result.citations[1].quote).toBeUndefined()
  })
})
