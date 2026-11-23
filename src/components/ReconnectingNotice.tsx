import { useEffect, useRef, useState } from 'react'
import { useRecordContext } from 'deepspace'
import { useToast } from '@/components/ui'

/** How long the socket may be down before the pill shows (avoids flashing on blips). */
const SHOW_AFTER_MS = 800

/**
 * The prototype's "Reconnecting… your work is safe" pill. Shown when the live
 * connection drops after it had been up; the app stays as it was (the role is
 * kept, see src/lib/access-state.ts), and a toast confirms when it's back.
 */
export function ReconnectingNotice() {
  const { status } = useRecordContext()
  const [visible, setVisible] = useState(false)
  const wasConnected = useRef(false)
  const shown = useRef(false)
  const { success } = useToast()

  // Keyed on connected / not connected, not on the raw status: while it
  // retries, the socket flips between "connecting" and "disconnected" faster
  // than SHOW_AFTER_MS, which would keep restarting the timer.
  const connected = status === 'connected'
  useEffect(() => {
    if (connected) {
      wasConnected.current = true
      setVisible(false)
      if (shown.current) {
        shown.current = false
        success('Reconnected')
      }
      return
    }
    if (!wasConnected.current) return
    const t = setTimeout(() => {
      shown.current = true
      setVisible(true)
    }, SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [connected, success])

  if (!visible) return null
  return (
    <div className="reconnect" role="status" data-testid="reconnecting">
      <span className="spin" aria-hidden="true" />
      Reconnecting… your work is safe
    </div>
  )
}
