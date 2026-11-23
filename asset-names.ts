/**
 * Build-output rules for scripts the browser loads by URL.
 *
 * DeepSpace's production asset serving answers `.mjs` files with
 * `Content-Type: application/octet-stream` (`.js` gets
 * `application/javascript`). Browsers refuse to run a module script or module
 * worker with a non-JavaScript MIME type, so the PDF.js worker
 * (`pdfjs-dist/build/pdf.worker.min.mjs`, emitted as an asset by
 * `new URL(..., import.meta.url)`) failed to load on the live site and every
 * PDF failed to open. Local dev and `vite preview` serve `.mjs` as JavaScript,
 * so nothing local showed it (morning review, bug 2).
 *
 * Fix: emit such assets with a `.js` extension. Guard: fail the build if any
 * `.mjs`/`.cjs` file is about to ship in the client bundle.
 */

import type { Plugin } from 'vite'

const MODULE_EXT = /\.(mjs|cjs)$/i

/** rolldown `output.assetFileNames`: same as Vite's default, but `.mjs`/`.cjs` become `.js`. */
export function assetFileNames(info: { names?: string[]; name?: string }): string {
  const name = info.names?.[0] ?? info.name ?? ''
  return MODULE_EXT.test(name) ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]'
}

/** File names in a client bundle that production would serve with the wrong MIME type. */
export function misservedScripts(fileNames: Iterable<string>): string[] {
  return [...fileNames].filter((f) => MODULE_EXT.test(f))
}

/** Fails the client build if a `.mjs`/`.cjs` file would ship. */
export function scriptAssetGuard(): Plugin {
  return {
    name: 'groundwork:script-asset-guard',
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle(_options, bundle) {
      const bad = misservedScripts(Object.keys(bundle))
      if (bad.length) {
        const message =
          `These files would be served as application/octet-stream in production and fail to load as scripts: ${bad.join(', ')}. ` +
          'Emit them with a .js extension (see asset-names.ts).'
        // Printed as well as raised: a later plugin's closeBundle (prerender)
        // can fail on the missing output and bury this message.
        console.error(`\n[script-asset-guard] ${message}\n`)
        this.error(message)
      }
    },
  }
}
