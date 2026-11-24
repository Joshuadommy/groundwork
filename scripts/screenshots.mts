/**
 * Capture every screen at desktop and phone width, light and dark, into
 * docs/screenshots/. Runs against a local dev server with test accounts:
 *
 *   npx vite --port 5179 --strictPort --host 127.0.0.1 &
 *   npx tsx scripts/screenshots.mts http://127.0.0.1:5179 [screen ...]
 *
 * Needs: OWNER_USER_ID in .dev.vars set to the "GW Owner" test account, a
 * set-up workspace with indexed documents and at least one verified answer,
 * and "GW Viewer" and "GW Editor" waiting for access. The welcome screen only
 * exists before setup, so it is captured with `welcome` against a fresh local
 * state.
 *
 * Transient states are produced without creating data or calling the model:
 * held or refused routes (Ask steps and error, upload progress, loading
 * screen), slowed socket results (skeleton rows), a wrapped WebSocket
 * (reconnecting). The Team screens approve GW Viewer, capture, then remove
 * them again, as tests/collab.spec.ts does.
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
  /** Runs before navigation (routes, init scripts). */
  prepare?: (page: Page) => Promise<void>
  before?: (page: Page) => Promise<void>
}

const never = () => new Promise<void>(() => undefined)

async function askMocked(page: Page, outcome: 'hold' | 'fail') {
  await page.route('**/api/actions/askQuestion', async (route) => {
    if (outcome === 'hold') return never()
    await route.fulfill({ json: { success: false, error: "The AI service didn't respond. Nothing was saved as an answer." } })
  })
}

async function typeQuestion(page: Page, q: string) {
  await page.locator('#qInput').fill(q)
  await page.keyboard.press('Enter')
}

const OFFLINE_SCRIPT = `
  window.__gwOffline = false; window.__gwSockets = [];
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(url, p) {
      const record = String(url).includes('/ws/app:');
      super(record && window.__gwOffline ? 'ws://127.0.0.1:9/offline' : url, p);
      if (record) window.__gwSockets.push(this);
    }
  };`

/** The viewer URL a citation's "Open page" link points to. */
async function citedPageUrl(page: Page): Promise<string> {
  await page.goto('/ask')
  // The newest verified answer: it cites documents that still exist.
  const card = page.locator('[data-testid=answer][data-status=verified]').filter({ has: page.locator('.cite') }).first()
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
      const target = page.locator('[data-testid=answer][data-status=verified]').filter({ has: page.locator('.cite') }).first()
      await target.locator('.cite').first().click()
      await page.getByTestId('source-panel').waitFor()
      await target.scrollIntoViewIfNeeded()
    },
  },
  {
    name: 'ask-pending',
    who: 'owner',
    path: '/ask',
    prepare: (page) => askMocked(page, 'hold'),
    before: async (page) => {
      await typeQuestion(page, 'What is the home office stipend, and will Northwind pay for a standing desk?')
      await page.getByTestId('answer-pending').first().waitFor()
    },
  },
  {
    name: 'ask-error',
    who: 'owner',
    path: '/ask',
    prepare: (page) => askMocked(page, 'fail'),
    before: async (page) => {
      await typeQuestion(page, 'What is the travel per diem for client visits?')
      await page.getByTestId('ask-error').first().waitFor()
      await page.waitForTimeout(500)
    },
  },
  {
    name: 'reconnecting',
    who: 'owner',
    path: '/ask',
    prepare: (page) => page.context().addInitScript({ content: OFFLINE_SCRIPT }),
    before: async (page) => {
      await page.evaluate(() => {
        const w = window as unknown as { __gwOffline: boolean; __gwSockets: WebSocket[] }
        w.__gwOffline = true
        for (const ws of w.__gwSockets.splice(0)) ws.close()
      })
      await page.getByTestId('reconnecting').waitFor({ timeout: 10000 })
    },
  },
  {
    name: 'loading',
    who: 'owner',
    path: '/ask',
    // The session check never answers, so the loading screen stays.
    prepare: (page) => page.route('**/api/auth/get-session*', () => never()),
  },
  {
    name: 'documents-loading',
    who: 'owner',
    path: '/documents',
    // The documents subscription's results are held back: the list shows skeleton rows.
    prepare: (page) =>
      page.context().routeWebSocket(/\/ws\//, (ws) => {
        const server = ws.connectToServer()
        const held = new Set<string>()
        ws.onMessage((m) => {
          if (typeof m === 'string' && m.includes('"core.subscribe"') && m.includes('"collection":"documents"')) {
            held.add(JSON.parse(m).payload.subscriptionId)
          }
          server.send(m)
        })
        server.onMessage((m) => {
          if (typeof m === 'string' && m.includes('"core.query_result"') && held.has(JSON.parse(m).payload?.subscriptionId)) return
          ws.send(m)
        })
      }),
    before: async (page) => {
      await page.getByTestId('skeleton-row').first().waitFor()
    },
  },
  {
    name: 'upload-dialog',
    who: 'owner',
    path: '/documents',
    before: async (page) => {
      await page.getByTestId('open-upload').click()
      await page.getByTestId('upload-input').setInputFiles('public/samples/remote-work-policy.pdf')
    },
  },
  {
    name: 'upload-dragover',
    who: 'owner',
    path: '/documents',
    before: async (page) => {
      await page.getByTestId('open-upload').click()
      const dt = await page.evaluateHandle(() => new DataTransfer())
      await page.getByTestId('dropzone').dispatchEvent('dragenter', { dataTransfer: dt })
    },
  },
  {
    name: 'upload-progress',
    who: 'owner',
    path: '/documents',
    // A real, throttled upload of a file named .pdf that isn't one: real
    // progress events, and the server refuses it afterwards (nothing stored).
    prepare: async (page) => {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 200 * 1024 })
    },
    before: async (page) => {
      await page.getByTestId('open-upload').click()
      await page.getByTestId('upload-input').setInputFiles({
        name: 'Intern Program Guide.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(3 * 1024 * 1024, 'a'),
      })
      await page.getByTestId('upload-submit').click()
      await page.waitForFunction(() => {
        const v = Number(document.querySelector('[data-testid=upload-progress]')?.getAttribute('aria-valuenow'))
        return v >= 35 && v <= 75
      }, undefined, { timeout: 30000 })
    },
  },
  { name: 'viewer-pdf-highlight', who: 'owner', path: citedPageUrl },
  { name: 'viewer-markdown', who: 'owner', path: markdownUrl },
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

/**
 * Screens with a second teammate: GW Viewer is approved and kept signed in on
 * /ask while these are captured (so presence shows two people online and Team
 * has a member with a role picker), then removed again.
 */
const TEAM_SCREENS: Screen[] = [
  { name: 'documents', who: 'owner', path: '/documents' },
  { name: 'evals', who: 'owner', path: '/evals' },
  { name: 'team', who: 'owner', path: '/team' },
  {
    name: 'team-role-dropdown',
    who: 'owner',
    path: '/team',
    before: async (page) => {
      await page.getByRole('button', { name: /^Role for / }).first().click()
      await page.getByRole('listbox').waitFor()
    },
  },
]

const selected = SCREENS.filter((s) => (only.size ? only.has(s.name) : s.name !== 'welcome'))
await capture(selected)
const team = TEAM_SCREENS.filter((s) => !only.size || only.has(s.name))
if (team.length) {
  const viewer = findTestAccountByName('GW Viewer')
  await setMember(viewer.email, 'approve')
  const viewerState = getStatePathForEmail(viewer.email, baseURL)
  await ensureStorageState(browser, viewer, baseURL)
  const online = await browser.newContext({ baseURL, storageState: viewerState })
  try {
    const p = await online.newPage()
    await p.goto('/ask')
    await p.getByTestId('page-ask').waitFor({ timeout: 20000 })
    await capture(team)
  } finally {
    await online.close()
    await setMember(viewer.email, 'remove')
  }
}
await browser.close()

async function setMember(email: string, action: 'approve' | 'remove') {
  const context = await browser.newContext({ baseURL, storageState: states.owner })
  const page = await context.newPage()
  await page.goto('/team')
  if (action === 'approve') {
    const row = page.locator(`[data-testid=waiting-row][data-email="${email}"]`)
    await row.waitFor({ timeout: 15000 })
    await row.getByRole('button', { name: 'Approve as Viewer' }).click()
    await page.locator(`[data-testid=member-row][data-email="${email}"]`).waitFor({ timeout: 15000 })
  } else {
    const row = page.locator(`[data-testid=member-row][data-email="${email}"]`)
    await row.or(page.locator(`[data-testid=waiting-row][data-email="${email}"]`)).first().waitFor({ timeout: 15000 })
    if (await row.count()) {
      await row.getByRole('button', { name: /^Remove / }).click()
      await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Remove member' }).click()
      await page.locator(`[data-testid=waiting-row][data-email="${email}"]`).waitFor({ timeout: 15000 })
    }
  }
  await context.close()
}

async function capture(screens: Screen[]) {
for (const screen of screens) {
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
    if (screen.prepare) await screen.prepare(page)
    await page.goto(path)
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
    await page.waitForTimeout(2500)
    if (screen.before) await screen.before(page)
    if (screen.name !== 'upload-progress') await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${screen.name}-${v.suffix}.png` })
    console.log(`saved ${screen.name}-${v.suffix}`)
    await context.close()
  }
}
}
