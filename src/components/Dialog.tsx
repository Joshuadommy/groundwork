/**
 * Modal dialog on the native <dialog> element: showModal() gives the focus
 * trap, Escape to close and the inert background for free.
 */

import { useEffect, useRef, type ReactNode } from 'react'

export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  testId,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  testId?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="gw-dialog"
      aria-labelledby={labelledBy}
      data-testid={testId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {open ? <div className="dlg">{children}</div> : null}
    </dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  action,
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: ReactNode
  action: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onClose={onCancel} labelledBy="confirm-title" testId="confirm-dialog">
      <h2 id="confirm-title">{title}</h2>
      <p>{body}</p>
      <div className="dlg-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy} autoFocus>
          {busy ? 'Working…' : action}
        </button>
      </div>
    </Dialog>
  )
}
