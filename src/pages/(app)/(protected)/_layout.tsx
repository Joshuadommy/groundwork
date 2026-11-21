/**
 * Gated routes. Every Groundwork page lives under src/pages/(app)/(protected)/.
 *
 * Sign-in is already required one level up: (app)/_layout.tsx wraps the data
 * layer in AuthGate, because a RecordProvider without `allowAnonymous`
 * renders nothing for signed-out visitors. This layout adds the second gate:
 * signed-in users without a role (`viewer`) see "waiting for access" until an
 * owner approves them on the Team page.
 *
 * Both gates are for the person, not for security. The server is the
 * boundary: the records WebSocket requires a token, collection rules send a
 * viewer nothing, and actions/routes call requireRole.
 */

import { Outlet } from 'react-router-dom'
import MembersOnly from '../../../components/MembersOnly'

export default function ProtectedLayout() {
  return (
    <MembersOnly>
      <Outlet />
    </MembersOnly>
  )
}
