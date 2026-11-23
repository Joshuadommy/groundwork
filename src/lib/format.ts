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

/** "just now", "10 minutes ago", "2 days ago"; "" when the date is missing or invalid. */
export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'just now'
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ]
  for (const [size, name] of units) {
    if (s >= size) {
      const n = Math.floor(s / size)
      return `${n} ${name}${n === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}
