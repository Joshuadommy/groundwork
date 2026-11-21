/**
 * Per-page PDF text extraction inside the Worker, using unpdf (a serverless
 * build of PDF.js). Returns one string per page, in page order; a page with
 * no extractable text (scanned, image-only, blank) is an empty string.
 */

import { extractText, getDocumentProxy } from 'unpdf'

export async function extractPdfPages(bytes: ArrayBuffer | Uint8Array): Promise<string[]> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const pdf = await getDocumentProxy(data)
  try {
    const { text } = await extractText(pdf, { mergePages: false })
    return text.map(normalizePageText)
  } finally {
    await pdf.destroy()
  }
}

/** Collapse PDF layout whitespace while keeping paragraph breaks. */
export function normalizePageText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
