/**
 * Signed-out screen (rendered by the AuthGate in (app)/_layout.tsx), styled
 * after design/prototype.html. Sign-in itself is DeepSpace's: each button
 * starts the SDK's social sign-in redirect. Google and GitHub are the
 * providers DeepSpace offers here (see PLAN.md § SDK feedback 9).
 */

import { useState } from 'react'
import { I, Logo } from './icons'
import { ThemeToggle } from './ThemeToggle'

export default function SignInScreen() {
  const [pending, setPending] = useState<string | null>(null)

  function start(provider: 'google' | 'github') {
    setPending(provider)
    window.location.href = `/api/auth/social-redirect?provider=${provider}`
  }

  return (
    <>
      <ThemeToggle floating />
      <div className="center" data-testid="sign-in-screen">
        <div className="center-pane">
          <main className="card-narrow">
            <Logo />
            <h1 className="auth-title">Answers your team can trust</h1>
            <p className="auth-sub">
              Sign in to ask questions about your team&apos;s documents. Every answer shows exactly where it came from.
            </p>
            <div className="oauth">
              <button className="btn btn-ghost" data-testid="sign-in-google" disabled={pending !== null} onClick={() => start('google')}>
                {I.google}
                {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
              </button>
              <button className="btn btn-ghost" data-testid="sign-in-github" disabled={pending !== null} onClick={() => start('github')}>
                {I.github}
                {pending === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}
              </button>
            </div>
            <p className="legal">Sign-in is handled securely by DeepSpace. Groundwork only sees your name and email.</p>
          </main>
        </div>
        <div className="brand-pane" aria-hidden="true">
          <div className="demo">
            <p className="demo-q">How many days a week can I work remotely?</p>
            <div className="demo-a">
              Up to three days a week after your first 90 days <span className="cite">1</span>. Core hours are 10:00
              a.m. to 3:00 p.m. Pacific <span className="cite">2</span>
              <div className="status st-verified" style={{ marginTop: 14 }}>
                {I.check}
                <div>
                  <b>Verified</b>
                  <span>2 of 2 citations match retrieved passages.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
