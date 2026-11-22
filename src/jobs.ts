/**
 * Background jobs, run by AppJobRoom (worker.ts).
 *
 *   index-document   extract a document's pages and add them to managed
 *                    knowledge (src/server/documents.ts). Queued by the upload
 *                    route and setupWorkspace with enqueueJob after their own
 *                    role checks.
 */

import type { Job, JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { INDEX_JOB, indexDocument } from './server/documents'

export async function runJob(job: Job, ctx: JobContext, env: Env): Promise<unknown> {
  switch (job.type) {
    case INDEX_JOB: {
      const { documentId } = (job.payload ?? {}) as { documentId?: unknown }
      if (typeof documentId !== 'string') throw new Error('index-document needs a documentId')
      return await indexDocument(env, documentId, ctx)
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}
