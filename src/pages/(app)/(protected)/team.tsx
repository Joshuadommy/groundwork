/**
 * Team: Owners approve people waiting for access and manage roles; everyone
 * else sees a read-only member list (names and roles, no emails: the SDK
 * roster only includes emails for admins).
 *
 * Role changes call useUsers().setRole over the owner's socket. The record
 * room refuses setRole from anyone who is not an admin, and closes the
 * changed user's sockets so they reconnect with the new role (their waiting
 * screen turns into the app, or the app into the waiting screen).
 */

import { useMemo, useState } from 'react'
import { useUser, useUsers, type RoomUser } from 'deepspace'
import { useToast } from '@/components/ui'
import { ConfirmDialog } from '../../../components/Dialog'
import { I } from '../../../components/icons'
import { Listbox, type ListboxOption } from '../../../components/Listbox'
import { SkeletonRows } from '../../../components/SkeletonRows'
import { useAppRole } from '../../../hooks/useAppRole'
import { avatarColor, initials } from '../../../hooks/useWorkspace'
import { timeAgo } from '../../../lib/format'
import { isOwnerRole, ROLE_LABELS, toAppRole, type AppRole } from '../../../roles'

const ASSIGNABLE: AppRole[] = ['admin', 'editor', 'member']

/** Role choices on the Team page, as in the prototype (Viewer first). */
const ROLE_OPTIONS: ListboxOption<AppRole>[] = [
  { value: 'member', label: ROLE_LABELS.member, description: 'Can ask questions, open sources, and give feedback.' },
  { value: 'editor', label: ROLE_LABELS.editor, description: 'Also uploads and deletes documents and saves eval cases.' },
  { value: 'admin', label: ROLE_LABELS.admin, description: 'Also manages the team and re-runs evals.' },
]

function Who({ u, you, detail }: { u: RoomUser; you: boolean; detail?: string }) {
  return (
    <div className="who">
      <span className="av av-lg" style={{ background: avatarColor(u.id) }}>
        {u.imageUrl ? <img src={u.imageUrl} alt="" /> : initials(u.name || u.email || '?')}
      </span>
      <div>
        <div className="strong">
          {u.name || u.email || 'Unnamed'}
          {you && <span className="sub"> (you)</span>}
        </div>
        {(u.email || detail) && <div className="sub">{[u.email, detail].filter(Boolean).join(', ')}</div>}
      </div>
    </div>
  )
}

export default function TeamPage() {
  const { role } = useAppRole()
  const owner = isOwnerRole(role)
  const { user: me } = useUser()
  const { users, usersLoaded, setRole } = useUsers()
  const { success } = useToast()
  const [removing, setRemoving] = useState<RoomUser | null>(null)

  const { waiting, members } = useMemo(() => {
    const byName = (a: RoomUser, b: RoomUser) => (a.name || a.email || '').localeCompare(b.name || b.email || '')
    return {
      waiting: users.filter((u) => toAppRole(u.role) === 'viewer').sort(byName),
      members: users
        .filter((u) => toAppRole(u.role) !== 'viewer')
        .sort((a, b) => ASSIGNABLE.indexOf(toAppRole(a.role)) - ASSIGNABLE.indexOf(toAppRole(b.role)) || byName(a, b)),
    }
  }, [users])

  function change(u: RoomUser, next: AppRole, message: string) {
    setRole(u.id, next)
    success(message)
  }

  return (
    <main className="view" id="view" data-testid="page-team">
      <h2 className="page">Team</h2>
      <p className="lede">
        Viewers can ask questions and rate answers. Editors can also manage documents and save eval cases. Owners manage the team and
        run evals.
      </p>
      {!owner && <div className="locked">Only owners can approve people or change roles.</div>}

      {owner && usersLoaded && waiting.length > 0 && (
        <section aria-labelledby="waiting-title" data-testid="waiting-list">
          <h3 className="section-title" id="waiting-title" style={{ marginTop: 32 }}>
            Waiting for access
          </h3>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            These people signed in but can&apos;t see anything yet.
          </p>
          {waiting.map((u) => {
            const since = timeAgo(u.createdAt)
            return (
              <div key={u.id} className="waiting-card" data-testid="waiting-row" data-email={u.email}>
                <Who u={u} you={u.id === me?.id} detail={since ? `signed in ${since}` : undefined} />
                <div className="row">
                  <button className="btn btn-ghost" onClick={() => change(u, 'member', `${u.name || u.email} can now use Groundwork as viewer`)}>
                    Approve as Viewer
                  </button>
                  <button className="btn btn-primary" onClick={() => change(u, 'editor', `${u.name || u.email} can now use Groundwork as editor`)}>
                    Approve as Editor
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section aria-labelledby="members-title">
        <h3 className="section-title" id="members-title" style={{ marginTop: 36 }}>
          Members
        </h3>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody aria-busy={!usersLoaded}>
              {!usersLoaded ? (
                <SkeletonRows cols={3} />
              ) : (
                members.map((u) => {
                  const you = u.id === me?.id
                  const r = toAppRole(u.role)
                  return (
                    <tr key={u.id} data-testid="member-row" data-email={u.email}>
                      <td>
                        <Who u={u} you={you} />
                      </td>
                      <td>
                        {owner && !you ? (
                          <Listbox
                            value={r}
                            options={ROLE_OPTIONS}
                            label={`Role for ${u.name || u.email}`}
                            testId={`role-${u.id}`}
                            onChange={(next) => change(u, next, `${u.name || u.email} is now ${ROLE_LABELS[next].toLowerCase()}`)}
                          />
                        ) : (
                          <span>{ROLE_LABELS[r]}</span>
                        )}
                      </td>
                      <td>
                        {owner && !you && (
                          <button className="icon-only" aria-label={`Remove ${u.name || u.email}`} onClick={() => setRemoving(u)}>
                            {I.trash}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name || removing?.email || 'member'}?`}
        body="They'll lose access to this workspace right away and go back to “Waiting for access”. Their past questions and feedback stay."
        action="Remove member"
        onConfirm={() => {
          if (removing) change(removing, 'viewer', `Removed ${removing.name || removing.email}`)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </main>
  )
}
