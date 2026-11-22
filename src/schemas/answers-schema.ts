import type { CollectionSchema } from 'deepspace/schema'
import { teamReadServerWrite } from './permissions'

export const ANSWER_STATUSES = ['pending', 'verified', 'partial', 'abstained', 'error'] as const
export type AnswerStatus = (typeof ANSWER_STATUSES)[number]

/** A citation that survived verification, snapshotted at answer time. */
export type Citation = {
  /** The request-local passage label the model cited, e.g. "S2". */
  label: string
  documentId: string
  docTitle: string
  page: number
  excerpt: string
  /** Managed-knowledge chunk id, for traceability. */
  chunkId: string
}

export type AnswerData = {
  question: string
  answerText: string
  citations: Citation[]
  /** Labels the model cited that were not in the retrieved set. */
  removedCitations: string[]
  status: AnswerStatus
  askedBy: string
  model?: string
  error?: string
}

/** Written only by the askQuestion action. */
export const answersSchema: CollectionSchema = {
  name: 'answers',
  columns: [
    { name: 'question', storage: 'text', interpretation: 'plain', required: true, maxLength: 2000 },
    { name: 'answerText', storage: 'text', interpretation: 'plain' },
    { name: 'citations', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'removedCitations', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: [...ANSWER_STATUSES] }, required: true },
    { name: 'askedBy', storage: 'text', interpretation: 'plain' },
    { name: 'model', storage: 'text', interpretation: 'plain' },
    { name: 'error', storage: 'text', interpretation: 'plain' },
  ],
  permissions: teamReadServerWrite,
}
