/**
 * Post-deploy check against the real site: every script the app loads by URL
 * must come back with a JavaScript Content-Type.
 *
 * Why: DeepSpace production serves `.mjs` as application/octet-stream, so the
 * PDF.js worker (once emitted as pdf.worker.min-*.mjs) was refused by the
 * browser and no PDF opened on the live site, while local dev and preview
 * served it fine (morning review, bug 2). Only the deployed site can show it.
 *
 *   GW_LIVE_URL=https://groundwork.app.space npx playwright test -c tests/playwright.config.ts live-assets
 *
 * Read-only and unauthenticated: static assets are public.
 */
import { test, expect } from '@playwright/test'

const LIVE = process.env.GW_LIVE_URL

test('deployed scripts, including the PDF.js worker, are served as JavaScript', async ({ request }) => {
  test.skip(!LIVE, 'Set GW_LIVE_URL to the deployed origin to run this check')
  const origin = new URL(LIVE!).origin

  const html = await (await request.get(`${origin}/ask`)).text()
  const queue = [...html.matchAll(/\/assets\/[\w.-]+\.(?:m?js|cjs)/g)].map((m) => m[0])
  const seen = new Set<string>()
  const contentTypes: Record<string, string> = {}

  // Follow chunk references (lazy routes, the PDF viewer, its worker).
  while (queue.length) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    const res = await request.get(`${origin}${path}`)
    expect(res.status(), path).toBe(200)
    contentTypes[path] = res.headers()['content-type'] ?? ''
    if (path.includes('pdf.worker')) continue // 1 MB of minified worker, no chunk refs
    const body = await res.text()
    for (const m of body.matchAll(/assets\/[\w.-]+\.(?:m?js|cjs)/g)) queue.push(`/${m[0]}`)
  }

  const worker = Object.keys(contentTypes).filter((p) => p.includes('pdf.worker'))
  expect(worker.length, 'the PDF viewer references its worker').toBeGreaterThan(0)
  const wrong = Object.entries(contentTypes).filter(([, type]) => !/javascript/i.test(type))
  expect(wrong, 'scripts served with a non-JavaScript Content-Type').toEqual([])
})
