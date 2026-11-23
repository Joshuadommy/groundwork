import { useRef } from 'react'
import { useQuery } from 'deepspace'

type QueryOptions = Parameters<typeof useQuery>[1]

/**
 * useQuery, but "loading" means only "no result yet". When the record socket
 * drops, the SDK sets every query back to `loading` while keeping its records
 * (RecordStore.resetToLoading). Treating that as loading replaced the whole
 * app with the loading screen (the workspace gate) and lists with skeletons
 * during a reconnect. Here, once a query has had a result, it stays `ready`
 * with the records it has, and the reconnecting pill tells people what's up.
 */
export function useLiveQuery<T extends Record<string, unknown>>(collection: string, options?: QueryOptions) {
  const result = useQuery<T>(collection, options)
  const key = `${collection}:${JSON.stringify(options ?? null)}`
  const loaded = useRef<string | null>(null)
  if (result.status !== 'loading') loaded.current = key
  const status = result.status === 'loading' && loaded.current === key ? ('ready' as const) : result.status
  return { ...result, status }
}
