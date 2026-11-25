import { describe, expect, it } from 'vitest'
import { onlineTeammates, presenceLabel } from './presence'

const u = (id: string, name: string, role: string) => ({ id, name, role })

describe('onlineTeammates', () => {
  const roster = [
    u('w', 'Wendy Waiting', 'viewer'),
    u('x', 'Xavier Unknown', 'superuser'),
    u('b', 'Bea Editor', 'editor'),
    u('a', 'Al Viewer', 'member'),
    u('me', 'Owner Me', 'admin'),
    u('o', 'Olga Offline', 'editor'),
  ]
  const online = new Set(['w', 'x', 'b', 'a', 'me'])

  it('shows only approved teammates who are online, you first, then by name', () => {
    expect(onlineTeammates(roster, (id) => online.has(id), 'me').map((x) => x.id)).toEqual(['me', 'a', 'b'])
  })

  it('never includes people waiting for access, even when they are online', () => {
    expect(onlineTeammates(roster, () => true, 'me').some((x) => x.role === 'viewer')).toBe(false)
  })
})

describe('presenceLabel', () => {
  it('counts you and says so', () => {
    expect(presenceLabel(['me', 'a'], 'me')).toBe('You and 1 other online')
    expect(presenceLabel(['me', 'a', 'b'], 'me')).toBe('You and 2 others online')
    expect(presenceLabel(['me'], 'me')).toBe('Only you online')
    expect(presenceLabel(['a', 'b'], 'me')).toBe('2 online')
  })
})
