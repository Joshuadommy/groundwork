/**
 * Gated routes. Every Groundwork page lives under src/pages/(app)/(protected)/.
 *
 * Sign-in is already required one level up: (app)/_layout.tsx wraps the data
 * layer in AuthGate, because a RecordProvider without `allowAnonymous`
 * renders nothing for signed-out visitors. This layout adds the second gate
 * (MembersOnly: waiting for access, or first-run welcome for the owner) and
 * the app shell.
 *
 * Both gates are for the person, not for security. The server is the
 * boundary: the records WebSocket requires a token, collection rules send a
 * viewer nothing, and actions/routes call requireRole.
 */

import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import AppShell from '../../../components/AppShell'
import MembersOnly from '../../../components/MembersOnly'

export default function ProtectedLayout() {
  return (
    <MembersOnly>
      <AppShell>
        <Suspense
          fallback={
            <main className="view">
              <div className="loading-row">
                <span className="spin spin-lg" aria-hidden="true" />
                Loading…
              </div>
            </main>
          }
        >
          <Outlet />
        </Suspense>
      </AppShell>
    </MembersOnly>
  )
}
