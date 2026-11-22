/**
 * Upload rules for documents. Pure: shared by the upload route, the sample
 * loader and unit tests.
 */

import type { DocumentKind } from '../schemas/documents-schema'

/** Largest accepted upload. appFiles takes up to 25 MiB per request. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const TITLE_MAX_CHARS = 200

const EXTENSIONS: Record<string, DocumentKind> = {
  pdf: 'pdf',
  md: 'md',
  markdown: 'md',
  txt: 'txt',
}

export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSIONS).map((e) => `.${e}`)

/** The document kind for a filename, or null when the type is not supported. */
export function kindFromFilename(filename: string): DocumentKind | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename.trim())
  return match ? (EXTENSIONS[match[1].toLowerCase()] ?? null) : null
}

/** True when the bytes start with the PDF signature `%PDF-`. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d]
  return bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)
}

/** A readable default title: the filename without its extension. */
export function titleFromFilename(filename: string): string {
  const base = filename.trim().replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]+$/, '')
  const title = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (title || 'Untitled document').slice(0, TITLE_MAX_CHARS)
}

/** A storage-safe filename (letters, digits, dot, dash, underscore). */
export function safeFileName(filename: string): string {
  const base = filename.trim().replace(/^.*[\\/]/, '')
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+/, '')
  return (cleaned || 'document').slice(0, 120)
}

export function contentTypeFor(kind: DocumentKind): string {
  switch (kind) {
    case 'pdf':
      return 'application/pdf'
    case 'md':
      return 'text/markdown; charset=utf-8'
    case 'txt':
      return 'text/plain; charset=utf-8'
  }
}

/** A new document id that is also a valid knowledge folder segment. */
export function newDocumentId(): string {
  return `doc_${crypto.randomUUID().replace(/-/g, '')}`
}
