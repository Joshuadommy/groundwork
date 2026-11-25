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
import { runDeleteAnswer } from '../actions/answers'
import { runAddEvalCase, runEvalBatch } from '../actions/evals'
import { runSetupWorkspace } from '../actions/setup'
import { parsePassageKey } from '../lib/passage-key'
import type { AnswerData } from '../schemas/answers-schema'
import type { DocumentData } from '../schemas/documents-schema'
import type { EvalCaseData, EvalRunData } from '../schemas/evals-schema'
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
        'Raw knowledge search: the passages retrieval returns for a query, with the document id and page parsed from each key. ' +
        'For diagnosing retrieval, optionally override matchThreshold (0..1; omit for the platform default), mode, limit (up to 50) or queryRewrite.',
      inputSchema: z.object({
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(50).optional(),
        matchThreshold: z.number().min(0).max(1).optional(),
        mode: z.enum(['hybrid', 'semantic', 'fulltext']).optional(),
        queryRewrite: z.boolean().optional(),
      }),
      execute: async ({ query, limit, matchThreshold, mode, queryRewrite }) => {
        await need(context, TEAM_ROLES)
        const result = await knowledge(env).search(query, {
          mode: mode ?? 'hybrid',
          limit: limit ?? 5,
          ...(matchThreshold !== undefined ? { matchThreshold } : {}),
          ...(queryRewrite !== undefined ? { queryRewrite } : {}),
        })
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

    list_answers: tool({
      description: 'Recent answers, newest first: question, status, how many passages were cited and which document pages.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
      execute: async ({ limit }) => {
        await need(context, TEAM_ROLES)
        const res = await records().query<AnswerData>('answers', { orderBy: 'createdAt', orderDir: 'desc', limit: limit ?? 20 })
        if (!res.success) throw new AgentToolError('query_failed', res.error ?? 'Could not list answers.')
        return res.data.records.map((r) => ({
          id: r.recordId,
          createdAt: r.createdAt,
          askedBy: r.data.askedBy,
          question: r.data.question,
          status: r.data.status,
          coverage: r.data.coverage,
          citations: r.data.citations.map((c) => `${c.docTitle} p.${c.page}`),
        }))
      },
    }),

    delete_answer: tool({
      description: 'Owners only. Delete an answer and its ratings (eval cases saved from it are kept).',
      inputSchema: z.object({ answerId: z.string().min(1) }),
      execute: async ({ answerId }) => {
        await need(context, OWNER_ROLES)
        const result = await runDeleteAnswer(records(), userId, answerId)
        if (!result.success) throw new AgentToolError('delete_failed', result.error, 400)
        return result.data
      },
    }),

    add_eval_case: tool({
      description: 'Editors and Owners. Add a question directly as an eval case (the same question twice returns the existing case).',
      inputSchema: z.object({ question: z.string().min(1).max(QUESTION_MAX_CHARS) }),
      execute: async ({ question }) => {
        await need(context, EDITOR_ROLES)
        const result = await runAddEvalCase(records(), userId, question)
        if (!result.success) throw new AgentToolError('add_failed', result.error, 400)
        return result.data
      },
    }),

    run_evals: tool({
      description:
        'Owners only. Re-run eval cases through the same pipeline as askQuestion (one model call per case that retrieves passages). ' +
        'Optionally name the case ids to run; otherwise up to 10, least recently run first.',
      inputSchema: z.object({ caseIds: z.array(z.string().min(1)).max(10).optional() }),
      execute: async ({ caseIds }) => {
        await need(context, OWNER_ROLES)
        const result = await runEvalBatch(env, records(), caseIds)
        if (!result.success) throw new AgentToolError('run_failed', result.error, 400)
        return result.data
      },
    }),

    list_eval_results: tool({
      description: 'Every eval case with its latest run: status, cited document pages, whether it changed.',
      inputSchema: z.object({}),
      execute: async () => {
        await need(context, TEAM_ROLES)
        const cases = await records().query<EvalCaseData>('evalCases', { orderBy: 'createdAt', orderDir: 'asc', limit: 500 })
        const runs = await records().query<EvalRunData>('evalRuns', { orderBy: 'runAt', orderDir: 'desc', limit: 2000 })
        if (!cases.success || !runs.success) throw new AgentToolError('query_failed', 'Could not load eval results.')
        return cases.data.records.map((c) => {
          const history = runs.data.records.filter((r) => r.data.evalCaseId === c.recordId)
          return {
            id: c.recordId,
            question: c.data.question,
            runs: history.map((r) => ({
              runAt: r.data.runAt,
              status: r.data.status,
              changed: r.data.changedFromPrevious,
              cites: r.data.citations.map((x) => `${x.docTitle} p.${x.page}`),
            })),
          }
        })
      },
    }),
  }
}
