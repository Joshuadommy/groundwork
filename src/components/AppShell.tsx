/**
 * App shell from design/prototype.html: sidebar (sections, workspace), top
 * bar (page title, theme toggle, account menu) and the content area. Pages
 * render their own <main className="view"> (and Ask its source panel) into
 * `.content`.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { signOut, useUser } from 'deepspace'
import { useAppRole } from '../hooks/useAppRole'
import { usePageTitle } from '../hooks/usePageTitle'
import { avatarColor, initials, useDocuments, useWorkspace } from '../hooks/useWorkspace'
import { ROLE_LABELS } from '../roles'
import { I, Logo } from './icons'
import { Presence } from './Presence'
import { ReconnectingNotice } from './ReconnectingNotice'
import { ThemeChooser, ThemeToggle } from './ThemeToggle'

const NAV = [
  { path: '/ask', label: 'Ask', icon: I.ask },
  { path: '/documents', label: 'Documents', icon: I.doc },
  { path: '/evals', label: 'Evals', icon: I.evals },
  { path: '/team', label: 'Team', icon: I.team },
] as const

function titleFor(pathname: string): string {
  if (/^\/documents\/[^/]+/.test(pathname)) return 'Document'
  return NAV.find((n) => pathname.startsWith(n.path))?.label ?? 'Groundwork'
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { name: workspace } = useWorkspace()
  const { records: docs } = useDocuments()
  const ready = docs.filter((d) => d.data.status === 'ready').length
  const title = titleFor(pathname)
  // A document's tab shows its name: "Expense Guidelines · Groundwork".
  const docId = pathname.match(/^\/documents\/([^/]+)/)?.[1]
  const docTitle = docId ? docs.find((d) => d.recordId === decodeURIComponent(docId))?.data.title : undefined
  usePageTitle(docTitle ?? title)

  return (
    <div className="app" data-testid="app-shell">
      <aside className="side" aria-label="Main">
        <Logo href="/ask" />
        <nav className="nav" aria-label="Sections" data-testid="app-navigation">
          {NAV.map((n) => (
            <Link key={n.path} to={n.path} aria-current={pathname.startsWith(n.path) ? 'page' : undefined}>
              {n.icon}
              <span className="label-text">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="ws">
          <strong>{workspace}</strong>
          {ready} document{ready === 1 ? '' : 's'} ready
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <h1>{title}</h1>
          <div className="top-right">
            <Presence />
            <ThemeToggle />
            <AccountMenu workspace={workspace} />
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      <ReconnectingNotice />
    </div>
  )
}

function AccountMenu({ workspace }: { workspace: string }) {
  const { user } = useUser()
  const { role } = useAppRole()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btn.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const name = user?.name || user?.email || 'You'
  return (
    <div className="acct" ref={wrap}>
      <button
        ref={btn}
        className="acct-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="av av-lg" style={{ background: avatarColor(user?.id ?? name) }}>
          {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : initials(name)}
        </span>
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Account">
          <div className="menu-head">
            <b data-testid="nav-user-name">{name}</b>
            <span data-testid="nav-user-email">{user?.email}</span>
            <br />
            <span>
              {role ? ROLE_LABELS[role] : ''} in {workspace}
            </span>
          </div>
          <div className="menu-label">Theme</div>
          <ThemeChooser />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => void signOut().then(() => window.location.assign('/ask'))}
          >
            {I.out}Sign out
          </button>
        </div>
      )}
    </div>
  )
}
