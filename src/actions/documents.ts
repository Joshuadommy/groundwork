/**
 * Document actions — Editors and Owners. Uploads go through
 * POST /api/documents (multipart), not an action.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { deleteDocument as deleteDocumentEverywhere, retryIndexing } from '../server/documents'
import { withRole } from '../server/roles'
import { EDITOR_ROLES } from '../roles'

/** Queue a document that failed to index for another attempt. */
export const retryDocumentIndexing: ActionHandler<Env> = withRole(EDITOR_ROLES, async ({ userId, params, tools, env }) => {
  if (typeof params.documentId !== 'string') return { success: false, error: 'documentId is required.' }
  const result = await retryIndexing(env, tools, params.documentId, userId)
  return result.success ? { success: true, data: { documentId: params.documentId, status: 'indexing' } } : result
})

/** Delete a document, its indexed pages and its original file. */
export const deleteDocument: ActionHandler<Env> = withRole(EDITOR_ROLES, async ({ userId, params, tools, env }) => {
  if (typeof params.documentId !== 'string') return { success: false, error: 'documentId is required.' }
  const result = await deleteDocumentEverywhere(env, tools, params.documentId, userId)
  return result.success ? { success: true, data: { documentId: params.documentId } } : result
})
