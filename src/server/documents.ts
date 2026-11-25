/**
 * Document ingest and indexing (see PLAN.md § Per-page indexing).
 *
 *   ingestDocument   store the original in the owner's private app files,
 *                    create the `documents` record (status `indexing`) and
 *                    queue the `index-document` job
 *   indexDocument    the job: extract text per page, add each page to
 *                    managed knowledge as docs/<id>/pNNNN.txt, wait until
 *                    every page is searchable, then mark the record `ready`
 *                    (or `failed` with a reason)
 *
 * Callers check roles first: these functions run with RBAC off.
 */

import { isSearchOutage, SEARCH_UNAVAILABLE } from '../lib/service-errors'
import { appFiles, enqueueJob, knowledge, KnowledgeError } from 'deepspace/worker'
import type { ActionTools, JobContext, KnowledgeClient, KnowledgeItem } from 'deepspace/worker'
import type { Env } from '../../worker'
import { newDocumentId, safeFileName } from '../lib/document-files'
import { documentFolder, pageFileName } from '../lib/passage-key'
import type { DocumentData, DocumentKind } from '../schemas/documents-schema'
import { createActionTools } from './action-tools'
import { extractPdfPages } from './pdf-text'

export const INDEX_JOB = 'index-document'
/** Pages added to knowledge at once (one add takes about 2.6 s). */
const ADD_CONCURRENCY = 3
const POLL_INTERVAL_MS = 3_000
const INDEX_TIMEOUT_MS = 5 * 60_000
/** knowledge.list() refuses perPage above 50. */
const LIST_PAGE_SIZE = 50

export const SCANNED_PDF_ERROR =
  'No text could be read from this file. It may be a scanned image; upload a PDF with selectable text.'

function ownerFiles(env: Env) {
  // The owner pays for storage, and files are served to the team only through
  // GET /api/documents/:id/file, never by a public URL.
  return appFiles(env, { scope: 'self', userId: env.OWNER_USER_ID })
}

export interface IngestInput {
  bytes: Uint8Array
  filename: string
  title: string
  kind: DocumentKind
  uploadedBy: string
}

export async function ingestDocument(
  env: Env,
  tools: ActionTools,
  input: IngestInput,
): Promise<{ success: true; documentId: string } | { success: false; error: string }> {
  const documentId = newDocumentId()
  const stored = await ownerFiles(env).upload(
    new Blob([input.bytes as BlobPart], { type: 'application/octet-stream' }),
    { key: `documents/${documentId}/${safeFileName(input.filename)}` },
  )

  const record: DocumentData = {
    title: input.title,
    kind: input.kind,
    // The full stored key: download() refuses the relative one.
    fileKey: stored.key,
    sizeBytes: input.bytes.byteLength,
    pageCount: 0,
    uploadedBy: input.uploadedBy,
    status: 'indexing',
    knowledgeItemIds: [],
  }
  const created = await tools.create('documents', record, documentId)
  if (!created.success) {
    await ownerFiles(env).delete(stored.key).catch(() => undefined)
    return { success: false, error: created.error ?? 'Could not save the document.' }
  }

  await enqueueJob(env.JOB_ROOMS, `app:${env.DEEPSPACE_APP_ID}`, INDEX_JOB, { documentId }, {
    maxAttempts: 1,
    enqueuedBy: input.uploadedBy,
  })
  console.info(`[documents] queued ${documentId} kind=${input.kind} bytes=${input.bytes.byteLength}`)
  return { success: true, documentId }
}

/**
 * Delete a document everywhere: its pages from knowledge (by saved item id),
 * the original file, then the record. Past answers keep their citation
 * snapshots; the UI marks them as from a deleted document. If the indexing
 * job is still running it notices the record is gone and removes what it added.
 */
export async function deleteDocument(
  env: Env,
  tools: ActionTools,
  documentId: string,
  requestedBy: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const got = await tools.get<DocumentData>('documents', documentId)
  if (!got.success) return { success: false, error: 'Document not found.' }
  const doc = got.data.record.data
  try {
    await removeKnowledgeItems(env, doc.knowledgeItemIds ?? [])
  } catch (error) {
    // Nothing else is deleted, so the document stays whole and can be deleted again later.
    if (isSearchOutage(error)) {
      console.error(`[documents] delete ${documentId}: search service unavailable`)
      return { success: false, error: SEARCH_UNAVAILABLE }
    }
    throw error
  }
  if (doc.fileKey) await ownerFiles(env).delete(doc.fileKey).catch(() => undefined)
  const removed = await tools.remove('documents', documentId)
  if (!removed.success) return { success: false, error: removed.error ?? 'Could not delete the document.' }
  console.info(`[documents] deleted ${documentId} by ${requestedBy} items=${doc.knowledgeItemIds?.length ?? 0}`)
  return { success: true }
}

/**
 * Queue a failed document for indexing again. The job removes the pages the
 * failed run added (by saved item id) before adding them again.
 */
export async function retryIndexing(
  env: Env,
  tools: ActionTools,
  documentId: string,
  requestedBy: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const got = await tools.get<DocumentData>('documents', documentId)
  if (!got.success) return { success: false, error: 'Document not found.' }
  if (got.data.record.data.status !== 'failed') {
    return { success: false, error: 'Only documents that failed to index can be retried.' }
  }
  const updated = await tools.update('documents', documentId, { status: 'indexing', error: '' })
  if (!updated.success) return { success: false, error: updated.error ?? 'Could not update the document.' }
  await enqueueJob(env.JOB_ROOMS, `app:${env.DEEPSPACE_APP_ID}`, INDEX_JOB, { documentId }, {
    maxAttempts: 1,
    enqueuedBy: requestedBy,
  })
  console.info(`[documents] retry queued ${documentId} by ${requestedBy}`)
  return { success: true }
}

/** Page texts in order; page 1 is index 0. Markdown and text are one page. */
async function readPages(env: Env, doc: DocumentData): Promise<string[]> {
  const res = await ownerFiles(env).download(doc.fileKey)
  // Copy: PDF.js detaches the buffer it is given.
  const bytes = new Uint8Array(await res.arrayBuffer()).slice()
  if (doc.kind === 'pdf') return extractPdfPages(bytes)
  return [new TextDecoder().decode(bytes).trim()]
}

async function addPages(
  kb: KnowledgeClient,
  documentId: string,
  pages: Array<{ page: number; text: string }>,
  onAdded: (done: number) => void,
): Promise<string[]> {
  const folder = documentFolder(documentId)
  const ids: string[] = []
  let next = 0
  let done = 0
  async function worker() {
    while (next < pages.length) {
      const { page, text } = pages[next++]
      const result = await kb.add(new File([text], pageFileName(page), { type: 'text/plain' }), { folder })
      ids.push(...result.items.map((item) => item.id))
      onAdded(++done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(ADD_CONCURRENCY, pages.length) }, worker))
  return ids
}

/** Every knowledge item in a document's folder (list() pages at most 50). */
export async function listFolder(kb: KnowledgeClient, documentId: string): Promise<KnowledgeItem[]> {
  const items: KnowledgeItem[] = []
  for (let page = 1; page <= 100; page++) {
    const listed = await kb.list({ folder: documentFolder(documentId), perPage: LIST_PAGE_SIZE, page })
    items.push(...listed.items)
    const last = listed.totalPages ? page >= listed.totalPages : listed.items.length < LIST_PAGE_SIZE
    if (last) break
  }
  return items
}

/** Resolves when every item is `completed`; throws on an item error or timeout. */
async function waitUntilSearchable(
  kb: KnowledgeClient,
  documentId: string,
  itemIds: string[],
  signal: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + INDEX_TIMEOUT_MS
  const wanted = new Set(itemIds)
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error('Indexing was canceled.')
    const mine = (await listFolder(kb, documentId)).filter((item) => wanted.has(item.id))
    const failed = mine.find((item) => item.status === 'error')
    if (failed) throw new Error(`Indexing failed for ${failed.key}: ${failed.error ?? 'unknown error'}`)
    // Items can be missing from list() for a few seconds right after add().
    if (mine.length === wanted.size && mine.every((item) => item.status === 'completed')) return
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error('Indexing took too long. Try uploading the document again.')
}

/** Remove a document's pages from knowledge by the ids saved at add time. */
export async function removeKnowledgeItems(env: Env, itemIds: string[]): Promise<void> {
  const kb = knowledge(env)
  for (const id of itemIds) {
    try {
      await kb.remove(id)
    } catch (error) {
      if (!(error instanceof KnowledgeError && error.status === 404)) throw error
    }
  }
}

export async function indexDocument(env: Env, documentId: string, ctx: JobContext) {
  const tools = createActionTools(env, env.OWNER_USER_ID, '')
  const got = await tools.get<DocumentData>('documents', documentId)
  if (!got.success) return { documentId, skipped: 'document not found' }
  const doc = got.data.record.data
  if (doc.status === 'ready') return { documentId, skipped: 'already ready' }

  const started = Date.now()
  const kb = knowledge(env)
  let itemIds: string[] = doc.knowledgeItemIds ?? []
  try {
    // A re-run starts clean rather than indexing a page twice.
    if (itemIds.length) await removeKnowledgeItems(env, itemIds)

    ctx.progress(0.05, 'Reading text')
    const pages = await readPages(env, doc)
    const withText = pages
      .map((text, i) => ({ page: i + 1, text }))
      .filter((p) => p.text.trim().length > 0)
    if (withText.length === 0) throw new Error(SCANNED_PDF_ERROR)

    ctx.progress(0.1, `Indexing ${withText.length} pages`)
    itemIds = await addPages(kb, documentId, withText, (done) =>
      ctx.progress(0.1 + 0.6 * (done / withText.length), `Indexed ${done} of ${withText.length} pages`),
    )
    const saved = await tools.update('documents', documentId, { pageCount: pages.length, knowledgeItemIds: itemIds })
    if (!saved.success) {
      // Deleted while we were indexing: take back what we added.
      await removeKnowledgeItems(env, itemIds)
      return { documentId, skipped: 'deleted during indexing' }
    }

    ctx.progress(0.75, 'Waiting for search to be ready')
    await waitUntilSearchable(kb, documentId, itemIds, ctx.signal)

    await tools.update('documents', documentId, { status: 'ready', error: '' })
    const skipped = pages.length - withText.length
    console.info(
      `[documents] ready ${documentId} pages=${pages.length} indexed=${withText.length} ` +
        `skipped=${skipped} ms=${Date.now() - started}`,
    )
    return { documentId, pages: pages.length, indexed: withText.length, skipped }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[documents] failed ${documentId}: ${message}`)
    await tools.update('documents', documentId, {
      status: 'failed',
      error:
        message === SCANNED_PDF_ERROR ? message : `Indexing failed: ${isSearchOutage(error) ? SEARCH_UNAVAILABLE : message}`,
      knowledgeItemIds: itemIds,
    })
    return { documentId, failed: message }
  }
}
