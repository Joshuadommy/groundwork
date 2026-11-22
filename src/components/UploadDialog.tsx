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
    onClose()
  }

  async function upload() {
    if (!file || problem) return
    setBusy(true)
    setServerError(null)
    const res = await uploadDocument(file)
    setBusy(false)
    if (!res.success) {
      setServerError(res.error)
      return
    }
    onUploaded(res.data.documentId, file.name)
    setFile(null)
    onClose()
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    pick(e.dataTransfer.files[0])
  }

  const kind = file ? kindFromFilename(file.name) : null
  return (
    <Dialog open={open} onClose={close} labelledBy="upload-title" testId="upload-dialog">
      <h2 id="upload-title">Upload a document</h2>
      <p>PDF, Markdown, or plain text, up to 20 MB. It&apos;s indexed automatically and can be searched in about a minute or two.</p>
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
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
          {!problem && <span className="pill p-ready">Ready to upload</span>}
        </div>
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
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </Dialog>
  )
}
