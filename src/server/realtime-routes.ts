/**
 * WebSocket routing for app-owned Durable Objects.
 *
 * Caller identity in query parameters and headers is never trusted. Routes
 * scrub it and forward verified JWT identity in internal-only headers.
 *
 * Groundwork is private to its team, so every room requires a verified token:
 * a connection without one is refused with 401 before it reaches a Durable
 * Object. The scaffold's Yjs, canvas and presence routes are removed because
 * the app uses none of them (the Yjs route also derived roles from a
 * `documents` collection shape that is not ours).
 */

import type { Context, Hono } from 'hono'
import { authenticatedRoomRequest, resolveAppRole, verifyJwt } from 'deepspace/worker'
import type { JwtVerifierConfig, VerifyResult } from 'deepspace/worker'
import type { AppContext, Env } from '../../worker.js'

function jwtConfig(env: Env): JwtVerifierConfig {
  return { publicKey: env.AUTH_JWT_PUBLIC_KEY, issuer: env.AUTH_JWT_ISSUER }
}

function wsRoute(
  doNamespace: (env: Env) => DurableObjectNamespace,
  extraIdentity?: (auth: VerifyResult, env: Env) => { role?: string } | Promise<{ role?: string }>,
) {
  return async (c: Context<AppContext>) => {
    const id = c.req.param('roomId') ?? c.req.param('docId') ?? c.req.param('scopeId')
    if (!id) return new Response('Not found', { status: 404 })
    const url = new URL(c.req.url)
    const token = url.searchParams.get('token')
    if (!token) return new Response('Unauthorized', { status: 401 })
    const auth = (await verifyJwt(jwtConfig(c.env), token)).result
    if (!auth) return new Response('Unauthorized', { status: 401 })

    const roomRequest = authenticatedRoomRequest(
      c.req.raw,
      auth,
      await extraIdentity?.(auth, c.env),
    )

    const namespace = doNamespace(c.env)
    const stub = namespace.get(namespace.idFromName(id))
    return stub.fetch(roomRequest)
  }
}

export function registerRealtimeRoutes(app: Hono<AppContext>): void {
  app.get(
    '/ws/:roomId',
    wsRoute((env) => env.RECORD_ROOMS),
  )

  app.get(
    '/ws/cron/:roomId',
    wsRoute(
      (env) => env.CRON_ROOMS,
      // Authenticated users get their current app role (cron is admin-only;
      // resolveAppRole reports admin correctly).
      async (auth, env) => ({ role: await resolveAppRole(env, auth.userId) }),
    ),
  )

  app.get(
    '/ws/jobs/:roomId',
    wsRoute((env) => env.JOB_ROOMS),
  )
}
