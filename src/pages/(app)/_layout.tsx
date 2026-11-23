/**
 * Dynamic app boundary — the auth + realtime data layer.
 *
 * `(app)` is a Generouted route group: the parentheses mean it does NOT appear
 * in the URL, so (app)/home.tsx is served at /home. Every page under this
 * folder is wrapped in the DeepSpace providers below, so it may call `useAuth`,
 * `useQuery`, `useMutations`, `useUsers`, etc.
 *
 * Pages OUTSIDE this folder (top level of src/pages/) get none of this — they
 * render as static pages with no auth fetch and no records WebSocket. Move a
 * page in or out of (app)/ to flip it between dynamic and static. Require
 * sign-in on top of the data layer by nesting under (app)/(protected)/.
 *
 * The app chrome (AppShell) lives one level down in (protected)/_layout.tsx.
 */

import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthGate, DeepSpaceAuthProvider, useAuthStatus } from 'deepspace'
import LoadingScreen from '../../components/LoadingScreen'
import SignInScreen from '../../components/SignInScreen'
import { RecordProvider, RecordScope, AgentTools } from 'deepspace'
import { useToast } from '@/components/ui'
import { SCOPE_ID } from '../../constants'
import { schemas } from '../../schemas'

export default function AppLayout() {
  return (
    <DeepSpaceAuthProvider>
      {/* Each screen sets its own title with usePageTitle ("Ask · Groundwork"). */}
      {/* Groundwork is private: signed-out visitors get the sign-in screen and
          never mount the data layer (whose WebSocket requires a token). */}
      <SessionLoading>
        <AuthGate fallback={<SignInScreen />}>
          <AuthBoot>
            {/* The app shell is rendered by (protected)/_layout.tsx, after the
                access gate, so the waiting and welcome screens stand alone. */}
            <Outlet />
          </AuthBoot>
        </AuthGate>
      </SessionLoading>
    </DeepSpaceAuthProvider>
  )
}

/**
 * The SDK's AuthGate renders nothing while the session check is in flight;
 * show the app's loading screen instead of a blank page.
 */
function SessionLoading({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuthStatus()
  return isLoaded ? <>{children}</> : <LoadingScreen />
}

/**
 * Waits for auth to resolve, then mounts the data layer. Distinct from the SDK's `AuthGate`.
 * The loading screen continues in MembersOnly until the server confirms a role.
 */
function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuthStatus()
  // Record writes (`create`/`put`/`remove`) are fire-and-forget — they resolve
  // before the server answers, so a denied or invalid write only surfaces
  // through onWriteError. Route rejections to toasts so they're never a
  // silent no-op. Keep this wiring when customizing the layout.
  const { error, warning } = useToast()

  if (!isLoaded) {
    return <LoadingScreen />
  }

  return (
    // No `allowAnonymous`: Groundwork is private, and the records WebSocket
    // refuses connections without a token (src/server/realtime-routes.ts).
    <RecordProvider
      onWriteError={(e) =>
        e.kind === 'permission' ? warning(e.title, e.detail) : error(e.title, e.detail)
      }
    >
      <RecordScope roomId={SCOPE_ID} schemas={schemas}>
        <AgentTools />
        {children}
      </RecordScope>
    </RecordProvider>
  )
}
