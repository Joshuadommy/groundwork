/**
 * Per-page knowledge keys. Managed knowledge returns no page metadata, so each
 * page is indexed as its own item and the page travels in the item's path:
 *
 *   folder  docs/<documentId>
 *   file    pNNNN.txt          (1-based page number, zero-padded)
 *   key     docs/<documentId>/pNNNN.txt
 *
 * A search chunk carries `key`, and/or `folder` + `filename`; parsePassageKey
 * accepts either form. Pure: shared by the worker and unit tests.
 */

export const KNOWLEDGE_ROOT = 'docs'
const PAGE_FILE = /^p(\d{4,})\.txt$/
const DOCUMENT_ID = /^[A-Za-z0-9_-]{1,64}$/

export function documentFolder(documentId: string): string {
  if (!DOCUMENT_ID.test(documentId)) throw new Error(`Invalid document id: ${documentId}`)
  return `${KNOWLEDGE_ROOT}/${documentId}`
}

export function pageFileName(page: number): string {
  if (!Number.isInteger(page) || page < 1) throw new Error(`Invalid page number: ${page}`)
  return `p${String(page).padStart(4, '0')}.txt`
}

export function pageKey(documentId: string, page: number): string {
  return `${documentFolder(documentId)}/${pageFileName(page)}`
}

export interface PassageLocation {
  documentId: string
  page: number
}

export function parsePassageKey(chunk: {
  key?: string
  folder?: string
  filename?: string
}): PassageLocation | null {
  const fromKey = chunk.key ? parsePath(chunk.key) : null
  if (fromKey) return fromKey
  if (chunk.folder && chunk.filename) {
    return parsePath(`${chunk.folder.replace(/\/+$/, '')}/${chunk.filename}`)
  }
  return null
}

function parsePath(path: string): PassageLocation | null {
  const parts = path.replace(/^\/+/, '').split('/')
  if (parts.length !== 3 || parts[0] !== KNOWLEDGE_ROOT) return null
  const [, documentId, file] = parts
  if (!DOCUMENT_ID.test(documentId)) return null
  const match = PAGE_FILE.exec(file)
  if (!match) return null
  const page = Number(match[1])
  return page >= 1 ? { documentId, page } : null
}
