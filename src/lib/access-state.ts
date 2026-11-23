/**
 * What the access gate may show, from what the server has actually confirmed.
 *
 * Why this exists: the SDK's useUser() reports `role: roomRole ?? 'viewer'`.
 * `roomRole` is null until the records socket's USER_INFO arrives, so for the
 * first moments of every load an Owner "is" a viewer. And the SDK re-reads the
 * profile every 30 s; when that read can't get a token, the profile becomes
 * null. Treating either as "no access" flashed the waiting screen at people
 * who have access.
 *
 * The rule here: only a role the server sent (USER_INFO) counts. Until one
 * arrives, show loading. Once one has, keep it through socket reconnects and
 * profile blips until the server sends a different one (a real role change
 * also arrives as USER_INFO, after the server closes the user's sockets).
 * Signing out is not handled here: AuthGate above the gate unmounts the app.
 */

import { toAppRole, type AppRole } from '../roles'

export interface ConfirmedRole {
  userId: string
  role: AppRole
}

export interface AccessInput {
  /** The signed-in user's id from the profile, or null while it's unknown. */
  userId: string | null
  /** The raw role from the server's USER_INFO, or null before it arrives. */
  serverRole: string | null
}

export type AccessState = { status: 'loading'; role: null } | { status: 'confirmed'; role: AppRole }

export function resolveAccess(
  last: ConfirmedRole | null,
  input: AccessInput,
): { state: AccessState; confirmed: ConfirmedRole | null } {
  if (input.serverRole !== null && input.userId !== null) {
    const confirmed = { userId: input.userId, role: toAppRole(input.serverRole) }
    return { state: { status: 'confirmed', role: confirmed.role }, confirmed }
  }
  // No fresh confirmation (socket handshake pending, reconnecting, or the
  // profile is briefly unknown): keep the last one if it is this user's.
  if (last && (input.userId === null || input.userId === last.userId)) {
    return { state: { status: 'confirmed', role: last.role }, confirmed: last }
  }
  return { state: { status: 'loading', role: null }, confirmed: null }
}
