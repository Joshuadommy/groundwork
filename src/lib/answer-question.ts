/**
 * The ask pipeline, with retrieval and generation injected so it can be unit
 * tested with fakes and reused by eval re-runs:
 *
 *   retrieve → keep chunks whose key parses to a page of a ready document →
 *   dedupe, cap, label S1..Sn → (nothing left? abstain, no model call) →
 *   generate → verifyCitations
 *
 * Pure orchestration: no DeepSpace imports.
 */

import { parsePassageKey } from './passage-key'
import { verifyCitations, type LabeledPassage, type ModelAnswer, type VerifiedAnswer } from './verify-citations'

export const MAX_PASSAGES = 8

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
  generate: (question: string, passages: LabeledPassage[]) => Promise<ModelAnswer>
}

export interface AnswerResult extends VerifiedAnswer {
  /** Passages shown to the model (empty when it abstained before generation). */
  passages: LabeledPassage[]
  /** Whether the model was called. */
  generated: boolean
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
  const passages = await labelPassages(chunks, deps.readyDocuments)
  if (passages.length === 0) {
    return { ...verifyCitations({ answer: '', citations: [], answerable: false }, []), passages, generated: false }
  }
  const model = await deps.generate(question, passages)
  return { ...verifyCitations(model, passages), passages, generated: true }
}
