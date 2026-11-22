import { readFileSync } from 'node:fs'
import type { APIRequestContext } from '@playwright/test'
import type { MultiplayerUser } from 'deepspace/testing'
import { findTestAccountByName } from 'deepspace/testing'

/** Trade the signed-in context's session cookie for a JWT, as getAuthToken() does. */
export async function tokenFor(user: MultiplayerUser): Promise<string> {
  const res = await user.context.request.post('/api/auth/token')
  if (!res.ok()) throw new Error(`token request failed: ${res.status()}`)
  const body = (await res.json()) as { token?: string }
  if (!body.token) throw new Error('token response had no token')
  return body.token
}

export async function callAction(
  request: APIRequestContext,
  name: string,
  params: Record<string, unknown>,
  token?: string,
) {
  const res = await request.post(`/api/actions/${name}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    data: params,
  })
  const body = res.status() === 200 ? await res.json() : null
  return { status: res.status(), body: body as { success: boolean; data?: any; error?: string } | null }
}

/**
 * True when the local dev server's owner is the named test account.
 * `deepspace test run` rewrites .dev.vars with the real owner, so owner-only
 * specs run with `npx playwright test -c tests/playwright.config.ts` after
 * setting OWNER_USER_ID (see PLAN.md § Testing).
 */
export function localOwnerIs(accountName: string): boolean {
  let userId: string | undefined
  try {
    userId = findTestAccountByName(accountName).userId
  } catch {
    return false
  }
  if (!userId) return false
  try {
    const vars = readFileSync(new URL('../../.dev.vars', import.meta.url), 'utf8')
    return vars.split('\n').some((line) => line.trim() === `OWNER_USER_ID=${userId}`)
  } catch {
    return false
  }
}
