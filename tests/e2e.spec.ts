/**
 * End-to-end: the core flow in a real browser, against the local app.
 * Owner asks a question → verified answer with citations → source panel →
 * "Open page N" → the viewer opens that page with the quoted passage
 * highlighted.
 *
 * Makes one real, owner-billed model call and needs the sample documents
 * indexed locally, so it runs only with GW_LIVE_AI=1:
 *   GW_LIVE_AI=1 npx playwright test -c tests/playwright.config.ts tests/e2e.spec.ts
 */
import { test, expect } from 'deepspace/testing'
import { localOwnerIs } from './helpers/actions'

test('ask, verify, open the cited page with the passage highlighted', async ({ users }) => {
  test.skip(!localOwnerIs('GW Owner'), 'Needs OWNER_USER_ID in .dev.vars set to GW Owner')
  test.skip(process.env.GW_LIVE_AI !== '1', 'Makes a live AI call; set GW_LIVE_AI=1 to run it')
  test.setTimeout(120_000)
  const [owner] = await users(['GW Owner'])
  const page = owner.page

  await page.goto('/ask')
  await expect(page.getByTestId('page-ask')).toBeVisible({ timeout: 15_000 })
  test.skip(await page.getByTestId('ask-empty-no-docs').isVisible(), 'No ready documents locally')

  // Record every stage the pending card shows, from the server's real progress.
  await page.evaluate(() => {
    const w = window as unknown as { __stages: string[] }
    w.__stages = []
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[data-testid=answer-pending]')) {
        const s = el.getAttribute('data-stage') ?? ''
        if (w.__stages[w.__stages.length - 1] !== s) w.__stages.push(s)
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-stage'] })
  })

  const question = `How many days a week can I work remotely? (e2e ${Date.now()})`
  await page.locator('#qInput').fill(question)
  await page.keyboard.press('Enter')

  // At once: the box is empty, the question is in the thread with live steps, the send button spins.
  await expect(page.locator('#qInput')).toHaveValue('')
  await expect(page.getByTestId('answer-pending').filter({ hasText: question })).toBeVisible()
  await expect(page.getByTestId('send')).toHaveAttribute('aria-label', 'Answering your question')

  const card = page.locator('article', { has: page.getByRole('heading', { name: question }) })
  await expect(card).toHaveAttribute('data-status', /verified|partial/, { timeout: 90_000 })
  await expect(card).toHaveClass(/reveal/)
  // The steps followed the server: searching, then reading (and checking, if a render caught it).
  const stages = await page.evaluate(() => (window as unknown as { __stages: string[] }).__stages)
  expect(stages[0]).toBe('searching')
  expect(stages).toContain('reading')
  await expect(card.getByTestId('answer-text')).toContainText(/three days/i)

  await card.locator('.cite').first().click()
  const panel = page.getByTestId('source-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Remote Work Policy'.slice(0, 6), { ignoreCase: true })

  await panel.getByTestId('open-page').click()
  await expect(page).toHaveURL(/\/documents\/[^/]+\/2\?answer=.+&cite=S\d+/)
  await expect(page.getByTestId('page-viewer')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('page-input')).toHaveValue('2')
  await expect(page.getByTestId('cited-tag')).toHaveText(/highlighted/, { timeout: 20_000 })

  // Arrow keys move between pages.
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('page-input')).toHaveValue('3')
})
