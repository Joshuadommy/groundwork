/** Small display helpers. Pure. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function documentMeta(d: { kind: 'pdf' | 'md' | 'txt'; pageCount: number; sizeBytes: number; status: string }): string {
  const size = formatBytes(d.sizeBytes)
  if (d.kind === 'pdf') {
    return d.pageCount > 0 ? `PDF, ${d.pageCount} page${d.pageCount === 1 ? '' : 's'}, ${size}` : `PDF, ${size}`
  }
  return `${d.kind === 'md' ? 'Markdown' : 'Text'}, ${size}`
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
