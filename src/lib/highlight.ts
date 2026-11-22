/**
 * Find a passage in rendered text (the pdf.js text layer, or rendered
 * Markdown) and paint it with the CSS Custom Highlight API. Matching ignores
 * whitespace and case, because the text layer splits lines into separate
 * spans. Painting never mutates the DOM that pdf.js or React owns.
 */

const HIGHLIGHT = 'gw-cited'

/** The text to look for: the verified quote, else the excerpt without its ellipses. */
export function highlightTarget(c: { quote?: string; excerpt: string }): string {
  return (c.quote || c.excerpt).replace(/^…|…$/g, '').trim()
}

export function findTextRange(root: Element, needle: string): Range | null {
  const target = needle.replace(/\s+/g, '').toLowerCase()
  if (target.length < 4) return null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const chars: Array<{ node: Text; offset: number }> = []
  let flat = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    const v = t.data
    for (let i = 0; i < v.length; i++) {
      if (/\s/.test(v[i])) continue
      flat += v[i].toLowerCase()
      chars.push({ node: t, offset: i })
    }
  }
  const at = flat.indexOf(target)
  if (at < 0) return null
  const s = chars[at]
  const e = chars[at + target.length - 1]
  const range = document.createRange()
  range.setStart(s.node, s.offset)
  range.setEnd(e.node, e.offset + 1)
  return range
}

/** Paint `range` as the cited passage (or clear it). False when unsupported. */
export function paintHighlight(range: Range | null): boolean {
  const registry = typeof CSS !== 'undefined' ? CSS.highlights : undefined
  if (!registry || typeof Highlight === 'undefined') return false
  registry.delete(HIGHLIGHT)
  if (!range) return false
  registry.set(HIGHLIGHT, new Highlight(range))
  return true
}

export function clearHighlight() {
  if (typeof CSS !== 'undefined') CSS.highlights?.delete(HIGHLIGHT)
}

/** If `range` is off screen, scroll so it sits a third of the way down the viewport. */
export function scrollToRange(range: Range) {
  const rect = range.getBoundingClientRect()
  if (!rect.height) return
  // Already comfortably on screen (below the sticky bars): leave the page put.
  if (rect.top > 160 && rect.bottom < window.innerHeight - 40) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 3, behavior: reduce ? 'auto' : 'smooth' })
}
