import { useMemo } from 'react'
import { useLiveQuery } from './useLiveQuery'
import { useUsers } from 'deepspace'
import type { DocumentData } from '../schemas/documents-schema'

export type WorkspaceData = { slot: string; name: string; setupBy: string }

/** The single workspace row; `exists` is null while loading. */
export function useWorkspace() {
  const { records, status } = useLiveQuery<WorkspaceData>('workspace', { where: { slot: 'main' }, limit: 1 })
  const ws = records[0]?.data
  return {
    name: ws?.name ?? 'Groundwork',
    exists: status === 'loading' ? null : status === 'error' ? true : Boolean(ws),
    status,
  }
}

/** All documents, newest first (live). */
export function useDocuments() {
  return useLiveQuery<DocumentData>('documents', { orderBy: 'createdAt', orderDir: 'desc', limit: 500 })
}

/** Display names for user ids, from the SDK roster (names and roles; emails only for owners). */
export function useNames() {
  const { users, usersLoaded } = useUsers()
  return useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]))
    return {
      loaded: usersLoaded,
      users,
      name: (id: string | undefined) => (id && byId.get(id)?.name) || 'A teammate',
    }
  }, [users, usersLoaded])
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.map((p) => p[0]).join('').slice(0, 2) || '?').toUpperCase()
}

const AVATAR_COLORS = ['#1E6B52', '#3E5BA9', '#8A4E8C', '#A35A2A', '#2F6F8F', '#6B5B2E']
export function avatarColor(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
