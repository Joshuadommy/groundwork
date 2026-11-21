/**
 * Signed-out screen, rendered by the AuthGate in (app)/_layout.tsx.
 * Sign-in itself is the SDK's AuthOverlay (Google or GitHub; the email field
 * only signs in existing accounts, which in practice are test accounts).
 * Phase D restyles this to match design/prototype.html.
 */

import { useState } from 'react'
import { AuthOverlay } from 'deepspace'
import { Button } from '@/components/ui'

export default function SignInScreen() {
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <div data-testid="sign-in-screen" className="flex min-h-screen items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Answers your team can trust</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to ask questions about your team&apos;s documents.
        </p>
        <Button data-testid="sign-in-button" className="mt-6 w-full" onClick={() => setShowAuthModal(true)}>
          Sign in
        </Button>
      </div>

      {showAuthModal && (
        <AuthOverlay providers={['google', 'github']} onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  )
}
