import { Navigate, useLocation, useParams } from 'react-router-dom'

/** /documents/:id opens the first page. */
export default function DocumentRoot() {
  const { id } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/documents/${encodeURIComponent(id ?? '')}/1${search}`} replace />
}
