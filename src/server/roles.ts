/**
 * Server-side role enforcement for code that runs with RBAC off.
 *
 * Server actions, custom HTTP routes and jobs reach the record room with
 * `X-App-Action: true`, which bypasses collection permissions. Each of them
 * must therefore call `requireRole` (or wrap with `withRole`) before doing
 * anything on the caller's behalf.
 *
 * Why not the SDK's `resolveAppRole` / `resolveAppMembership`: they recognise
 * only `member` and `admin` and report any other role — including our custom
 * `editor` — as `viewer`. This helper reads the raw role from the caller's
 * `users` row instead, with the same owner short-circuit and the same
 * fail-closed rule (a read that could not complete is 503, never a grant).
 */

import { RECORD_NOT_FOUND, type ActionHandler } from 'deepspace/worker'
import { toAppRole, type AppRole } from '../roles'
import type { Env } from '../../worker'

type RoleEnv = Pick<Env, 'RECORD_ROOMS' | 'DEEPSPACE_APP_ID' | 'OWNER_USER_ID'>

/**
 * The caller's current Groundwork role, or `null` when it could not be read.
 * A user with no `users` row yet (never opened the app) is `viewer`.
 */
export async function getAppRole(env: RoleEnv, userId: string): Promise<AppRole | null> {
  if (userId === env.OWNER_USER_ID) return 'admin'
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  try {
    const res = await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': env.OWNER_USER_ID,
          'X-App-Action': 'true',
        },
        body: JSON.stringify({
          tool: 'records.get',
          params: { collection: 'users', recordId: userId },
        }),
      }),
    )
    const json = (await res.json()) as {
      success?: boolean
      error?: string
      data?: { record?: { data?: { role?: unknown } } }
    }
    if (!json.success) {
      return typeof json.error === 'string' && json.error.startsWith(RECORD_NOT_FOUND)
        ? 'viewer'
        : null
    }
    return toAppRole(json.data?.record?.data?.role)
  } catch {
    return null
  }
}

export type RoleCheck =
  | { ok: true; role: AppRole }
  | { ok: false; status: 403 | 503; error: string }

export async function requireRole(
  env: RoleEnv,
  userId: string,
  allowed: readonly AppRole[],
): Promise<RoleCheck> {
  const role = await getAppRole(env, userId)
  if (role === null) {
    return { ok: false, status: 503, error: 'Could not verify your access. Try again.' }
  }
  if (!allowed.includes(role)) {
    return { ok: false, status: 403, error: 'You do not have permission to do this.' }
  }
  return { ok: true, role }
}

/** Wrap a server action so it runs only for callers holding one of `allowed`. */
export function withRole(
  allowed: readonly AppRole[],
  handler: ActionHandler<Env>,
): ActionHandler<Env> {
  return async (ctx) => {
    const check = await requireRole(ctx.env, ctx.userId, allowed)
    if (!check.ok) return { success: false, error: check.error }
    return handler(ctx)
  }
}
