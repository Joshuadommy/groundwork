/**
 * Document HTTP routes.
 *
 *   POST /api/documents            multipart `file` (+ optional `title`); Editors and Owners
 *   GET  /api/documents/:id/file   the original file; any approved teammate
 *
 * Both take a Bearer token, and both check the caller's role themselves:
 * the record and file tools they use run with RBAC off.
 */

import type { Hono } from 'hono'
import { appFiles, AppFileError } from 'deepspace/worker'
import type { AppContext } from '../../worker'
import {
  ACCEPTED_EXTENSIONS,
  contentTypeFor,
  kindFromFilename,
  looksLikePdf,
  MAX_UPLOAD_BYTES,
  safeFileName,
  TITLE_MAX_CHARS,
  titleFromFilename,
} from '../lib/document-files'
import type { DocumentData } from '../schemas/documents-schema'
import { EDITOR_ROLES, TEAM_ROLES } from '../roles'
import { createActionTools } from './action-routes'
import { ingestDocument } from './documents'
import { resolveAuth } from './http-routes'
import { requireRole } from './roles'

export function registerDocumentRoutes(app: Hono<AppContext>): void {
  app.post('/api/documents', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const check = await requireRole(c.env, auth.userId, EDITOR_ROLES)
    if (!check.ok) return c.json({ success: false, error: check.error }, check.status)

    const declared = Number(c.req.header('Content-Length') ?? 0)
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
      return c.json({ success: false, error: 'Files can be at most 20 MB.' }, 413)
    }

    let form: FormData
    try {
      form = await c.req.formData()
    } catch {
      return c.json({ success: false, error: 'Send the file as multipart form data in a field named "file".' }, 400)
    }
    const file = form.get('file')
    if (!(file instanceof File)) {
      return c.json({ success: false, error: 'Send the file as multipart form data in a field named "file".' }, 400)
    }
    const kind = kindFromFilename(file.name)
    if (!kind) {
      return c.json(
        { success: false, error: `Upload a PDF, Markdown or text file (${ACCEPTED_EXTENSIONS.join(', ')}).` },
        415,
      )
    }
    if (file.size === 0) return c.json({ success: false, error: 'This file is empty.' }, 400)
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ success: false, error: 'Files can be at most 20 MB.' }, 413)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (kind === 'pdf' && !looksLikePdf(bytes)) {
      return c.json({ success: false, error: 'This file has a .pdf name but is not a PDF.' }, 415)
    }

    const rawTitle = form.get('title')
    const title =
      typeof rawTitle === 'string' && rawTitle.trim()
        ? rawTitle.trim().slice(0, TITLE_MAX_CHARS)
        : titleFromFilename(file.name)

    console.info(`[documents] upload by ${auth.userId} role=${check.role} name=${JSON.stringify(file.name)}`)
    const result = await ingestDocument(c.env, createActionTools(c.env, auth.userId, ''), {
      bytes,
      filename: file.name,
      title,
      kind,
      uploadedBy: auth.userId,
    })
    if (!result.success) return c.json(result, 500)
    return c.json({ success: true, data: { documentId: result.documentId, status: 'indexing' } }, 201)
  })

  app.get('/api/documents/:id/file', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)
    const check = await requireRole(c.env, auth.userId, TEAM_ROLES)
    if (!check.ok) return c.json({ error: check.error }, check.status)

    const tools = createActionTools(c.env, auth.userId, '')
    const got = await tools.get<DocumentData>('documents', c.req.param('id'))
    if (!got.success) return c.json({ error: 'Document not found.' }, 404)
    const doc = got.data.record.data

    let file: Response
    try {
      file = await appFiles(c.env, { scope: 'self', userId: c.env.OWNER_USER_ID }).download(doc.fileKey)
    } catch (error) {
      if (error instanceof AppFileError && error.status === 404) {
        return c.json({ error: 'The original file is missing.' }, 404)
      }
      throw error
    }
    const extension = doc.kind === 'md' ? 'md' : doc.kind
    return new Response(file.body, {
      headers: {
        'Content-Type': contentTypeFor(doc.kind),
        'Content-Disposition': `inline; filename="${safeFileName(`${doc.title}.${extension}`)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
}
