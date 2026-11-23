import { useRecordContext } from 'deepspace'
import { resolveAccess, type ConfirmedRole } from '../lib/access-state'
import type { AppRole } from '../roles'

/**
 * The last role the server confirmed for this tab, shared by every component
 * that asks (and kept across remounts). A full reload or sign-out clears it.
 */
let lastConfirmed: ConfirmedRole | null = null

/**
 * The signed-in user's Groundwork role, for UI decisions only. The server
 * enforces every permission independently (collection rules and requireRole).
 *
 * Reads the raw room role, not useUser().role: useUser() defaults a missing
 * role to "viewer", which flashed the waiting screen on every load and
 * whenever the profile was briefly unknown. See src/lib/access-state.ts.
 */
export function useAppRole(): { role: AppRole | null; isLoading: boolean } {
  const { userProfile, roomRole } = useRecordContext()
  const { state, confirmed } = resolveAccess(lastConfirmed, {
    userId: userProfile?.id ?? null,
    serverRole: roomRole ?? null,
  })
  lastConfirmed = confirmed
  return { role: state.role, isLoading: state.status === 'loading' }
}
