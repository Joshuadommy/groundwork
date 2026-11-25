/**
 * Thumbs up/down (one per person per answer, changeable), an optional note on
 * a thumbs-down, and "Save as eval case" for Editors and Owners. Ratings are
 * written straight to the `feedback` collection (its rules allow each
 * teammate to create and edit only their own row, unique per answer), so
 * counts update live for everyone. Saving an eval case goes through the
 * server action, which re-checks the role.
 */

import { useEffect, useState } from 'react'
import { useMutations, useUser, type RecordData } from 'deepspace'
import { useToast } from '@/components/ui'
import { useAppRole } from '../../hooks/useAppRole'
import { callAction } from '../../lib/api'
import { canEditDocuments } from '../../roles'
import type { AnswerData } from '../../schemas/answers-schema'
import type { FeedbackData } from '../../schemas/feedback-schema'
import { I } from '../icons'

export function Feedback({
  answer,
  ratings,
  saved,
  onDelete,
}: {
  answer: RecordData<AnswerData>
  ratings: RecordData<FeedbackData>[]
  saved: boolean
  /** Owners only: asks to delete this answer (the page confirms, the server enforces). */
  onDelete?: () => void
}) {
  const { user } = useUser()
  const { role } = useAppRole()
  const { ready, createConfirmed, putConfirmed, removeConfirmed } = useMutations<FeedbackData>('feedback')
  const { error, success } = useToast()
  const mine = ratings.find((r) => r.data.userId === user?.id)
  const ups = ratings.filter((r) => r.data.rating === 'up').length
  const downs = ratings.length - ups
  const [panel, setPanel] = useState(false)
  const [note, setNote] = useState(mine?.data.note ?? '')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const canSave = canEditDocuments(role)

  useEffect(() => setNote(mine?.data.note ?? ''), [mine?.data.note])

  async function vote(rating: 'up' | 'down') {
    if (!user || busy) return
    setBusy(true)
    try {
      if (mine && mine.data.rating === rating) {
        await removeConfirmed(mine.recordId)
        setPanel(false)
      } else if (mine) {
        await putConfirmed(mine.recordId, { rating, ...(rating === 'up' ? { note: '' } : {}) })
        setPanel(rating === 'down')
      } else {
        await createConfirmed({ answerId: answer.recordId, userId: user.id, rating })
        setPanel(rating === 'down')
      }
    } catch (e) {
      error('Your rating wasn’t saved', e instanceof Error ? e.message : 'Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    if (!mine || (mine.data.note ?? '') === note.trim()) return
    try {
      await putConfirmed(mine.recordId, { note: note.trim().slice(0, 1000) })
    } catch (e) {
      error('Your note wasn’t saved', e instanceof Error ? e.message : 'Try again.')
    }
  }

  async function saveEval() {
    setSaving(true)
    await saveNote()
    const res = await callAction<{ alreadySaved: boolean }>('saveEvalCase', { answerId: answer.recordId })
    setSaving(false)
    if (!res.success) return error('Couldn’t save the eval case', res.error)
    success(res.data.alreadySaved ? 'Already saved as an eval case' : 'Saved as eval case')
  }

  const showPanel = panel && mine?.data.rating === 'down'
  return (
    <>
      <div className="fb" data-testid="feedback">
        <button
          className="icon-btn"
          aria-pressed={mine?.data.rating === 'up'}
          aria-label={`Helpful, ${ups} vote${ups === 1 ? '' : 's'}`}
          disabled={!ready || busy}
          data-testid="vote-up"
          onClick={() => void vote('up')}
        >
          {I.up}
          <span data-testid="count-up">{ups}</span>
        </button>
        <button
          className="icon-btn"
          aria-pressed={mine?.data.rating === 'down'}
          aria-label={`Not helpful, ${downs} vote${downs === 1 ? '' : 's'}`}
          disabled={!ready || busy}
          data-testid="vote-down"
          onClick={() => void vote('down')}
        >
          {I.down}
          <span data-testid="count-down">{downs}</span>
        </button>
        {mine?.data.rating === 'down' && !panel && (
          <button className="link-btn" style={{ fontSize: 14 }} onClick={() => setPanel(true)}>
            {mine.data.note ? 'Edit note' : 'Add a note'}
          </button>
        )}
        {saved && <span className="saved">Saved as eval case</span>}
        {onDelete && (
          <button className="icon-only fb-delete" aria-label="Delete answer" title="Delete answer" data-testid="delete-answer" onClick={onDelete}>
            {I.trash}
          </button>
        )}
      </div>
      {showPanel && (
        <div className="fb-panel" data-testid="feedback-panel">
          <label htmlFor={`note-${answer.recordId}`} className="strong" style={{ fontSize: 14 }}>
            What was wrong with this answer?
          </label>
          <textarea
            id={`note-${answer.recordId}`}
            value={note}
            maxLength={1000}
            placeholder="Optional. Helps your team fix the source documents."
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => void saveNote()}
          />
          <div className="row">
            {canSave ? (
              saved ? (
                <span className="saved">Saved as eval case</span>
              ) : (
                <button className="btn btn-primary" disabled={saving} onClick={() => void saveEval()} data-testid="save-eval">
                  {saving ? 'Saving…' : 'Save as eval case'}
                </button>
              )
            ) : (
              <>
                <button className="btn btn-primary" disabled>
                  Save as eval case
                </button>
                <span className="hint">Editors and owners can save eval cases.</span>
              </>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => {
                void saveNote()
                setPanel(false)
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}
