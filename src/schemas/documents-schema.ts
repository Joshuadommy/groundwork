import type { CollectionSchema } from 'deepspace/schema'
import { teamReadServerWrite } from './permissions'

export const DOCUMENT_KINDS = ['pdf', 'md', 'txt'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_STATUSES = ['indexing', 'ready', 'failed'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export type DocumentData = {
  title: string
  kind: DocumentKind
  /** Key of the original file in the owner's private app-files folder. */
  fileKey: string
  sizeBytes: number
  pageCount: number
  uploadedBy: string
  status: DocumentStatus
  error?: string
  /** Managed-knowledge item ids, one per indexed page. */
  knowledgeItemIds?: string[]
}

/** Written only by the upload route and the indexing job. */
export const documentsSchema: CollectionSchema = {
  name: 'documents',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: 200 },
    { name: 'kind', storage: 'text', interpretation: { kind: 'select', options: [...DOCUMENT_KINDS] }, required: true },
    { name: 'fileKey', storage: 'text', interpretation: 'plain' },
    { name: 'sizeBytes', storage: 'number', interpretation: 'plain' },
    { name: 'pageCount', storage: 'number', interpretation: 'plain' },
    { name: 'uploadedBy', storage: 'text', interpretation: 'plain' },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: [...DOCUMENT_STATUSES] }, required: true },
    { name: 'error', storage: 'text', interpretation: 'plain' },
    { name: 'knowledgeItemIds', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: teamReadServerWrite,
}
