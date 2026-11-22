import { Logo } from '../components/icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { APP_NAME } from '../constants'

/**
 * 404 — a static page outside the data layer, so it renders for anyone.
 * The theme toggle needs no data layer.
 */
export default function NotFound() {
  return (
    <div className="single">
      <ThemeToggle floating />
      <title>{`Not found · ${APP_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <main className="panel" data-testid="not-found">
        <Logo href="/ask" />
        <p className="big-num" style={{ marginTop: 28 }}>
          404
        </p>
        <h1 style={{ marginTop: 4 }}>This page doesn&apos;t exist</h1>
        <p>The link may be old, or the page was moved.</p>
        <a className="btn btn-primary" href="/ask">
          Go to Ask
        </a>
      </main>
    </div>
  )
}
