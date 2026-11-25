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

/** "You and 1 other online", "Only you online", or "N online" when you aren't in the list. The count includes you. */
export function presenceLabel(onlineIds: string[], meId: string | undefined): string {
  const includesMe = !!meId && onlineIds.includes(meId)
  if (!includesMe) return `${onlineIds.length} online`
  const others = onlineIds.length - 1
  return others === 0 ? 'Only you online' : `You and ${others} ${others === 1 ? 'other' : 'others'} online`
}
