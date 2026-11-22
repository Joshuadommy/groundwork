/**
 * Capture every screen at desktop and phone width, light and dark, into
 * docs/screenshots/. Runs against a local dev server with test accounts:
 *
 *   npx vite --port 5179 --strictPort --host 127.0.0.1 &
 *   npx tsx scripts/screenshots.mts http://127.0.0.1:5179 [screen ...]
 *
 * Needs: OWNER_USER_ID in .dev.vars set to the "GW Owner" test account, a
 * set-up workspace with indexed documents and at least one verified answer,
 * and "GW Viewer" waiting for access. The welcome screen only exists before
 * setup, so it is captured with SCREENS=welcome against a fresh local state.
 */

import { mkdirSync } from 'node:fs'
import { chromium, type Page } from '@playwright/test'
import { chromiumLaunchOptions, ensureStorageState, findTestAccountByName, getStatePathForEmail } from 'deepspace/testing'

const baseURL = process.argv[2] ?? 'http://127.0.0.1:5179'
const only = new Set(process.argv.slice(3))
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

type Who = 'owner' | 'waiting' | 'signed-out'
interface Screen {
  name: string
  who: Who
  path: string | ((page: Page) => Promise<string>)
  before?: (page: Page) => Promise<void>
}

/** The viewer URL a citation's "Open page" link points to. */
async function citedPageUrl(page: Page): Promise<string> {
  await page.goto('/ask')
  const card = page.locator('[data-testid=answer][data-status=verified]').filter({ has: page.locator('.cite') }).last()
  await card.waitFor({ timeout: 15000 })
  await card.locator('.cite').first().click()
  return (await page.getByTestId('open-page').getAttribute('href')) ?? '/documents'
}

async function markdownUrl(page: Page): Promise<string> {
  await page.goto('/documents')
  const link = page.locator('[data-testid=document-row]').filter({ hasText: 'Markdown' }).locator('a').first()
  await link.waitFor({ timeout: 15000 })
  return (await link.getAttribute('href')) ?? '/documents'
}

const SCREENS: Screen[] = [
  { name: 'sign-in', who: 'signed-out', path: '/ask' },
  { name: 'waiting-for-access', who: 'waiting', path: '/ask' },
  { name: 'welcome', who: 'owner', path: '/ask' },
  { name: 'ask', who: 'owner', path: '/ask' },
  {
    name: 'ask-source-panel',
    who: 'owner',
    path: '/ask',
    before: async (page) => {
      const card = page.locator('[data-testid=answer]').filter({ has: page.getByTestId('coverage-note') }).first()
      const target = (await card.count()) ? card : page.locator('[data-testid=answer][data-status=verified]').first()
      await target.locator('.cite').first().click()
      await page.getByTestId('source-panel').waitFor()
      await target.scrollIntoViewIfNeeded()
    },
  },
  { name: 'documents', who: 'owner', path: '/documents' },
  {
    name: 'upload-dialog',
    who: 'owner',
    path: '/documents',
    before: async (page) => {
      await page.getByTestId('open-upload').click()
      await page.getByTestId('upload-input').setInputFiles('public/samples/remote-work-policy.pdf')
    },
  },
  { name: 'viewer-pdf-highlight', who: 'owner', path: citedPageUrl },
  { name: 'viewer-markdown', who: 'owner', path: markdownUrl },
  { name: 'evals', who: 'owner', path: '/evals' },
  { name: 'team', who: 'owner', path: '/team' },
  { name: 'not-found', who: 'signed-out', path: '/this-page-does-not-exist' },
]

const VARIANTS = [
  { suffix: 'desktop-light', width: 1360, height: 900, scheme: 'light' as const },
  { suffix: 'desktop-dark', width: 1360, height: 900, scheme: 'dark' as const },
  { suffix: 'phone-light', width: 390, height: 844, scheme: 'light' as const },
  { suffix: 'phone-dark', width: 390, height: 844, scheme: 'dark' as const },
]

const browser = await chromium.launch(chromiumLaunchOptions())
const states: Partial<Record<Who, string>> = {}
for (const [who, name] of [['owner', 'GW Owner'], ['waiting', 'GW Viewer']] as const) {
  const acct = findTestAccountByName(name)
  await ensureStorageState(browser, acct, baseURL)
  states[who] = getStatePathForEmail(acct.email, baseURL)
}

const selected = SCREENS.filter((s) => (only.size ? only.has(s.name) : s.name !== 'welcome'))
for (const screen of selected) {
  for (const v of VARIANTS) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: v.width < 600 ? 2 : 1,
      colorScheme: v.scheme,
      storageState: screen.who === 'signed-out' ? undefined : states[screen.who],
    })
    const page = await context.newPage()
    const path = typeof screen.path === 'string' ? screen.path : await screen.path(page)
    await page.goto(path)
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(2500)
    if (screen.before) await screen.before(page)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${screen.name}-${v.suffix}.png` })
    console.log(`saved ${screen.name}-${v.suffix}`)
    await context.close()
  }
}
await browser.close()
