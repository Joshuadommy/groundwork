import { describe, expect, it } from 'vitest'
import { isSearchOutage, SEARCH_UNAVAILABLE } from './service-errors'

const knowledgeError = (status: number, code: string) => Object.assign(new Error(code), { name: 'KnowledgeError', status, code })

describe('isSearchOutage', () => {
  it('recognizes the failures seen in production', () => {
    expect(isSearchOutage(knowledgeError(502, 'knowledge_provider_failed'))).toBe(true)
    expect(isSearchOutage(knowledgeError(429, 'vectorize_rate_limited'))).toBe(true)
    expect(isSearchOutage(knowledgeError(503, 'knowledge_request_failed'))).toBe(true)
  })

  it('does not treat our own mistakes or other errors as an outage', () => {
    expect(isSearchOutage(knowledgeError(400, 'invalid_limit'))).toBe(false)
    expect(isSearchOutage(new Error('model unavailable'))).toBe(false)
    expect(isSearchOutage(undefined)).toBe(false)
  })

  it('has the agreed message', () => {
    expect(SEARCH_UNAVAILABLE).toBe('The search service is temporarily unavailable. Try again in a few minutes.')
  })
})
