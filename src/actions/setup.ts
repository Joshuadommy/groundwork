/**
 * setupWorkspace — Owners only, once.
 *
 * Creates the single `workspace` row and, unless `loadSamples` is false,
 * loads the Northwind Ops sample documents through the same ingest path as an
 * upload (stored privately, indexed per page by the background job). Running
 * it again after setup changes nothing.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { SAMPLE_DOCUMENTS } from '../lib/sample-documents'
import { ingestDocument } from '../server/documents'
import { withRole } from '../server/roles'
import { OWNER_ROLES } from '../roles'

export const WORKSPACE_SLOT = 'main'
const NAME_MAX_CHARS = 80

export async function runSetupWorkspace(
  env: Env,
  tools: ActionTools,
  userId: string,
  options: { name?: string; loadSamples?: boolean },
) {
  const existing = await tools.query('workspace', { where: { slot: WORKSPACE_SLOT }, limit: 1 })
  if (existing.success && existing.data.records.length > 0) {
    return { success: true as const, data: { alreadySetUp: true, documentIds: [] as string[] } }
  }

  const name = (options.name?.trim() || 'Northwind Ops').slice(0, NAME_MAX_CHARS)
  const created = await tools.create('workspace', { slot: WORKSPACE_SLOT, name, setupBy: userId })
  if (!created.success) return { success: false as const, error: created.error ?? 'Could not set up the workspace.' }

  const documentIds: string[] = []
  const failures: string[] = []
  if (options.loadSamples !== false) {
    for (const sample of SAMPLE_DOCUMENTS) {
      const res = await env.ASSETS.fetch(new Request(new URL(sample.path, 'https://assets.local')))
      if (!res.ok) {
        failures.push(`${sample.title}: sample file missing (${res.status})`)
        continue
      }
      const result = await ingestDocument(env, tools, {
        bytes: new Uint8Array(await res.arrayBuffer()),
        filename: sample.filename,
        title: sample.title,
        kind: sample.kind,
        uploadedBy: userId,
      })
      if (result.success) documentIds.push(result.documentId)
      else failures.push(`${sample.title}: ${result.error}`)
    }
  }
  console.info(`[setup] workspace=${JSON.stringify(name)} samples=${documentIds.length} failures=${failures.length}`)
  return { success: true as const, data: { alreadySetUp: false, documentIds, failures } }
}

export const setupWorkspace: ActionHandler<Env> = withRole(OWNER_ROLES, async ({ userId, params, tools, env }) =>
  runSetupWorkspace(env, tools, userId, {
    name: typeof params.name === 'string' ? params.name : undefined,
    loadSamples: params.loadSamples !== false,
  }),
)
