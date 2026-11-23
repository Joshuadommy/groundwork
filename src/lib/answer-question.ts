/**
 * The ask pipeline, with retrieval and generation injected so it can be unit
 * tested with fakes and reused by eval re-runs:
 *
 *   retrieve → keep chunks whose key parses to a page of a ready document →
 *   (nothing usable? expand the question into keyword searches and retrieve
 *   again) → dedupe, cap, label S1..Sn → (still nothing? abstain, no answer
 *   model call) → generate → verifyCitations
 *
 * Why the expansion: managed-knowledge search returns only hits above a
 * relevance cutoff (about 0.4; matchThreshold and mode made no difference,
 * PLAN.md SDK feedback 18), and its score rewards wording close to the
 * document's. A question in everyday words ("dating a coworker") scored under
 * the cutoff for a page that says "romantic relationship with a colleague",
 * so nothing came back and the ask abstained before the model.
 *
 * Pure orchestration: no DeepSpace imports.
 */

import { parsePassageKey } from './passage-key'
import { attachQuotes, type ModelQuote } from './quotes'
import type { AnswerCoverage } from '../schemas/answers-schema'
import { verifyCitations, type LabeledPassage, type ModelAnswer, type VerifiedAnswer } from './verify-citations'

export const MAX_PASSAGES = 8

/**
 * The generator's output: what verifyCitations checks, plus the model's
 * coverage judgment. Coverage is not verified (it cannot be, deterministically)
 * and is shown as a note, never as part of the verification status.
 */
export interface GeneratedAnswer extends ModelAnswer {
  coverage?: AnswerCoverage
  /** One short verbatim quote per cited label; kept only if found in the passage. */
  quotes?: ModelQuote[]
}

/** A raw search hit, shaped like a managed-knowledge chunk. */
export interface RetrievedChunk {
  id: string
  score: number
  text: string
  key?: string
  folder?: string
  filename?: string
}

export interface ReadyDocument {
  title: string
}

export interface AnswerDeps {
  retrieve: (question: string) => Promise<RetrievedChunk[]>
  /** Documents that are currently `ready`, by record id. */
  readyDocuments: (ids: string[]) => Promise<Map<string, ReadyDocument>>
  generate: (question: string, passages: LabeledPassage[]) => Promise<GeneratedAnswer>
  /**
   * Short keyword searches in the documents' likely vocabulary, used only when
   * the question as asked retrieves nothing usable. A failure here means "no
   * expansion", never a failed ask.
   */
  expandQuery?: (question: string) => Promise<string[]>
  /**
   * Progress, for the live steps on the Ask page: "reading" once passages are
   * retrieved and the model starts reading them, "checking" once it has
   * answered and citations are being verified. Not called when nothing
   * relevant was retrieved (there is nothing to read).
   */
  onStage?: (stage: 'reading' | 'checking') => Promise<void> | void
}

export interface AnswerResult extends VerifiedAnswer {
  /** Passages shown to the model (empty when it abstained before generation). */
  passages: LabeledPassage[]
  /** Whether the model was called. */
  generated: boolean
  /** Null when the answer abstained; otherwise the model's judgment (default full). */
  coverage: AnswerCoverage | null
  /** The extra searches run because the question itself found nothing (empty when not expanded). */
  expandedQueries: string[]
}

/** Up to this many expansion searches are run. */
export const MAX_EXPANDED_QUERIES = 5

/** Merge hits from several searches: one entry per chunk, keeping its best score, best first. */
export function mergeChunks(...lists: RetrievedChunk[][]): RetrievedChunk[] {
  const best = new Map<string, RetrievedChunk>()
  for (const list of lists) {
    for (const c of list) {
      const prev = best.get(c.id)
      if (!prev || c.score > prev.score) best.set(c.id, c)
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score)
}

/** Clean the expander's output: trimmed, non-empty, short, distinct, not the question again. */
export function cleanQueries(queries: string[], question: string): string[] {
  const seen = new Set([question.trim().toLowerCase()])
  const out: string[] = []
  for (const raw of queries) {
    const q = raw.replace(/\s+/g, ' ').trim()
    const key = q.toLowerCase()
    if (!q || q.length > 80 || seen.has(key)) continue
    seen.add(key)
    out.push(q)
    if (out.length === MAX_EXPANDED_QUERIES) break
  }
  return out
}

/** Turn search hits into labelled passages from ready documents. */
export async function labelPassages(
  chunks: RetrievedChunk[],
  readyDocuments: AnswerDeps['readyDocuments'],
  max = MAX_PASSAGES,
): Promise<LabeledPassage[]> {
  const located = chunks
    .map((chunk) => ({ chunk, loc: parsePassageKey(chunk) }))
    .filter((x): x is { chunk: RetrievedChunk; loc: NonNullable<typeof x.loc> } => x.loc !== null)
    .filter((x) => x.chunk.text.trim().length > 0)

  if (located.length === 0) return []
  const ready = await readyDocuments([...new Set(located.map((x) => x.loc.documentId))])

  const seen = new Set<string>()
  const passages: LabeledPassage[] = []
  for (const { chunk, loc } of [...located].sort((a, b) => b.chunk.score - a.chunk.score)) {
    const doc = ready.get(loc.documentId)
    if (!doc || seen.has(chunk.id)) continue
    seen.add(chunk.id)
    passages.push({
      label: `S${passages.length + 1}`,
      chunkId: chunk.id,
      documentId: loc.documentId,
      docTitle: doc.title,
      page: loc.page,
      text: chunk.text,
    })
    if (passages.length >= max) break
  }
  return passages
}

export async function answerQuestion(question: string, deps: AnswerDeps): Promise<AnswerResult> {
  const chunks = await deps.retrieve(question)
  let passages = await labelPassages(chunks, deps.readyDocuments)
  let expandedQueries: string[] = []
  if (passages.length === 0 && deps.expandQuery) {
    expandedQueries = cleanQueries(await deps.expandQuery(question).catch(() => []), question)
    if (expandedQueries.length > 0) {
      const more = await Promise.all(expandedQueries.map((q) => deps.retrieve(q).catch(() => [] as RetrievedChunk[])))
      passages = await labelPassages(mergeChunks(chunks, ...more), deps.readyDocuments)
    }
  }
  if (passages.length === 0) {
    return {
      ...verifyCitations({ answer: '', citations: [], answerable: false }, []),
      passages,
      generated: false,
      coverage: null,
      expandedQueries,
    }
  }
  await deps.onStage?.('reading')
  const model = await deps.generate(question, passages)
  await deps.onStage?.('checking')
  const verified = verifyCitations(model, passages)
  return {
    ...verified,
    citations: attachQuotes(verified.citations, passages, model.quotes),
    passages,
    generated: true,
    coverage: verified.status === 'abstained' ? null : model.coverage === 'partial' ? 'partial' : 'full',
    expandedQueries,
  }
}
