import { useRef, useState, type DragEvent } from 'react'
import { formatBytes } from '../lib/format'
import { ACCEPTED_EXTENSIONS, kindFromFilename, MAX_UPLOAD_BYTES } from '../lib/document-files'
import { uploadDocument } from '../lib/api'
import { Dialog } from './Dialog'
import { I } from './icons'

const KIND_LABEL = { pdf: 'PDF', md: 'Markdown', txt: 'Text' } as const

/** Client-side checks; the server repeats all of them. */
export function validateFile(file: File): string | null {
  const kind = kindFromFilename(file.name)
  if (!kind) {
    return /\.(png|jpe?g|gif|webp|heic|svg)$/i.test(file.name)
      ? "Images aren't supported. Upload a PDF, Markdown, or text file."
      : 'This file type isn’t supported. Upload a PDF, Markdown, or text file.'
  }
  if (file.size === 0) return 'This file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return `This file is ${formatBytes(file.size)}. Files can be at most 20 MB.`
  return null
}

export function UploadDialog({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  onUploaded: (documentId: string, name: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  /** Upload progress 0..100 from the browser's progress events, or null before sending. */
  const [progress, setProgress] = useState<number | null>(null)
  /** dragenter/dragleave also fire for child elements; count to know when the pointer really left. */
  const dragDepth = useRef(0)
  const [serverError, setServerError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const problem = file ? validateFile(file) : null

  function pick(f: File | undefined) {
    setServerError(null)
    setFile(f ?? null)
  }

  function close() {
    if (busy) return
    setFile(null)
    setServerError(null)
    setProgress(null)
    onClose()
  }

  async function upload() {
    if (!file || problem) return
    setBusy(true)
    setServerError(null)
    setProgress(0)
    const res = await uploadDocument(file, { onProgress: (f) => setProgress(Math.round(f * 100)) })
    setBusy(false)
    if (!res.success) {
      setProgress(null)
      setServerError(res.error)
      return
    }
    setProgress(100)
    // Let the finished bar register before the dialog closes.
    await new Promise((r) => setTimeout(r, 400))
    onUploaded(res.data.documentId, file.name)
    setFile(null)
    setProgress(null)
    onClose()
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    if (busy) return
    dragDepth.current += 1
    setOver(true)
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setOver(false)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setOver(false)
    if (!busy) pick(e.dataTransfer.files[0])
  }

  const kind = file ? kindFromFilename(file.name) : null
  return (
    <Dialog open={open} onClose={close} labelledBy="upload-title" testId="upload-dialog">
      <h2 id="upload-title">Upload a document</h2>
      <p>PDF, Markdown, or plain text, up to 20 MB. It&apos;s indexed automatically and can be searched in about a minute or two.</p>
      <div
        className={`dropzone${over ? ' drag' : ''}`}
        data-testid="dropzone"
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {I.doc}
        <p>Drag a file here, or choose one from your computer.</p>
        <input
          ref={input}
          type="file"
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          data-testid="upload-input"
          tabIndex={-1}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={busy}>
          Choose file
        </button>
      </div>
      {file && (
        <div className={`file-chip${problem ? ' bad' : ''}`} data-testid="upload-file-chip">
          <div>
            <div className="strong">{file.name}</div>
            {problem ? (
              <div className="field-error" role="alert">
                {problem}
              </div>
            ) : (
              <div className="sub">
                {kind ? KIND_LABEL[kind] : ''}, {formatBytes(file.size)}
              </div>
            )}
          </div>
          {!problem && progress === null && <span className="pill p-ready">Ready to upload</span>}
        </div>
      )}
      {progress !== null && (
        <>
          <div
            className="progressbar"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            data-testid="upload-progress"
          >
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="hint" style={{ marginTop: 6 }} aria-live="polite">
            {progress < 100 ? `Uploading ${progress}%` : 'Uploaded. Indexing will continue in the background.'}
          </div>
        </>
      )}
      {serverError && (
        <div className="banner" role="alert" style={{ marginTop: 14 }}>
          {I.warn}
          <div>
            <b>Upload failed</b>
            {serverError}
          </div>
        </div>
      )}
      <div className="dlg-actions">
        <button className="btn btn-ghost" onClick={close} disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => void upload()} disabled={!file || !!problem || busy} data-testid="upload-submit">
          {busy ? (
            <>
              <span className="spin" aria-hidden="true" />
              Uploading
            </>
          ) : (
            'Upload'
          )}
        </button>
      </div>
    </Dialog>
  )
}
