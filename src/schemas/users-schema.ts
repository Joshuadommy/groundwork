import { USERS_COLUMNS, type CollectionSchema } from 'deepspace/schema'

/**
 * New sign-ins start as `viewer` (no access) and wait on the Team page until an
 * owner approves them. A viewer's `read: false` also gives them an empty user
 * directory, so a stranger who signs in learns no teammate names.
 * Owners (admin) receive full rows, which is how the Team page shows emails.
 */
export const usersSchema: CollectionSchema = {
  name: 'users',
  defaultRole: 'viewer',
  columns: [...USERS_COLUMNS],
  permissions: {
    viewer: { read: false, create: false, update: 'own', delete: false },
    member: { read: 'own', create: false, update: 'own', delete: false },
    editor: { read: 'own', create: false, update: 'own', delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}
