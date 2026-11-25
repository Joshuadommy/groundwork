/**
 * Recognizing a managed-knowledge outage, so people see a clear message
 * instead of a generic 500. The SDK throws KnowledgeError with an HTTP-like
 * `status` and a machine `code` (seen in production: knowledge_provider_failed,
 * vectorize_rate_limited). Duck-typed so it stays testable without the SDK.
 */

export const SEARCH_UNAVAILABLE = 'The search service is temporarily unavailable. Try again in a few minutes.'

export function isSearchOutage(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: unknown; status?: unknown; code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const status = typeof e.status === 'number' ? e.status : 0
  const isKnowledge = e.name === 'KnowledgeError' || /knowledge|vectorize/i.test(code)
  if (!isKnowledge) return false
  return status >= 500 || status === 429 || /provider_failed|rate_limited|unavailable|timeout/i.test(code)
}
