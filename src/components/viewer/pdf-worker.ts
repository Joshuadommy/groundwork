/**
 * PDF.js worker entry, bundled by Vite into its own `.js` chunk.
 *
 * Why not point pdf.js at `pdfjs-dist/build/pdf.worker.min.mjs` by URL: that
 * file is copied byte-for-byte as an asset, and on DeepSpace production it was
 * served as application/octet-stream, so the browser refused it and no PDF
 * opened (morning review, bug 2). Renaming it to .js was not enough: deploy
 * stores assets by content hash, and the unchanged bytes kept the type they
 * were first stored with. Bundling makes it ordinary app JavaScript.
 */
import 'pdfjs-dist/build/pdf.worker.min.mjs'
