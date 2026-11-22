import { describe, expect, it } from 'vitest'
import {
  kindFromFilename,
  looksLikePdf,
  newDocumentId,
  safeFileName,
  titleFromFilename,
} from './document-files'
import { documentFolder } from './passage-key'

describe('kindFromFilename', () => {
  it('accepts pdf, markdown and text, case-insensitively', () => {
    expect(kindFromFilename('Policy.PDF')).toBe('pdf')
    expect(kindFromFilename('handbook.md')).toBe('md')
    expect(kindFromFilename('handbook.markdown')).toBe('md')
    expect(kindFromFilename('notes.txt')).toBe('txt')
  })

  it('rejects other types and names without an extension', () => {
    expect(kindFromFilename('slides.pptx')).toBeNull()
    expect(kindFromFilename('README')).toBeNull()
    expect(kindFromFilename('archive.pdf.zip')).toBeNull()
  })
})

describe('looksLikePdf', () => {
  it('checks the %PDF- signature', () => {
    expect(looksLikePdf(new TextEncoder().encode('%PDF-1.4\n...'))).toBe(true)
    expect(looksLikePdf(new TextEncoder().encode('# Not a PDF'))).toBe(false)
    expect(looksLikePdf(new Uint8Array())).toBe(false)
  })
})

describe('titleFromFilename and safeFileName', () => {
  it('drops the extension and any path', () => {
    expect(titleFromFilename('C:\\docs\\Remote_Work_Policy.pdf')).toBe('Remote Work Policy')
    expect(titleFromFilename('.pdf')).toBe('Untitled document')
  })

  it('keeps storage keys to safe characters', () => {
    expect(safeFileName('../Expense Guidelines (v2).pdf')).toBe('Expense-Guidelines-v2-.pdf')
    expect(safeFileName('   ')).toBe('document')
  })
})

describe('newDocumentId', () => {
  it('is unique and usable as a knowledge folder', () => {
    const a = newDocumentId()
    expect(a).not.toBe(newDocumentId())
    expect(documentFolder(a)).toBe(`docs/${a}`)
  })
})
