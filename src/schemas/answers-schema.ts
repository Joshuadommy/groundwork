import type { CollectionSchema } from 'deepspace/schema'
import { teamReadServerWrite } from './permissions'

export const ANSWER_STATUSES = ['pending', 'verified', 'partial', 'abstained', 'error'] as const
export type AnswerStatus = (typeof ANSWER_STATUSES)[number]

/**
 * Whether the cited passages answer the whole question (the model's own
 * judgment, from its structured output). Separate from the verification
 * status, which only says whether citations point at retrieved passages.
 */
export const ANSWER_COVERAGES = ['full', 'partial'] as const
export type AnswerCoverage = (typeof ANSWER_COVERAGES)[number]

/** Where a pending answer is in the pipeline (drives the live steps on the Ask page). */
export const ANSWER_STAGES = ['searching', 'reading', 'checking'] as const
export type AnswerStage = (typeof ANSWER_STAGES)[number]

/** A client-chosen id for one ask, so the asker's page can find its pending answer. */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

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
  /** A short supporting quote found verbatim in the passage (src/lib/quotes.ts); used for highlighting. */
  quote?: string
}

export type AnswerData = {
  question: string
  answerText: string
  citations: Citation[]
  /** Labels the model cited that were not in the retrieved set. */
  removedCitations: string[]
  status: AnswerStatus
  /** Set on verified and partial answers; absent when abstained, pending or error. */
  coverage?: AnswerCoverage
  askedBy: string
  model?: string
  error?: string
  /** Set while pending. */
  stage?: AnswerStage
  /** The asker's client request id (REQUEST_ID_PATTERN), when asked from the Ask page. */
  requestId?: string
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
    { name: 'coverage', storage: 'text', interpretation: { kind: 'select', options: [...ANSWER_COVERAGES] } },
    { name: 'askedBy', storage: 'text', interpretation: 'plain' },
    { name: 'model', storage: 'text', interpretation: 'plain' },
    { name: 'error', storage: 'text', interpretation: 'plain' },
    { name: 'stage', storage: 'text', interpretation: { kind: 'select', options: [...ANSWER_STAGES] } },
    { name: 'requestId', storage: 'text', interpretation: 'plain', maxLength: 64 },
  ],
  permissions: teamReadServerWrite,
}
