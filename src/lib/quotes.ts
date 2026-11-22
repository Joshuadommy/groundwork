/**
 * Supporting quotes for citations, used to highlight the cited passage.
 *
 * Each knowledge item is a whole page, so "the cited passage" would highlight
 * an entire page. The model is also asked for one short verbatim quote per
 * cited label; this module keeps a quote only if it really occurs in that
 * passage's retrieved text (whitespace and case ignored), and re-centres the
 * citation's excerpt on it. A quote that does not match is dropped, never
 * repaired. Runs after verifyCitations and does not change its result.
 * Pure: shared by the worker and unit tests.
 */

import type { Citation } from '../schemas/answers-schema'
import type { LabeledPassage } from './verify-citations'

export const EXCERPT_MAX_CHARS = 320
const QUOTE_MAX_CHARS = 300

export interface ModelQuote {
  label: string
  quote: string
}

/** Collapse whitespace runs to one space, keeping a map back to `text`. */
function collapse(text: string): { flat: string; map: number[] } {
  let flat = ''
  const map: number[] = []
  let space = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      space = flat.length > 0
      continue
    }
    if (space) {
      flat += ' '
      map.push(i - 1)
      space = false
    }
    flat += ch
    map.push(i)
  }
  return { flat, map }
}

/** Where `quote` occurs in `text`, ignoring whitespace and case; in collapsed coordinates. */
export function locateQuote(text: string, quote: string): { flat: string; start: number; end: number } | null {
  const q = collapse(quote.replace(/^["'“‘\s]+|["'”’\s]+$/g, '')).flat
  if (q.length < 8 || q.length > QUOTE_MAX_CHARS) return null
  const { flat } = collapse(text)
  const start = flat.toLowerCase().indexOf(q.toLowerCase())
  return start < 0 ? null : { flat, start, end: start + q.length }
}

/** A window of at most `max` chars of `flat` around [start, end), with ellipses. */
export function windowAround(flat: string, start: number, end: number, max = EXCERPT_MAX_CHARS): string {
  const len = end - start
  let from = Math.max(0, start - Math.floor((max - len) / 2))
  const to = Math.min(flat.length, from + max)
  from = Math.max(0, to - max)
  // Avoid cutting words at the window edges.
  if (from > 0) {
    const sp = flat.indexOf(' ', from)
    if (sp >= 0 && sp < start) from = sp + 1
  }
  let stop = to
  if (to < flat.length) {
    const sp = flat.lastIndexOf(' ', to)
    if (sp >= end) stop = sp
  }
  return `${from > 0 ? '…' : ''}${flat.slice(from, stop)}${stop < flat.length ? '…' : ''}`
}

export function attachQuotes(citations: Citation[], passages: LabeledPassage[], quotes: ModelQuote[] | undefined): Citation[] {
  if (!quotes?.length) return citations
  const byLabel = new Map(passages.map((p) => [p.label.toUpperCase(), p]))
  return citations.map((c) => {
    const passage = byLabel.get(c.label.toUpperCase())
    if (!passage) return c
    for (const q of quotes) {
      if (q.label.trim().toUpperCase() !== c.label.toUpperCase()) continue
      const hit = locateQuote(passage.text, q.quote)
      if (!hit) continue
      return {
        ...c,
        quote: hit.flat.slice(hit.start, hit.end),
        excerpt: windowAround(hit.flat, hit.start, hit.end),
      }
    }
    return c
  })
}
