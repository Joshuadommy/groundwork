import { useUser } from 'deepspace'
import { toAppRole, type AppRole } from '../roles'

/**
 * The signed-in user's Groundwork role, for UI decisions only. The server
 * enforces every permission independently (collection rules and requireRole).
 */
export function useAppRole(): { role: AppRole | null; isLoading: boolean } {
  const { user, isLoading } = useUser()
  if (isLoading) return { role: null, isLoading: true }
  return { role: user ? toAppRole(user.role) : null, isLoading: false }
}
