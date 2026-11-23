/**
 * The access gate under (app)/(protected): people without a role see
 * "waiting for access"; an owner with no workspace yet sees the welcome
 * screen; everyone else gets the app shell.
 *
 * This is for the person, not a security boundary: the server sends a viewer
 * no records (collection rules) and refuses their actions (requireRole).
 * When an owner approves someone, their role changes over the live socket and
 * this screen turns into the app without a reload.
 */

import type { ReactNode } from 'react'
import { signOut, useUser } from 'deepspace'
import { useToast } from '@/components/ui'
import { useAppRole } from '../hooks/useAppRole'
import { usePageTitle } from '../hooks/usePageTitle'
import { useWorkspace } from '../hooks/useWorkspace'
import { Logo } from './icons'
import { ThemeToggle } from './ThemeToggle'
import LoadingScreen from './LoadingScreen'
import WelcomeScreen from './WelcomeScreen'

export default function MembersOnly({ children }: { children: ReactNode }) {
  const { role } = useAppRole()
  // Loading until the server has confirmed a role; the waiting screen only
  // for a confirmed "viewer" (src/lib/access-state.ts).
  if (role === null) return <LoadingScreen />
  if (role === 'viewer') return <WaitingForAccess />
  return <WorkspaceGate isOwner={role === 'admin'}>{children}</WorkspaceGate>
}

function WorkspaceGate({ isOwner, children }: { isOwner: boolean; children: ReactNode }) {
  const { exists } = useWorkspace()
  if (exists === null) return <LoadingScreen />
  if (!exists && isOwner) return <WelcomeScreen />
  return <>{children}</>
}

function WaitingForAccess() {
  const { user } = useUser()
  const { success, error } = useToast()
  usePageTitle('Waiting for access')
  const email = user?.email ?? ''

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email)
      success('Email copied')
    } catch {
      error('Could not copy', 'Your browser blocked the clipboard. Your email is shown above.')
    }
  }

  return (
    <>
      <ThemeToggle floating />
      <div className="single">
        <main className="panel" data-testid="waiting-for-access">
          <Logo />
          <h1>You don&apos;t have access to this workspace yet</h1>
          <p>
            {email ? (
              <>
                You&apos;re signed in as <strong data-testid="waiting-email">{email}</strong>.{' '}
              </>
            ) : null}
            Ask the workspace owner to approve you on the Team page. This page updates by itself once they do.
          </p>
          <div className="row">
            {email && (
              <button className="btn btn-primary" onClick={copyEmail}>
                Copy my email
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => void signOut().then(() => window.location.assign('/ask'))}>
              Sign in with another account
            </button>
          </div>
        </main>
      </div>
    </>
  )
}
