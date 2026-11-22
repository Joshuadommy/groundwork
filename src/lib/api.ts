/**
 * Browser calls to Groundwork's server actions and document routes, with the
 * signed-in user's short-lived token. The server re-checks the role on every
 * call; nothing here is a permission decision.
 */

import { getAuthToken } from 'deepspace'

export type ActionResponse<T> = { success: true; data: T } | { success: false; error: string }

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken()
  if (!token) throw new Error('You are signed out. Sign in again and retry.')
  return { Authorization: `Bearer ${token}` }
}

export async function callAction<T = unknown>(name: string, params: Record<string, unknown> = {}): Promise<ActionResponse<T>> {
  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (res.status === 401) return { success: false, error: 'You are signed out. Sign in again and retry.' }
    if (!res.ok) return { success: false, error: `Something went wrong (${res.status}). Try again.` }
    const body = (await res.json()) as ActionResponse<T>
    return body.success ? body : { success: false, error: body.error || 'Something went wrong. Try again.' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error. Try again.' }
  }
}

export async function uploadDocument(file: File, title?: string): Promise<ActionResponse<{ documentId: string }>> {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  try {
    const res = await fetch('/api/documents', { method: 'POST', headers: await authHeaders(), body: form })
    const body = (await res.json().catch(() => null)) as ActionResponse<{ documentId: string }> | null
    if (body && !body.success) return body
    if (!res.ok || !body) return { success: false, error: `Upload failed (${res.status}). Try again.` }
    return body
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error. Try again.' }
  }
}

/** The original file, fetched through the role-checked route. */
export async function fetchDocumentFile(documentId: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/file`, {
    headers: await authHeaders(),
    signal,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Could not load the file (${res.status}).`)
  }
  return res.blob()
}
