/**
 * Who's online, in the top bar (design/prototype.html): overlapping avatars of
 * approved teammates currently online, up to four then "+N", and "N online".
 *
 * Built on the SDK's presence: usePresence() sends a heartbeat every 60 s
 * (the server also stamps lastSeenAt when a socket connects) and derives
 * online from lastSeenAt on the users roster. The roster is only pushed when
 * someone's identity or role changes, not on heartbeats, so this refreshes it
 * with the SDK's useUsers().refresh() every PRESENCE_REFRESH_MS and on focus.
 *
 * Who sees whom: people waiting for access (role `viewer`) get an empty roster
 * from the server (users schema: viewer read: false), and this component only
 * renders inside the app shell, after the access gate. For approved teammates
 * the roster also lists waiting people (public identity only), so they are
 * filtered out here: only Viewer/Editor/Owner appear.
 */

import { useEffect, useMemo } from 'react'
import { usePresence, useUser, useUsers, type RoomUser } from 'deepspace'
import { avatarColor, initials } from '../hooks/useWorkspace'
import { onlineTeammates, presenceLabel } from '../lib/presence'

/** Online = a heartbeat within this window (heartbeats come every 60 s). */
export const PRESENCE_TIMEOUT_MS = 150_000
export const PRESENCE_REFRESH_MS = 20_000
export const MAX_AVATARS = 4

export function Presence() {
  const { users, isOnline } = usePresence({ timeoutMs: PRESENCE_TIMEOUT_MS })
  const { refresh } = useUsers()
  const { user: me } = useUser()

  useEffect(() => {
    const t = setInterval(refresh, PRESENCE_REFRESH_MS)
    // Background tabs throttle timers; refresh as soon as the tab is looked at again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const online = useMemo(() => onlineTeammates(users, isOnline, me?.id), [users, isOnline, me?.id])
  if (online.length === 0) return null

  const shown = online.slice(0, MAX_AVATARS)
  const more = online.slice(MAX_AVATARS)
  const nameOf = (u: RoomUser) => `${u.name || 'Teammate'}${u.id === me?.id ? ' (you)' : ''}`
  // The count includes you; the label says so ("You and 1 other online").
  const label = presenceLabel(online.map((u) => u.id), me?.id)

  return (
    <div className="presence" role="group" aria-label={label} data-testid="presence">
      <div className="presence-avs">
        {shown.map((u) => (
          <span
            key={u.id}
            className="av presence-av"
            style={{ background: avatarColor(u.id) }}
            tabIndex={0}
            aria-label={nameOf(u)}
            data-testid="presence-avatar"
            data-user-id={u.id}
          >
            {u.imageUrl ? <img src={u.imageUrl} alt="" /> : initials(u.name || '?')}
            <span className="presence-tip" aria-hidden="true">
              {nameOf(u)}
            </span>
          </span>
        ))}
        {more.length > 0 && (
          <span className="av presence-av presence-more" tabIndex={0} aria-label={`${more.length} more: ${more.map(nameOf).join(', ')}`} data-testid="presence-more">
            +{more.length}
            <span className="presence-tip" aria-hidden="true">
              {more.map(nameOf).join(', ')}
            </span>
          </span>
        )}
      </div>
      <span className="presence-label" data-testid="presence-count">
        <span className="presence-long">{label}</span>
        <span className="presence-short" aria-hidden="true">
          {online.length} online
        </span>
      </span>
    </div>
  )
}
