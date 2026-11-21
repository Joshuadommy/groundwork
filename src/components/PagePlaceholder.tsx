/** Temporary page body for Phase A; each page is replaced in Phases D and E. */

import { useAppRole } from '../hooks/useAppRole'
import { ROLE_LABELS } from '../roles'

export default function PagePlaceholder({ title, testId }: { title: string; testId: string }) {
  const { role } = useAppRole()
  return (
    <div data-testid={testId} className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-muted-foreground">
        Coming in a later build phase.{role ? ` You are signed in as ${ROLE_LABELS[role]}.` : ''}
      </p>
    </div>
  )
}
