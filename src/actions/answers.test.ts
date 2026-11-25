import { describe, expect, it } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { runDeleteAnswer } from './answers'

/** A tiny in-memory stand-in for the action tools: collections of records. */
function fakeTools(seed: Record<string, Record<string, Record<string, unknown>>>) {
  const db = structuredClone(seed)
  const removedFrom: string[] = []
  const tools = {
    async get(collection: string, id: string) {
      const data = db[collection]?.[id]
      return data ? { success: true, data: { record: { recordId: id, data } } } : { success: false, error: 'not found' }
    },
    async query(collection: string, opts: { where?: Record<string, unknown> }) {
      const records = Object.entries(db[collection] ?? {})
        .filter(([, d]) => Object.entries(opts.where ?? {}).every(([k, v]) => d[k] === v))
        .map(([recordId, data]) => ({ recordId, data }))
      return { success: true, data: { records } }
    },
    async remove(collection: string, id: string) {
      removedFrom.push(collection)
      delete db[collection][id]
      return { success: true, data: {} }
    },
  } as unknown as ActionTools
  return { tools, db, removedFrom }
}

const seed = {
  answers: {
    a1: { question: 'Dress code?', status: 'abstained' },
    a2: { question: 'Remote days?', status: 'verified' },
    busy: { question: 'Still going?', status: 'pending' },
  },
  feedback: {
    f1: { answerId: 'a1', userId: 'u1', rating: 'down' },
    f2: { answerId: 'a1', userId: 'u2', rating: 'up' },
    f3: { answerId: 'a2', userId: 'u1', rating: 'up' },
  },
  evalCases: { c1: { question: 'Dress code?', sourceAnswerId: 'a1', createdBy: 'u1' } },
}

describe('deleteAnswer', () => {
  it('removes the answer and its ratings, and leaves other answers alone', async () => {
    const { tools, db } = fakeTools(seed)
    const r = await runDeleteAnswer(tools, 'owner', 'a1')
    expect(r).toEqual({ success: true, data: { answerId: 'a1', question: 'Dress code?', ratingsRemoved: 2 } })
    expect(Object.keys(db.answers)).toEqual(['a2', 'busy'])
    expect(Object.keys(db.feedback)).toEqual(['f3'])
  })

  it('keeps an eval case saved from the deleted answer, unchanged', async () => {
    const { tools, db, removedFrom } = fakeTools(seed)
    await runDeleteAnswer(tools, 'owner', 'a1')
    expect(db.evalCases.c1).toEqual(seed.evalCases.c1)
    expect(removedFrom).not.toContain('evalCases')
  })

  it('refuses an answer that is still being written, and unknown ids', async () => {
    const { tools } = fakeTools(seed)
    expect((await runDeleteAnswer(tools, 'owner', 'busy')).success).toBe(false)
    expect(await runDeleteAnswer(tools, 'owner', 'nope')).toEqual({ success: false, error: 'Answer not found.' })
    expect((await runDeleteAnswer(tools, 'owner', undefined)).success).toBe(false)
  })
})
