import { describe, expect, it } from 'vitest'
import { schemas } from '../schemas'

// Answers, documents, eval cases/runs and the workspace are written only by
// server code (actions, routes, the indexing job), so a client can never
// forge, for example, a "Verified" answer. Guard the collection rules.
const SERVER_WRITTEN = ['answers', 'documents', 'evalCases', 'evalRuns', 'workspace']
const ROLES = ['*', 'viewer', 'member', 'editor', 'admin']

describe('collection permissions', () => {
  for (const name of SERVER_WRITTEN) {
    it(`${name}: no client role can create, update or delete`, () => {
      const schema = schemas.find((s) => s.name === name)
      expect(schema, name).toBeDefined()
      for (const role of ROLES) {
        const p = schema!.permissions[role]
        expect(p, `${name}/${role} must be named explicitly`).toBeDefined()
        expect([p.create, p.update, p.delete], `${name}/${role}`).toEqual([false, false, false])
      }
    })
  }

  it('people waiting for access (viewer) and signed-out visitors read nothing but their own user row', () => {
    for (const schema of schemas) {
      if (schema.name === 'users') continue
      for (const role of ['*', 'viewer']) {
        const p = schema.permissions[role]
        if (p) expect(p.read, `${schema.name}/${role}`).toBe(false)
      }
    }
  })

  it('feedback: teammates write only their own rating rows', () => {
    const f = schemas.find((s) => s.name === 'feedback')!
    expect(f.permissions.viewer).toMatchObject({ create: false, update: false, delete: false })
    for (const role of ['member', 'editor', 'admin']) {
      expect(f.permissions[role]).toMatchObject({ create: true, update: 'own', delete: 'own' })
    }
    expect(f.columns.find((c) => c.name === 'userId')).toMatchObject({ userBound: true })
  })
})

describe('new sign-ins (review deployment setting)', () => {
  const users = () => schemas.find((s) => s.name === 'users')!

  it('admits new sign-ins as Viewer (member), not as Editor or Owner', () => {
    expect(users().defaultRole).toBe('member')
  })

  it('keeps the no-access role closed, so switching defaultRole back to viewer restores approvals', () => {
    expect(users().permissions.viewer.read).toBe(false)
  })
})
