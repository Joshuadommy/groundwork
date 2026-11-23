/**
 * Sign-in providers on the sign-in screen, in the prototype's order.
 *
 * Each button goes to /api/auth/social-redirect?provider=<id>, which hands off
 * to the DeepSpace auth worker. That worker starts OAuth for exactly these
 * four (and answers 400 for anything else); tests/smoke.spec.ts probes it so
 * this list can't drift from what the platform supports again. The SDK's
 * AuthOverlay type only names 'github' | 'google', which is how Apple and
 * Microsoft were wrongly left out before (morning review, bug 3).
 */
export const SIGN_IN_PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'microsoft', label: 'Microsoft' },
  { id: 'apple', label: 'Apple' },
  { id: 'github', label: 'GitHub' },
] as const

export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number]['id']

export const signInUrl = (provider: SignInProvider) => `/api/auth/social-redirect?provider=${provider}`
