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

/**
 * Upload a document. XMLHttpRequest rather than fetch because only XHR reports
 * upload progress (`onProgress` gets 0..1 from the browser's real progress
 * events). Resolves with the route's JSON body, or an error message.
 */
export async function uploadDocument(
  file: File,
  options: { title?: string; onProgress?: (fraction: number) => void } = {},
): Promise<ActionResponse<{ documentId: string }>> {
  const form = new FormData()
  form.append('file', file)
  if (options.title) form.append('title', options.title)
  let headers: Record<string, string>
  try {
    headers = await authHeaders()
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Sign in again and retry.' }
  }
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/documents')
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) options.onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      let body: ActionResponse<{ documentId: string }> | null = null
      try {
        body = JSON.parse(xhr.responseText) as ActionResponse<{ documentId: string }>
      } catch {
        body = null
      }
      if (body && !body.success) return resolve(body)
      if (xhr.status < 200 || xhr.status >= 300 || !body) {
        return resolve({ success: false, error: `Upload failed (${xhr.status}). Try again.` })
      }
      options.onProgress?.(1)
      resolve(body)
    }
    xhr.onerror = () => resolve({ success: false, error: 'Network error. Check your connection and try again.' })
    xhr.onabort = () => resolve({ success: false, error: 'Upload cancelled.' })
    xhr.send(form)
  })
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
