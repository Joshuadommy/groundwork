/**
 * Query expansion for retrieval, used only when the question as asked finds
 * nothing (src/lib/answer-question.ts). Managed-knowledge search returns only
 * hits above a relevance cutoff (about 0.4 of its 0..1 score, whatever
 * matchThreshold we send), and its score rewards wording close to the
 * document's: "gifts between colleagues" finds the gift rule at 1.00 while
 * "What's the maximum gift I can give someone I manage?" finds nothing. A
 * small, fast model rewrites the question into a few phrases worded the way a
 * policy would state the topic.
 *
 * The model never sees document text here and its output is only used as
 * search input: answers still come from retrieved passages, and citations are
 * still verified in code. Billed to the app owner like answer generation.
 */

import { generateText, Output } from 'ai'
import { z } from 'zod/v4'
import { createDeepSpaceAI, type DeepSpaceAIEnv } from 'deepspace/worker'
import { MAX_EXPANDED_QUERIES } from '../lib/answer-question'

export const EXPANSION_MODEL = 'claude-haiku-5-5'

export const EXPANSION_PROMPT = [
  "You write search queries for a team's internal documents (policies, handbooks, guidelines).",
  'The search engine only returns passages whose wording closely matches the query; everyday phrasing of a question often finds nothing.',
  `Rewrite the question as up to ${MAX_EXPANDED_QUERIES} search queries of 3 to 8 words each, phrased the way a formal company document would state the topic: a section heading or the start of a rule.`,
  'Use the formal vocabulary such documents use (for example "colleague" rather than "coworker", "may not exceed" rather than "maximum"), and vary the phrasing across queries.',
  'Example: "Can I bring my dog to work?" -> "pets in the workplace", "animals in the office", "service animals at work", "bringing pets to work is not permitted".',
  'Return only queries. Do not answer the question.',
].join('\n')

export function modelQueryExpander(env: DeepSpaceAIEnv) {
  const ai = createDeepSpaceAI(env, 'anthropic')
  return async (question: string): Promise<string[]> => {
    const result = await generateText({
      model: ai(EXPANSION_MODEL),
      system: EXPANSION_PROMPT,
      prompt: `Question: ${question}`,
      temperature: 0,
      maxOutputTokens: 200,
      output: Output.object({
        schema: z.object({ queries: z.array(z.string()).describe('Search queries of 3 to 8 words, worded like the document would be.') }),
      }),
    })
    return result.output.queries
  }
}
