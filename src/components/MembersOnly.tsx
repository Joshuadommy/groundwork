/**
 * Shows the "waiting for access" screen to signed-in users whose role is
 * `viewer` (no access), and the app to approved teammates.
 *
 * This is for the person, not a security boundary: the server sends a viewer
 * no records (collection rules) and refuses their actions (requireRole).
 */

import type { ReactNode } from 'react'
import { signOut, useUser } from 'deepspace'
import { Button, useToast } from '@/components/ui'
import { useAppRole } from '../hooks/useAppRole'

export default function MembersOnly({ children }: { children: ReactNode }) {
  const { role, isLoading } = useAppRole()
  if (isLoading) return <div aria-busy="true" className="min-h-[60vh]" />
  if (role === null || role === 'viewer') return <WaitingForAccess />
  return <>{children}</>
}

function WaitingForAccess() {
  const { user } = useUser()
  const { success } = useToast()
  const email = user?.email ?? ''

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email)
      success('Email copied')
    } catch {
      // Clipboard can be blocked; the email is visible on screen either way.
    }
  }

  return (
    <div data-testid="waiting-for-access" className="flex min-h-[70vh] items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          You don&apos;t have access to this workspace yet
        </h1>
        <p className="mt-2 text-muted-foreground">
          {email ? <>You&apos;re signed in as <strong className="text-foreground">{email}</strong>. </> : null}
          Ask the workspace owner to approve you on the Team page. This page updates by itself once
          they do.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {email && <Button onClick={copyEmail}>Copy my email</Button>}
          <Button variant="outline" onClick={() => signOut()}>
            Sign in with another account
          </Button>
        </div>
      </div>
    </div>
  )
}
