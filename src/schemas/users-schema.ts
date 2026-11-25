import { USERS_COLUMNS, type CollectionSchema } from 'deepspace/schema'

/**
 * The role a new sign-in gets: REVIEW DEPLOYMENT SETTING.
 *
 * This deployment admits new sign-ins as `member` (shown as Viewer) so
 * reviewers can ask, open citations and give feedback right away; Editor and
 * Owner features stay restricted. A real team deployment sets this to
 * 'viewer' (no access): new people then wait on the "Waiting for access"
 * screen until an owner approves them on the Team page (the flow shown in the
 * demo video). Nothing else changes between the two: the waiting screen, the
 * approval buttons and every role check stay in place, and an owner can still
 * remove someone back to waiting.
 *
 * Existing users keep their role when this changes. A `viewer`'s `read: false`
 * gives them an empty user directory, so a stranger learns no teammate names.
 * Owners (admin) receive full rows, which is how the Team page shows emails.
 */
export const NEW_USER_ROLE = 'member' as const

export const usersSchema: CollectionSchema = {
  name: 'users',
  defaultRole: NEW_USER_ROLE,
  columns: [...USERS_COLUMNS],
  permissions: {
    viewer: { read: false, create: false, update: 'own', delete: false },
    member: { read: 'own', create: false, update: 'own', delete: false },
    editor: { read: 'own', create: false, update: 'own', delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}
