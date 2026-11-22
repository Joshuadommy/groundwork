import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { NONE } from './permissions'

export type FeedbackData = {
  answerId: string
  userId: string
  rating: 'up' | 'down'
  note?: string
}

/** Teammates rate directly from the client: one row per user per answer. */
const RATE: RolePermissions = {
  read: true,
  create: true,
  update: 'own',
  delete: 'own',
  writableFields: ['answerId', 'userId', 'rating', 'note'],
}

export const feedbackSchema: CollectionSchema = {
  name: 'feedback',
  columns: [
    { name: 'answerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'rating', storage: 'text', interpretation: { kind: 'select', options: ['up', 'down'] }, required: true },
    { name: 'note', storage: 'text', interpretation: 'plain', maxLength: 1000 },
  ],
  uniqueOn: ['answerId', 'userId'],
  ownerField: 'userId',
  permissions: {
    '*': NONE,
    viewer: NONE,
    member: RATE,
    editor: RATE,
    admin: RATE,
  },
}
