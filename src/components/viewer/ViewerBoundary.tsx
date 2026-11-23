import { Component, type ReactNode } from 'react'
import { I } from '../icons'

/**
 * Keeps a viewer failure (PDF.js can throw while rendering, as it did when its
 * worker failed to load on the live site) inside the document area instead of
 * replacing the whole page with the router's error screen.
 */
export default class ViewerBoundary extends Component<
  { onDownload?: () => void; resetKey: string; children: ReactNode },
  { error: string | null; resetKey: string }
> {
  state = { error: null as string | null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    // A different document gets a fresh try.
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: unknown) {
    console.error('[viewer]', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="banner" role="alert" data-testid="viewer-error">
        {I.warn}
        <div>
          <b>Couldn&apos;t display this document</b>
          {this.state.error}{' '}
          {this.props.onDownload && (
            <>
              You can still{' '}
              <button className="link-btn" onClick={this.props.onDownload}>
                download it
              </button>
              .
            </>
          )}
        </div>
      </div>
    )
  }
}
