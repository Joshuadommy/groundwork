import { describe, expect, it } from 'vitest'
import { resolveAccess, type ConfirmedRole } from './access-state'

const owner: ConfirmedRole = { userId: 'u_owner', role: 'admin' }

describe('resolveAccess', () => {
  it('is loading while the profile is known but the server has not sent a role', () => {
    // The refresh flash: useUser() would say "viewer" here.
    const r = resolveAccess(null, { userId: 'u_owner', serverRole: null })
    expect(r.state).toEqual({ status: 'loading', role: null })
    expect(r.confirmed).toBeNull()
  })

  it('is loading before anything is known', () => {
    expect(resolveAccess(null, { userId: null, serverRole: null }).state.status).toBe('loading')
  })

  it('confirms the role the server sent', () => {
    const r = resolveAccess(null, { userId: 'u_owner', serverRole: 'admin' })
    expect(r.state).toEqual({ status: 'confirmed', role: 'admin' })
    expect(r.confirmed).toEqual(owner)
  })

  it('confirms viewer only when the server says viewer', () => {
    expect(resolveAccess(null, { userId: 'u_new', serverRole: 'viewer' }).state).toEqual({
      status: 'confirmed',
      role: 'viewer',
    })
  })

  it('treats an unknown server role as no access', () => {
    expect(resolveAccess(null, { userId: 'u_x', serverRole: 'superuser' }).state.role).toBe('viewer')
  })

  it('keeps the last confirmed role while the profile is briefly null (failed token refresh)', () => {
    const r = resolveAccess(owner, { userId: null, serverRole: null })
    expect(r.state).toEqual({ status: 'confirmed', role: 'admin' })
  })

  it('keeps the last confirmed role while the socket reconnects', () => {
    const r = resolveAccess(owner, { userId: 'u_owner', serverRole: null })
    expect(r.state).toEqual({ status: 'confirmed', role: 'admin' })
  })

  it('follows a real role change from the server', () => {
    const r = resolveAccess(owner, { userId: 'u_owner', serverRole: 'viewer' })
    expect(r.state).toEqual({ status: 'confirmed', role: 'viewer' })
    expect(r.confirmed).toEqual({ userId: 'u_owner', role: 'viewer' })
  })

  it("never carries one person's role over to another account", () => {
    const r = resolveAccess(owner, { userId: 'u_other', serverRole: null })
    expect(r.state.status).toBe('loading')
  })
})
