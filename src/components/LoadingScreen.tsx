import { usePageTitle } from '../hooks/usePageTitle'
import { I } from './icons'

/**
 * The app loading screen from design/prototype.html (`.boot`). Shown until
 * sign-in and the person's role are confirmed by the server (the SessionLoading,
 * AuthBoot and MembersOnly gates all render this one component), so nobody
 * sees the waiting or sign-in screen for a moment before the app.
 */
export default function LoadingScreen() {
  usePageTitle('Loading')
  return (
    <div className="boot" role="status" aria-live="polite" data-testid="app-loading">
      <div className="boot-inner">
        <span className="logo-mark">{I.mark}</span>
        <span>Loading your workspace</span>
        <div className="boot-bar" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  )
}
