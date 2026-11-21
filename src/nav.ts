/**
 * Navigation Config
 *
 * One entry per nav item. Routes are handled by generouted (file-based
 * routing in src/pages/); this only controls what appears in the navigation.
 * Every page is already behind MembersOnly, so items need no role unless they
 * are narrower than "approved teammate". The Team page is visible to everyone
 * approved (read-only for non-owners).
 */

import type { AppRole } from './roles'

export interface NavItem {
  path: string
  label: string
  roles?: AppRole[]
  devOnly?: boolean
}

export const nav: NavItem[] = [
  { path: '/ask', label: 'Ask' },
  { path: '/documents', label: 'Documents' },
  { path: '/evals', label: 'Evals' },
  { path: '/team', label: 'Team' },
]
