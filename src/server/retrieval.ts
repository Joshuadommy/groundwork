/**
 * Retrieval from managed knowledge. Searches with NO folder filter: the
 * platform matches `folder` exactly, so `docs` would not reach `docs/<id>/`
 * (found in the Phase B spike). The knowledge base belongs to this app and
 * holds only document pages; labelPassages() drops anything whose key does
 * not parse as `docs/<documentId>/pNNNN.txt`.
 */

import { knowledge, type KnowledgeEnv } from 'deepspace/worker'
import type { RetrievedChunk } from '../lib/answer-question'

export const SEARCH_LIMIT = 12

export function knowledgeRetriever(env: KnowledgeEnv) {
  return async (question: string): Promise<RetrievedChunk[]> => {
    const result = await knowledge(env).search(question.slice(0, 4000), {
      mode: 'hybrid',
      limit: SEARCH_LIMIT,
    })
    return result.chunks
  }
}
