/**
 * Groundwork agent tools: the same operations as the app's server actions,
 * for the in-app assistant and for `npx deepspace agent invoke` (which runs as
 * the signed-in CLI user, so the app owner can operate the live app without a
 * browser). registerAgent's `authorize` already limits callers to approved
 * teammates; each tool re-checks the role it needs.
 */

import { tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod/v4'
import { AgentToolError, knowledge } from 'deepspace/worker'
import type { AgentToolContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { runAsk, QUESTION_MAX_CHARS } from '../actions/ask'
import { runSetupWorkspace } from '../actions/setup'
import { parsePassageKey } from '../lib/passage-key'
import type { AnswerData } from '../schemas/answers-schema'
import type { DocumentData } from '../schemas/documents-schema'
import { createActionTools } from '../server/action-tools'
import { retryIndexing } from '../server/documents'
import { requireRole } from '../server/roles'
import { EDITOR_ROLES, OWNER_ROLES, TEAM_ROLES, type AppRole } from '../roles'

async function need(context: AgentToolContext<Env>, roles: readonly AppRole[]) {
  const check = await requireRole(context.env, context.userId, roles)
  if (!check.ok) throw new AgentToolError('forbidden', check.error, check.status)
}

export function buildGroundworkTools(context: AgentToolContext<Env>): ToolSet {
  const { env, userId } = context
  const records = () => createActionTools(env, userId, '')

  return {
    setup_workspace: tool({
      description:
        'Owner only. Set up the workspace once and load the Northwind Ops sample documents. Does nothing if already set up.',
      inputSchema: z.object({
        name: z.string().max(80).optional(),
        loadSamples: z.boolean().optional(),
      }),
      execute: async ({ name, loadSamples }) => {
        await need(context, OWNER_ROLES)
        return runSetupWorkspace(env, records(), userId, { name, loadSamples })
      },
    }),

    list_documents: tool({
      description: 'List documents with their indexing status and page count.',
      inputSchema: z.object({}),
      execute: async () => {
        await need(context, TEAM_ROLES)
        const res = await records().query<DocumentData>('documents', { orderBy: 'createdAt', orderDir: 'asc', limit: 100 })
        if (!res.success) throw new AgentToolError('query_failed', res.error ?? 'Could not list documents.')
        return res.data.records.map((r) => ({
          id: r.recordId,
          title: r.data.title,
          kind: r.data.kind,
          status: r.data.status,
          pageCount: r.data.pageCount,
          indexedPages: r.data.knowledgeItemIds?.length ?? 0,
          error: r.data.error || undefined,
        }))
      },
    }),

    retry_document_indexing: tool({
      description: 'Editors and Owners. Queue a document whose indexing failed for another attempt.',
      inputSchema: z.object({ documentId: z.string().min(1) }),
      execute: async ({ documentId }) => {
        await need(context, EDITOR_ROLES)
        const result = await retryIndexing(env, records(), documentId, userId)
        if (!result.success) throw new AgentToolError('retry_failed', result.error, 400)
        return { documentId, status: 'indexing' }
      },
    }),

    ask_question: tool({
      description:
        'Ask a question of the team documents. Returns the stored answer with its verification status and citations.',
      inputSchema: z.object({ question: z.string().min(1).max(QUESTION_MAX_CHARS) }),
      execute: async ({ question }) => {
        await need(context, TEAM_ROLES)
        const tools = records()
        const result = await runAsk(env, tools, userId, question)
        if (!result.success) throw new AgentToolError('ask_failed', result.error ?? 'Could not answer.')
        const { answerId } = result.data
        const stored = await tools.get<AnswerData>('answers', answerId)
        if (!stored.success) throw new AgentToolError('read_failed', stored.error ?? 'Could not read the answer.')
        const a = stored.data.record.data
        return {
          answerId,
          status: a.status,
          coverage: a.coverage ?? null,
          answerText: a.answerText,
          citations: a.citations,
          removedCitations: a.removedCitations,
        }
      },
    }),

    search_passages: tool({
      description:
        'Raw knowledge search: the passages retrieval returns for a query, with the document id and page parsed from each key.',
      inputSchema: z.object({ query: z.string().min(1).max(500), limit: z.number().int().min(1).max(12).optional() }),
      execute: async ({ query, limit }) => {
        await need(context, TEAM_ROLES)
        const result = await knowledge(env).search(query, { mode: 'hybrid', limit: limit ?? 5 })
        return result.chunks.map((chunk) => ({
          chunkId: chunk.id,
          score: chunk.score,
          key: chunk.key,
          folder: chunk.folder,
          filename: chunk.filename,
          parsed: parsePassageKey(chunk),
          text: chunk.text,
        }))
      },
    }),
  }
}
