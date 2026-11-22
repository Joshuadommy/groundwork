import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Smoke tests covering both page kinds this template ships:
 *   - '/'      → the static landing (top level of src/pages/): no providers,
 *                so no auth fetch and no records WebSocket on load.
 *   - '/ask'   → a dynamic, sign-in-gated page (under src/pages/(app)/): signed
 *                out, it shows the sign-in screen and mounts no data layer.
 *
 * The "static contract" test is the guardrail for the per-page opt-out: if
 * someone moves the providers back up into _app.tsx, it fails.
 */

/** Wait for the React app shell (present on every page). */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('static landing loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('static-landing')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('landing carries one title, one description, one canonical', async ({ page }) => {
    // <Seo> (src/pages/index.tsx, values from src/seo.ts) hoists these into
    // <head>. Exactly one of each: index.html ships no static description or
    // canonical, because React 19 would not dedupe against them on mount.
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await expect(page).toHaveTitle(/\S/)
    expect(await page.locator('head meta[name="description"]').count()).toBe(1)
    expect(await page.locator('head link[rel="canonical"]').count()).toBe(1)
  })

  test('static contract: landing fires no auth request, opens no websocket', async ({ page }) => {
    const offenders: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/')) offenders.push(req.url())
    })
    // Only the DO room route counts — vite's own HMR socket is a dev artifact.
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname.startsWith('/ws/')) offenders.push(`ws: ${ws.url()}`)
    })
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(offenders).toEqual([])
  })

  test('signed-out visitors get the sign-in screen, not the app', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/ask')
    await expect(page.getByTestId('sign-in-screen')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('sign-in-google')).toBeVisible()
    await expect(page.getByTestId('sign-in-github')).toBeVisible()
    await expect(page.getByTestId('app-navigation')).toHaveCount(0)
    await expect(page.getByTestId('page-ask')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.getByTestId('not-found')).toContainText('404')
    await expect(page.getByRole('link', { name: 'Go to Ask' })).toBeVisible()
  })

  test('theme toggle switches and remembers a manual choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/ask')
    await expect(page.getByTestId('sign-in-screen')).toBeVisible({ timeout: 15000 })
    const html = page.locator('html')
    await expect(html).not.toHaveAttribute('data-theme', /.+/)
    await page.getByTestId('theme-toggle').click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.getByTestId('sign-in-screen')).toBeVisible({ timeout: 15000 })
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Switch to light mode')
  })
})
