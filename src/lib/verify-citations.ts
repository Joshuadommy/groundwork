/**
 * Deterministic citation verification — the core of Groundwork's trust claim.
 *
 * The model is shown passages labelled S1..Sn and asked to cite them inline as
 * [S1] or [S1, S3]. This module checks every label it cited against the set
 * that retrieval actually returned:
 *   - all cited labels valid          → verified
 *   - some valid, some invented       → partial (invented labels removed)
 *   - none valid, or nothing cited,
 *     or the model said it can't tell → abstained (answer text replaced)
 *
 * It proves a citation points to a retrieved passage. It does not prove the
 * passage supports the sentence (see PLAN.md § Key design decision).
 * Pure: no I/O, shared by the worker and unit tests.
 */

import type { AnswerStatus, Citation } from '../schemas/answers-schema'

export const ABSTAIN_TEXT = "I couldn't find this in your documents."
const EXCERPT_MAX_CHARS = 320

/** A retrieved passage as shown to the model. */
export interface LabeledPassage {
  label: string
  chunkId: string
  documentId: string
  docTitle: string
  page: number
  text: string
}

/** The model's structured answer, before verification. */
export interface ModelAnswer {
  /** Answer text with inline markers like [S1] or [S1, S2]. */
  answer: string
  /** Labels the model says it relied on; merged with the inline markers. */
  citations: string[]
  /** False when the model judged the passages insufficient. */
  answerable: boolean
}

export interface VerifiedAnswer {
  status: Extract<AnswerStatus, 'verified' | 'partial' | 'abstained'>
  answerText: string
  citations: Citation[]
  /** Labels the model cited that were not retrieved, in first-seen order. */
  removedCitations: string[]
}

const MARKER_GROUP = /\[\s*(S\d+(?:\s*,\s*S\d+)*)\s*\]/gi
const LABEL = /^S\d+$/i

function normalizeLabel(label: string): string {
  return label.trim().toUpperCase()
}

/** Labels from inline markers, in order of first appearance. */
export function extractInlineLabels(text: string): string[] {
  const labels: string[] = []
  for (const match of text.matchAll(MARKER_GROUP)) {
    for (const part of match[1].split(',')) labels.push(normalizeLabel(part))
  }
  return labels
}

function unique(labels: string[]): string[] {
  return [...new Set(labels)]
}

/** Rewrite marker groups to keep only `keep` labels; drop emptied groups. */
function stripMarkers(text: string, keep: Set<string>): string {
  const rewritten = text.replace(MARKER_GROUP, (_whole, group: string) => {
    const kept = group.split(',').map(normalizeLabel).filter((l) => keep.has(l))
    return kept.length ? `[${unique(kept).join(', ')}]` : ''
  })
  return rewritten
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim()
}

function excerpt(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= EXCERPT_MAX_CHARS ? clean : `${clean.slice(0, EXCERPT_MAX_CHARS - 1).trimEnd()}…`
}

function abstain(removed: string[] = []): VerifiedAnswer {
  return { status: 'abstained', answerText: ABSTAIN_TEXT, citations: [], removedCitations: removed }
}

export function verifyCitations(model: ModelAnswer, passages: LabeledPassage[]): VerifiedAnswer {
  if (passages.length === 0 || !model.answerable || !model.answer.trim()) return abstain()

  const byLabel = new Map(passages.map((p) => [normalizeLabel(p.label), p]))
  const cited = unique([
    ...extractInlineLabels(model.answer),
    ...model.citations.map(normalizeLabel).filter((l) => LABEL.test(l)),
  ])
  const valid = cited.filter((l) => byLabel.has(l))
  const removed = cited.filter((l) => !byLabel.has(l))

  // An answer with no citation to a retrieved passage is not grounded.
  if (valid.length === 0) return abstain(removed)

  const citations: Citation[] = valid.map((label) => {
    const p = byLabel.get(label)!
    return {
      label,
      documentId: p.documentId,
      docTitle: p.docTitle,
      page: p.page,
      excerpt: excerpt(p.text),
      chunkId: p.chunkId,
    }
  })

  return {
    status: removed.length === 0 ? 'verified' : 'partial',
    answerText: stripMarkers(model.answer, new Set(valid)),
    citations,
    removedCitations: removed,
  }
}
