import { describe, expect, it } from 'vitest'
import { documentFolder, pageKey, parsePassageKey } from './passage-key'

describe('passage keys', () => {
  it('builds the per-page key used for knowledge items', () => {
    expect(pageKey('abc123', 7)).toBe('docs/abc123/p0007.txt')
    expect(documentFolder('abc123')).toBe('docs/abc123')
  })

  it('rejects ids and pages that would break the key', () => {
    expect(() => pageKey('../x', 1)).toThrow()
    expect(() => pageKey('abc', 0)).toThrow()
    expect(() => pageKey('abc', 1.5)).toThrow()
  })

  it('parses the key a search chunk returns (shape observed in the Phase B spike)', () => {
    expect(
      parsePassageKey({ key: 'docs/spike1/p0002.txt', folder: 'docs/spike1/', filename: 'p0002.txt' }),
    ).toEqual({ documentId: 'spike1', page: 2 })
  })

  it('falls back to folder + filename when key is missing', () => {
    expect(parsePassageKey({ folder: 'docs/doc9/', filename: 'p0123.txt' })).toEqual({
      documentId: 'doc9',
      page: 123,
    })
  })

  it('round-trips pages beyond 9999', () => {
    expect(parsePassageKey({ key: pageKey('d', 12345) })).toEqual({ documentId: 'd', page: 12345 })
  })

  it('returns null for keys that are not document pages', () => {
    expect(parsePassageKey({ key: 'other/doc/p0001.txt' })).toBeNull()
    expect(parsePassageKey({ key: 'docs/doc/readme.md' })).toBeNull()
    expect(parsePassageKey({ key: 'docs/doc/p0000.txt' })).toBeNull()
    expect(parsePassageKey({ key: 'docs/a/b/p0001.txt' })).toBeNull()
    expect(parsePassageKey({})).toBeNull()
  })
})
