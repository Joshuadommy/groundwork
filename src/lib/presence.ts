import { canAsk, toAppRole } from '../roles'

interface RosterEntry {
  id: string
  name: string
  role: string
}

/**
 * Approved teammates who are online, you first, then by name. People waiting
 * for access (role `viewer`, or any unknown role) never appear, even though an
 * approved teammate's roster lists them.
 */
export function onlineTeammates<T extends RosterEntry>(users: T[], isOnline: (id: string) => boolean, meId: string | undefined): T[] {
  return users
    .filter((u) => canAsk(toAppRole(u.role)) && isOnline(u.id))
    .sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : (a.name || '').localeCompare(b.name || '')))
}
