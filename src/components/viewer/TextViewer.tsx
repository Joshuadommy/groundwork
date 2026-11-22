import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { clearHighlight, findTextRange, highlightTarget, paintHighlight, scrollToRange } from '../../lib/highlight'
import type { Citation } from '../../schemas/answers-schema'
import { I } from '../icons'

/**
 * Markdown (rendered with react-markdown: no raw HTML) and plain text, with
 * the cited passage highlighted.
 */
export default function TextViewer({ blob, kind, citation }: { blob: Blob; kind: 'md' | 'txt'; citation: Citation | null }) {
  const [text, setText] = useState<string | null>(null)
  const [hl, setHl] = useState<'none' | 'found' | 'missing'>('none')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    void blob.text().then((t) => live && setText(t))
    return () => {
      live = false
    }
  }, [blob])

  useEffect(() => {
    if (text === null || !citation || !ref.current) return
    const range = findTextRange(ref.current, highlightTarget(citation))
    if (range) {
      paintHighlight(range)
      scrollToRange(range)
      setHl('found')
    } else {
      setHl('missing')
    }
    return clearHighlight
  }, [text, citation])

  if (text === null)
    return (
      <div className="loading-row">
        <span className="spin spin-lg" aria-hidden="true" />
        Loading…
      </div>
    )

  return (
    <>
      {citation && hl !== 'none' && (
        <div className="cited-tag" role="status" data-testid="cited-tag">
          {I.check}
          {hl === 'found' ? 'Cited passage highlighted below' : 'The cited passage is in this document'}
        </div>
      )}
      <div ref={ref}>
        {kind === 'md' ? (
          <article className="md-doc" data-testid="md-doc">
            <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
          </article>
        ) : (
          <article className="txt-doc">{text}</article>
        )}
      </div>
    </>
  )
}
