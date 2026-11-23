import { Logo } from './icons'

/**
 * Shown until sign-in and the person's role are confirmed by the server, so
 * nobody sees the waiting or sign-in screen for a moment before the app.
 * Matches the waiting and welcome screens (the `.single` layout).
 */
export default function LoadingScreen() {
  return (
    <div className="single" data-testid="app-loading" aria-busy="true">
      <main className="panel">
        <Logo />
        <div className="loading-row" role="status">
          <span className="spin spin-lg" aria-hidden="true" />
          Loading your workspace…
        </div>
      </main>
    </div>
  )
}
