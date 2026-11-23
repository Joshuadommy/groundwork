/**
 * UI states from design/prototype.html that need no model call and create no
 * data: favicon and page titles, the reconnecting pill, skeleton rows, the
 * Ask flow's immediate feedback and inline error, upload progress and the
 * drag-over dropzone. Server responses are held or replaced with Playwright
 * routes; the record socket is routed so it can be dropped or slowed.
 *
 * Owner-only: needs OWNER_USER_ID in .dev.vars set to GW Owner.
 */
import { test, expect } from 'deepspace/testing'
import type { BrowserContext, WebSocketRoute } from '@playwright/test'
import { localOwnerIs } from './helpers/actions'

/** A gate a held route waits on; open() lets the waiting request through and re-arms it. */
function gate() {
  let open: () => void = () => {}
  let wait = new Promise<void>((r) => (open = r))
  return {
    wait: () => wait,
    open() {
      open()
      wait = new Promise<void>((r) => (open = r))
    },
  }
}

/** Route the records socket through the test so its query results can be slowed. */
async function controlSocket(context: BrowserContext) {
  const state = { delayResults: 0 }
  await context.routeWebSocket(/\/ws\//, (ws: WebSocketRoute) => {
    const server = ws.connectToServer()
    ws.onMessage((m) => server.send(m))
    server.onMessage((m) => {
      const isResult = typeof m === 'string' && m.includes('"core.query_result"')
      if (isResult && state.delayResults) setTimeout(() => ws.send(m), state.delayResults)
      else ws.send(m)
    })
  })
  return { state }
}

test('favicon set and sign-in page title', async ({ page, request }) => {
  await page.goto('/ask')
  await expect(page.getByTestId('sign-in-screen')).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveTitle('Sign in · Groundwork')
  await expect(page.locator('link[rel=icon][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg')
  await expect(page.locator('link[rel=icon][sizes="32x32"][type="image/png"]')).toHaveAttribute('href', '/favicon-32.png')
  await expect(page.locator('link[rel=apple-touch-icon]')).toHaveAttribute('href', '/apple-touch-icon.png')
  await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#1E6B52')
  for (const path of ['/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/favicon.ico']) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
})

test.describe('owner UI states', () => {
  test.skip(!localOwnerIs('GW Owner'), 'Needs OWNER_USER_ID in .dev.vars set to GW Owner')

  test('per-route page titles', async ({ users }) => {
    const [owner] = await users(['GW Owner'])
    const page = owner.page
    await page.goto('/ask')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveTitle('Ask · Groundwork')
    for (const [link, title] of [
      ['Documents', 'Documents · Groundwork'],
      ['Evals', 'Evals · Groundwork'],
      ['Team', 'Team · Groundwork'],
    ]) {
      await page.getByTestId('app-navigation').getByRole('link', { name: link }).click()
      await expect(page).toHaveTitle(title)
    }
  })

  test('a dropped connection shows the reconnecting pill, keeps the app, and recovers', async ({ users }) => {
    test.setTimeout(60_000)
    const [owner] = await users(['GW Owner'])
    // A real outage: open sockets close and new ones fail without ever opening.
    // (A refused Playwright WebSocket route opens first, which is not what a
    // dead network does, so the browser's WebSocket is wrapped instead.)
    await owner.context.addInitScript(() => {
      const w = window as unknown as { __gwOffline: boolean; __gwSockets: WebSocket[] }
      const Native = window.WebSocket
      w.__gwOffline = false
      w.__gwSockets = []
      class TestSocket extends Native {
        constructor(url: string | URL, protocols?: string | string[]) {
          const record = String(url).includes('/ws/app:')
          super(record && w.__gwOffline ? 'ws://127.0.0.1:9/offline' : url, protocols)
          if (record) w.__gwSockets.push(this)
        }
      }
      window.WebSocket = TestSocket as typeof WebSocket
    })
    const page = owner.page
    await page.goto('/ask')
    await expect(page.getByTestId('page-ask')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('answer').first()).toBeVisible({ timeout: 10_000 }).catch(() => undefined)
    const answersBefore = await page.getByTestId('answer').count()

    await page.evaluate(() => {
      const w = window as unknown as { __gwOffline: boolean; __gwSockets: WebSocket[] }
      w.__gwOffline = true
      for (const ws of w.__gwSockets.splice(0)) ws.close()
    })
    await expect(page.getByTestId('reconnecting')).toHaveText(/Reconnecting… your work is safe/, { timeout: 10_000 })
    // The app stays as it was: no waiting screen, no loading screen, the thread keeps its answers.
    await page.waitForTimeout(1500)
    await expect(page.getByTestId('waiting-for-access')).toHaveCount(0)
    await expect(page.getByTestId('app-loading')).toHaveCount(0)
    await expect(page.getByTestId('page-ask')).toBeVisible()
    expect(await page.getByTestId('answer').count()).toBe(answersBefore)

    await page.evaluate(() => {
      ;(window as unknown as { __gwOffline: boolean }).__gwOffline = false
    })
    await expect(page.getByTestId('reconnecting')).toHaveCount(0, { timeout: 40_000 })
    await expect(page.getByText('Reconnected')).toBeVisible()
  })

  test('lists show skeleton rows while their records load', async ({ users }) => {
    const [owner] = await users(['GW Owner'])
    const socket = await controlSocket(owner.context)
    const page = owner.page
    await page.goto('/ask')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 20_000 })

    // Evals subscribes to its collections on arrival; hold their results.
    socket.state.delayResults = 2000
    await page.getByTestId('app-navigation').getByRole('link', { name: 'Evals' }).click()
    await expect(page.getByTestId('skeleton-row').first()).toBeVisible()
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0, { timeout: 10_000 })
  })

  test('asking clears the box, shows the question with live steps at once, and shows a failure inline', async ({ users }) => {
    const [owner] = await users(['GW Owner'])
    const page = owner.page
    await page.goto('/ask')
    await expect(page.getByTestId('page-ask')).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(1000)
    test.skip(await page.getByTestId('ask-empty-no-docs').isVisible(), 'No ready documents locally')

    // Hold the action, then fail it: no model call, nothing saved.
    let calls = 0
    const held = gate()
    await page.route('**/api/actions/askQuestion', async (route) => {
      calls++
      await held.wait()
      await route.fulfill({ json: { success: false, error: "The AI service didn't respond. Nothing was saved as an answer." } })
    })

    const question = `Mocked question ${Date.now()}?`
    await page.locator('#qInput').fill(question)
    await page.keyboard.press('Enter')

    await expect(page.locator('#qInput')).toHaveValue('')
    const pending = page.getByTestId('answer-pending').filter({ hasText: question })
    await expect(pending).toBeVisible()
    await expect(pending).toContainText('Asked by you, just now')
    await expect(pending.getByTestId('step-0')).toHaveClass(/active/)
    await expect(pending.getByTestId('step-0')).toContainText(/Searching \d+ documents?/)
    await expect(pending.getByTestId('step-1')).toContainText('Reading the most relevant passages')
    await expect(pending.getByTestId('step-2')).toContainText('Checking every citation against the sources')
    await expect(pending.locator('.skel')).toHaveCount(3)
    const send = page.getByTestId('send')
    await expect(send).toHaveAttribute('aria-label', 'Answering your question')
    await expect(send.locator('.spin')).toBeVisible()
    await expect(send).toBeDisabled()

    await expect.poll(() => calls).toBe(1)
    held.open()
    const failed = page.getByTestId('ask-error').filter({ hasText: question })
    await expect(failed).toContainText("Couldn't answer this question")
    await expect(failed).toContainText('Nothing was saved as an answer.')
    await expect(pending).toHaveCount(0)
    await expect(send).toHaveAttribute('aria-label', 'Send question')

    await failed.getByTestId('ask-retry').click()
    await expect(page.getByTestId('answer-pending').filter({ hasText: question })).toBeVisible()
    await expect.poll(() => calls).toBe(2)
    held.open()
    await expect(page.getByTestId('ask-error').filter({ hasText: question })).toBeVisible()
  })

  test('upload shows real progress, and the dropzone reacts to a dragged file', async ({ users }) => {
    const [owner] = await users(['GW Owner'])
    const page = owner.page
    await page.goto('/documents')
    await expect(page.getByTestId('page-documents')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('open-upload').click()

    const zone = page.getByTestId('dropzone')
    const dt = await page.evaluateHandle(() => new DataTransfer())
    await zone.dispatchEvent('dragenter', { dataTransfer: dt })
    await expect(zone).toHaveClass(/\bdrag\b/)
    await zone.dispatchEvent('dragleave', { dataTransfer: dt })
    await expect(zone).not.toHaveClass(/\bdrag\b/)

    // A real upload, throttled so progress is visible, of a file with a .pdf
    // name that isn't a PDF: the browser sends every byte (real progress
    // events) and the server refuses it after reading it, so nothing is stored.
    const cdp = await owner.context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 400 * 1024 })
    const seen = new Set<number>()
    await page.exposeFunction('__gwProgress', (v: number) => seen.add(v))
    await page.evaluate(() => {
      new MutationObserver(() => {
        const v = document.querySelector('[data-testid=upload-progress]')?.getAttribute('aria-valuenow')
        if (v) (window as unknown as { __gwProgress: (n: number) => void }).__gwProgress(Number(v))
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-valuenow'] })
    })
    await page.getByTestId('upload-input').setInputFiles({
      name: 'progress-check.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1536 * 1024, 'a'),
    })
    await page.getByTestId('upload-submit').click()
    const bar = page.getByTestId('upload-progress')
    await expect(bar).toBeVisible()
    await expect(page.getByTestId('upload-submit')).toContainText('Uploading')
    await expect(page.getByTestId('upload-dialog').getByRole('alert')).toContainText('not a PDF', { timeout: 30_000 })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    // The bar moved through intermediate values from the browser's progress events.
    expect([...seen].some((v) => v > 0 && v < 100), `progress values seen: ${[...seen].join(', ')}`).toBe(true)
    await expect(bar).toHaveCount(0)
  })

  test('Evals: an Owner adds a question directly; adding it again does not duplicate it', async ({ users }) => {
    const [owner] = await users(['GW Owner'])
    const page = owner.page
    await page.goto('/evals')
    await expect(page.getByTestId('page-evals')).toBeVisible({ timeout: 20_000 })
    const form = page.getByTestId('add-eval-case')
    await form.getByRole('button', { name: 'Add question' }).click()
    await expect(form.getByRole('alert')).toHaveText('Enter a question.')

    const question = `UI test eval question ${Date.now()}?`
    await page.getByLabel('Add a question').fill(question)
    await form.getByRole('button', { name: 'Add question' }).click()
    const row = page.getByTestId('eval-row').filter({ hasText: question })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toContainText('Added by GW Owner')
    await expect(row).toContainText('Not run yet')
    await expect(page.getByLabel('Add a question')).toHaveValue('')

    await page.getByLabel('Add a question').fill(`  ${question.toUpperCase()} `)
    await form.getByRole('button', { name: 'Add question' }).click()
    await expect(page.getByText('That question is already an eval case')).toBeVisible()
    await expect(page.getByTestId('eval-row').filter({ hasText: question })).toHaveCount(1)
  })
})
