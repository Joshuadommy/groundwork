/**
 * Permission presets for Groundwork collections.
 *
 * Every collection closes signed-out visitors (`*`) and `viewer` (no access).
 * The custom `editor` role must be named explicitly in every block: a role a
 * collection doesn't name falls back to the `*` rule.
 */

import type { RolePermissions } from 'deepspace/schema'

export const NONE: RolePermissions = { read: false, create: false, update: false, delete: false }
const READ_ONLY: RolePermissions = { read: true, create: false, update: false, delete: false }

/**
 * Approved teammates can read; only server code (actions, routes, jobs) writes.
 * Used for documents, answers, eval cases and eval runs, so a client can never
 * create or edit a record such as a "Verified" answer.
 */
export const teamReadServerWrite: Record<string, RolePermissions> = {
  '*': NONE,
  viewer: NONE,
  member: READ_ONLY,
  editor: READ_ONLY,
  admin: READ_ONLY,
}
