/**
 * PHASE B SPIKE — temporary, owner-only. Delete after the spike report.
 *
 * Proves the per-page indexing design end to end on the deployed app:
 *   spike_index_pdf  read a PDF from the owner's private app files, extract
 *                    text per page in the Worker, add each page to managed
 *                    knowledge as docs/<id>/pNNNN.txt
 *   spike_status     list those items and their indexing status
 *   spike_search     search and parse document id + page back from each chunk
 *   spike_cleanup    remove the spike's knowledge items
 */

import { tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod/v4'
import { appFiles, knowledge, KnowledgeError } from 'deepspace/worker'
import type { AgentToolContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { documentFolder, pageFileName, parsePassageKey, KNOWLEDGE_ROOT } from '../lib/passage-key'
import { extractPdfPages } from '../server/pdf-text'
import { requireRole } from '../server/roles'
import { OWNER_ROLES } from '../roles'

async function ownerOnly(context: AgentToolContext<Env>) {
  const check = await requireRole(context.env, context.userId, OWNER_ROLES)
  if (!check.ok) throw new Error(check.error)
}

function describeError(error: unknown) {
  if (error instanceof KnowledgeError) {
    return { code: error.code, status: error.status, message: error.message }
  }
  return { message: error instanceof Error ? error.message : String(error) }
}

export function buildSpikeTools(context: AgentToolContext<Env>): ToolSet {
  return {
    spike_index_pdf: tool({
      description: 'SPIKE (owner only): extract a PDF per page and add each page to knowledge.',
      inputSchema: z.object({
        fileKey: z.string().describe("Key in the owner's private app-files folder"),
        documentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
      }),
      execute: async ({ fileKey, documentId }) => {
        await ownerOnly(context)
        const timings: Record<string, number> = {}
        let t = Date.now()
        const files = appFiles(context.env, { scope: 'self', userId: context.env.OWNER_USER_ID })
        const res = await files.download(fileKey)
        const bytes = await res.arrayBuffer()
        timings.downloadMs = Date.now() - t

        t = Date.now()
        let pages: string[]
        try {
          pages = await extractPdfPages(bytes)
        } catch (error) {
          return { stage: 'extract', sizeBytes: bytes.byteLength, error: describeError(error) }
        }
        timings.extractMs = Date.now() - t

        t = Date.now()
        const kb = knowledge(context.env)
        const folder = documentFolder(documentId)
        const added: Array<{ page: number; chars: number; items?: unknown; error?: unknown }> = []
        for (const [i, text] of pages.entries()) {
          const page = i + 1
          if (!text) {
            added.push({ page, chars: 0, error: 'skipped: no extractable text' })
            continue
          }
          try {
            const result = await kb.add(
              new File([text], pageFileName(page), { type: 'text/plain' }),
              { folder },
            )
            added.push({ page, chars: text.length, items: result.items })
          } catch (error) {
            added.push({ page, chars: text.length, error: describeError(error) })
          }
        }
        timings.addMs = Date.now() - t

        return {
          sizeBytes: bytes.byteLength,
          totalPages: pages.length,
          pagePreview: pages.map((p, i) => ({ page: i + 1, chars: p.length, start: p.slice(0, 120) })),
          added,
          timings,
        }
      },
    }),

    spike_status: tool({
      description: 'SPIKE (owner only): list knowledge items for a spike document.',
      inputSchema: z.object({ documentId: z.string() }),
      execute: async ({ documentId }) => {
        await ownerOnly(context)
        try {
          return await knowledge(context.env).list({ folder: documentFolder(documentId), perPage: 50 })
        } catch (error) {
          return { error: describeError(error) }
        }
      },
    }),

    spike_search: tool({
      description: 'SPIKE (owner only): search knowledge and parse document id + page per chunk.',
      inputSchema: z.object({
        query: z.string(),
        folder: z.string().optional(),
        mode: z.enum(['hybrid', 'semantic', 'fulltext']).optional(),
      }),
      execute: async ({ query, folder, mode }) => {
        await ownerOnly(context)
        try {
          const result = await knowledge(context.env).search(query, {
            folder: folder ?? KNOWLEDGE_ROOT,
            mode: mode ?? 'hybrid',
            limit: 8,
          })
          return {
            queryKind: result.queryKind,
            chunks: result.chunks.map((c) => ({
              id: c.id,
              score: c.score,
              key: c.key,
              folder: c.folder,
              filename: c.filename,
              parsed: parsePassageKey(c),
              text: c.text.slice(0, 200),
            })),
          }
        } catch (error) {
          return { error: describeError(error) }
        }
      },
    }),

    spike_cleanup: tool({
      description: 'SPIKE (owner only): remove all knowledge items for a spike document.',
      inputSchema: z.object({ documentId: z.string() }),
      execute: async ({ documentId }) => {
        await ownerOnly(context)
        const kb = knowledge(context.env)
        const listed = await kb.list({ folder: documentFolder(documentId), perPage: 50 })
        for (const item of listed.items) await kb.remove(item.id)
        return { removed: listed.items.map((i) => i.key) }
      },
    }),
  }
}
