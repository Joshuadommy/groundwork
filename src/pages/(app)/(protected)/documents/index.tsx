/**
 * Documents: what answers come from. Editors and Owners upload, retry and
 * delete (each enforced again on the server); Viewers see the list.
 * Indexing status is live: the job updates the record and every open page
 * sees it change.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { RecordData } from 'deepspace'
import { useToast } from '@/components/ui'
import { ConfirmDialog } from '../../../../components/Dialog'
import { I } from '../../../../components/icons'
import { SkeletonRows } from '../../../../components/SkeletonRows'
import { UploadDialog } from '../../../../components/UploadDialog'
import { useAppRole } from '../../../../hooks/useAppRole'
import { useDocuments, useNames } from '../../../../hooks/useWorkspace'
import { callAction } from '../../../../lib/api'
import { documentMeta } from '../../../../lib/format'
import { canEditDocuments } from '../../../../roles'
import type { DocumentData } from '../../../../schemas/documents-schema'

function StatusPill({ d }: { d: DocumentData }) {
  if (d.status === 'ready') return <span className="pill p-ready">Ready</span>
  if (d.status === 'indexing')
    return (
      <span className="pill p-index">
        <span className="spin" aria-hidden="true" />
        Indexing
      </span>
    )
  return <span className="pill p-fail">Couldn&apos;t read file</span>
}

export default function DocumentsPage() {
  const { role } = useAppRole()
  const canEdit = canEditDocuments(role)
  const names = useNames()
  const { records: docs, status } = useDocuments()
  const [params, setParams] = useSearchParams()
  const [uploadOpen, setUploadOpen] = useState(params.get('upload') === '1' && canEdit)
  const [toDelete, setToDelete] = useState<RecordData<DocumentData> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const { success, error, info } = useToast()
  const watching = useRef(new Map<string, string>())

  useEffect(() => {
    if (params.has('upload')) setParams({}, { replace: true })
  }, [params, setParams])

  // Tell the uploader when their document finishes indexing.
  useEffect(() => {
    for (const d of docs) {
      const name = watching.current.get(d.recordId)
      if (!name || d.data.status === 'indexing') continue
      watching.current.delete(d.recordId)
      if (d.data.status === 'ready') success(`${d.data.title} is ready to search`)
      else error(`Couldn't index ${d.data.title}`, d.data.error)
    }
  }, [docs, success, error])

  async function retry(d: RecordData<DocumentData>) {
    setBusy(d.recordId)
    const res = await callAction('retryDocumentIndexing', { documentId: d.recordId })
    setBusy(null)
    if (!res.success) return error('Could not retry', res.error)
    watching.current.set(d.recordId, d.data.title)
    info(`Indexing ${d.data.title} again`)
  }

  async function confirmDelete() {
    if (!toDelete) return
    const d = toDelete
    setBusy(d.recordId)
    const res = await callAction('deleteDocument', { documentId: d.recordId })
    setBusy(null)
    setToDelete(null)
    if (!res.success) return error('Could not delete', res.error)
    success(`Deleted ${d.data.title}`)
  }

  return (
    <main className="view" id="view" data-testid="page-documents">
      <div className="page-head">
        <div>
          <h2 className="page">Documents</h2>
          <p className="lede">Answers come only from these documents.</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setUploadOpen(true)} data-testid="open-upload">
            Upload document
          </button>
        )}
      </div>
      {!canEdit && (
        <div className="locked">You&apos;re a viewer. You can ask questions, but only editors and owners can upload or delete documents.</div>
      )}

      {status === 'loading' ? (
        <div className="table-wrap">
          <table role="table" className="table table-cards tc-docs" aria-busy="true" aria-label="Loading documents">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">Document</th>
                <th role="columnheader" className="hide-sm">Uploaded by</th>
                <th role="columnheader">Status</th>
                <th role="columnheader">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              <SkeletonRows cols={4} />
            </tbody>
          </table>
        </div>
      ) : status === 'error' ? (
        <div className="banner" role="alert">
          {I.warn}
          <div>
            <b>Couldn&apos;t load documents</b>Check your connection and reload the page.
          </div>
        </div>
      ) : docs.length === 0 ? (
        <div className="empty" data-testid="documents-empty">
          <h3>No documents yet</h3>
          <p>{canEdit ? 'Upload your first document to start asking questions.' : 'An editor or owner needs to upload documents first.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table role="table" className="table table-cards tc-docs">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">Document</th>
                <th role="columnheader" className="hide-sm">Uploaded by</th>
                <th role="columnheader">Status</th>
                <th role="columnheader">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {docs.map((r) => {
                const d = r.data
                return (
                  <tr role="row" key={r.recordId} data-testid="document-row" data-status={d.status}>
                    <td role="cell" className="dc-doc">
                      <div className="strong">
                        {d.status === 'ready' ? (
                          <Link className="doc-link" to={`/documents/${r.recordId}/1`}>
                            {d.title}
                          </Link>
                        ) : (
                          d.title
                        )}
                      </div>
                      <div className="sub">
                        {documentMeta(d)}
                        {d.status === 'failed' && d.error ? ` · ${d.error.replace(/^Indexing failed: /, '')}` : ''}
                      </div>
                    </td>
                    <td role="cell" className="hide-sm dc-by">{names.name(d.uploadedBy)}</td>
                    <td role="cell" className="dc-status">
                      <StatusPill d={d} />
                      {d.status === 'failed' && canEdit && (
                        <button
                          className="link-btn"
                          style={{ fontSize: 13, marginLeft: 6 }}
                          disabled={busy === r.recordId}
                          onClick={() => void retry(r)}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                    <td role="cell" className="dc-actions">
                      {canEdit && (
                        <button
                          className="icon-only"
                          aria-label={`Delete ${d.title}`}
                          disabled={busy === r.recordId}
                          onClick={() => setToDelete(r)}
                        >
                          {I.trash}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onUploaded={(id, name) => {
            watching.current.set(id, name)
            info(`Uploading ${name}`, 'It will be ready to search in a minute or two.')
          }}
        />
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.data.title ?? 'document'}?`}
        body="It will be removed from search for everyone in the workspace. Past answers that cited it keep their citations, marked as from a deleted document."
        action="Delete document"
        busy={busy !== null && busy === toDelete?.recordId}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </main>
  )
}
