import type { CollectionSchema } from 'deepspace/schema'
import type { AnswerStatus, Citation } from './answers-schema'
import { teamReadServerWrite } from './permissions'

export type EvalCaseData = {
  question: string
  sourceAnswerId: string
  createdBy: string
}

export type EvalRunData = {
  evalCaseId: string
  batchId: string
  answerText: string
  citations: Citation[]
  status: AnswerStatus
  /** Status or the set of cited (document, page) pairs differs from the previous run. */
  changedFromPrevious: boolean
  runAt: string
}

/** Written only by the saveEvalCase action. */
export const evalCasesSchema: CollectionSchema = {
  name: 'evalCases',
  columns: [
    { name: 'question', storage: 'text', interpretation: 'plain', required: true, maxLength: 2000 },
    { name: 'sourceAnswerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'createdBy', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['sourceAnswerId'],
  permissions: teamReadServerWrite,
}

/** Written only by the runEvals action. */
export const evalRunsSchema: CollectionSchema = {
  name: 'evalRuns',
  columns: [
    { name: 'evalCaseId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'batchId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'answerText', storage: 'text', interpretation: 'plain' },
    { name: 'citations', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'status', storage: 'text', interpretation: 'plain', required: true },
    { name: 'changedFromPrevious', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'runAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: teamReadServerWrite,
}
