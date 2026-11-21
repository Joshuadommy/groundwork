/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 * Roles and what each may do: PLAN.md § "Roles and access".
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { workspaceSchema } from './schemas/workspace-schema'
import { documentsSchema } from './schemas/documents-schema'
import { answersSchema } from './schemas/answers-schema'
import { feedbackSchema } from './schemas/feedback-schema'
import { evalCasesSchema, evalRunsSchema } from './schemas/evals-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  workspaceSchema,
  documentsSchema,
  answersSchema,
  feedbackSchema,
  evalCasesSchema,
  evalRunsSchema,
]
