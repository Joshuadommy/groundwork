/**
 * Server actions, exposed at POST /api/actions/<name>.
 *
 * Actions run with RBAC off (see src/server/action-routes.ts), so every one is
 * wrapped in withRole() from src/server/roles.ts.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { askQuestion } from './ask'
import { deleteDocument, retryDocumentIndexing } from './documents'
import { addEvalCase, runEvals, saveEvalCase } from './evals'
import { setupWorkspace } from './setup'

export const actions: Record<string, ActionHandler<Env>> = {
  addEvalCase,
  askQuestion,
  deleteDocument,
  retryDocumentIndexing,
  runEvals,
  saveEvalCase,
  setupWorkspace,
}
