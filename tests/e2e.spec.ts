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

  const question = `How many days a week can I work remotely? (e2e ${Date.now()})`
  await page.locator('#qInput').fill(question)
  await page.keyboard.press('Enter')

  const card = page.locator('article', { has: page.getByRole('heading', { name: question }) })
  await expect(card).toHaveAttribute('data-status', /verified|partial/, { timeout: 90_000 })
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
