/**
 * Groundwork roles — shared by the client and the worker.
 *
 * Role ids are what DeepSpace stores on the `users` row and what collection
 * permissions key on. `admin` is required for the owner (the SDK pins the app
 * owner to it and only admins may call setRole), and `viewer` is the SDK's
 * default no-access role, so the product's "Viewer" is the `member` id.
 */

export const APP_ROLES = ['admin', 'editor', 'member', 'viewer'] as const
export type AppRole = (typeof APP_ROLES)[number]

/** Roles an owner can grant from the Team page (plus `viewer` = remove access). */
export const GRANTABLE_ROLES = ['member', 'editor', 'admin'] as const satisfies readonly AppRole[]

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Owner',
  editor: 'Editor',
  member: 'Viewer',
  viewer: 'No access',
}

/** Any unknown or missing role is treated as no access. */
export function toAppRole(role: unknown): AppRole {
  return typeof role === 'string' && (APP_ROLES as readonly string[]).includes(role)
    ? (role as AppRole)
    : 'viewer'
}

/** Approved teammates: may ask questions and rate answers. */
export const TEAM_ROLES = ['admin', 'editor', 'member'] as const satisfies readonly AppRole[]
/** May upload and delete documents and save eval cases. */
export const EDITOR_ROLES = ['admin', 'editor'] as const satisfies readonly AppRole[]
/** May manage the team, set up the workspace and re-run evals. */
export const OWNER_ROLES = ['admin'] as const satisfies readonly AppRole[]

export function hasRole(role: AppRole | null | undefined, allowed: readonly AppRole[]): boolean {
  return !!role && allowed.includes(role)
}

export const canAsk = (role: AppRole | null | undefined) => hasRole(role, TEAM_ROLES)
export const canEditDocuments = (role: AppRole | null | undefined) => hasRole(role, EDITOR_ROLES)
export const isOwnerRole = (role: AppRole | null | undefined) => hasRole(role, OWNER_ROLES)
