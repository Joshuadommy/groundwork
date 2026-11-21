import type { CollectionSchema } from 'deepspace/schema'
import { NONE } from './permissions'

/** The single workspace row (`slot: 'main'`), created by an owner on first run. */
export const workspaceSchema: CollectionSchema = {
  name: 'workspace',
  columns: [
    { name: 'slot', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 80 },
    { name: 'setupBy', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
  ],
  uniqueOn: ['slot'],
  permissions: {
    '*': NONE,
    viewer: NONE,
    member: { read: true, create: false, update: false, delete: false },
    editor: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
