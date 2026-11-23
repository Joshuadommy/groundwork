import { readdirSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assetFileNames, misservedScripts } from './asset-names'

describe('asset names', () => {
  it('emits the PDF.js worker with a .js extension', () => {
    expect(assetFileNames({ names: ['pdf.worker.min.mjs'] })).toBe('assets/[name]-[hash].js')
    expect(assetFileNames({ names: ['legacy.cjs'] })).toBe('assets/[name]-[hash].js')
  })

  it('leaves other assets alone', () => {
    expect(assetFileNames({ names: ['TextLayer.css'] })).toBe('assets/[name]-[hash][extname]')
    expect(assetFileNames({ names: ['logo.svg'] })).toBe('assets/[name]-[hash][extname]')
  })

  it('flags .mjs and .cjs files in a bundle', () => {
    expect(misservedScripts(['assets/a.js', 'assets/pdf.worker.min-x.mjs', 'b.cjs', 'c.css'])).toEqual([
      'assets/pdf.worker.min-x.mjs',
      'b.cjs',
    ])
  })

  // When a build exists (CI and deploy run `vite build` first), check the real
  // output: this is the file list the live site serves.
  it.skipIf(!existsSync('dist/client/assets'))('the built client ships no .mjs or .cjs files', () => {
    const files = readdirSync('dist/client/assets')
    expect(misservedScripts(files)).toEqual([])
    // The PDF.js worker ships as a bundled .js chunk, not a copied asset.
    expect(files.some((f) => /^pdf-worker-.*\.js$/.test(f))).toBe(true)
    expect(files.some((f) => f.startsWith('pdf.worker'))).toBe(false)
  })
})
