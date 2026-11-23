/**
 * Build-output rules for scripts the browser loads by URL.
 *
 * DeepSpace's production asset serving answered the PDF.js worker, copied as
 * `pdf.worker.min-*.mjs`, with `Content-Type: application/octet-stream`.
 * Browsers refuse to run a module worker with a non-JavaScript MIME type, so
 * no PDF opened on the live site. Local dev and `vite preview` serve `.mjs` as
 * JavaScript, so nothing local showed it (morning review, bug 2).
 *
 * Renaming the copied file to `.js` was not enough: live kept serving the same
 * bytes as octet-stream (deploy stores assets by content hash, and unchanged
 * bytes appear to keep the type they were first stored with). The fix is in
 * src/components/viewer/pdf-worker.ts: the worker is bundled as app code.
 *
 * What stays here is the guard: emit any `.mjs`/`.cjs` asset as `.js`, and
 * fail the build if one would ship anyway.
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
