/**
 * The access gate must never show "waiting for access" to someone whose role
 * the server has not confirmed as `viewer`.
 *
 * Two ways it used to (morning review, bug 1):
 *  - On refresh, useUser() reports role "viewer" from the moment the profile
 *    loads until the records socket's USER_INFO arrives, so an Owner saw the
 *    waiting screen flash before the app.
 *  - While in use, the SDK re-reads the profile every 30 s. If that read can't
 *    get a token (a failed /api/auth/token refresh, a network blip), the
 *    profile becomes null and the gate fell back to the waiting screen.
 *
 * Both tests watch the DOM from the first paint with a MutationObserver, so a
 * flash of a few milliseconds is caught.
 *
 * Owner-only: needs OWNER_USER_ID in .dev.vars set to GW Owner (see PLAN.md § Testing).
 */
import { test, expect } from 'deepspace/testing'
import type { BrowserContext, Page } from '@playwright/test'
import { localOwnerIs } from './helpers/actions'

/** Record which gate screens appear, in order, from the first paint. */
async function watchGateScreens(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __gate: string[] }
    w.__gate = []
    const seen = (name: string) => {
      if (w.__gate[w.__gate.length - 1] !== name) w.__gate.push(name)
    }
    const check = () => {
      if (document.querySelector('[data-testid="waiting-for-access"]')) seen('waiting')
      if (document.querySelector('[data-testid="app-loading"]')) seen('loading')
      if (document.querySelector('[data-testid="app-navigation"]')) seen('app')
    }
    new MutationObserver(check).observe(document, { childList: true, subtree: true })
  })
}

const gateScreens = (page: Page) => page.evaluate(() => (window as unknown as { __gate: string[] }).__gate)

test.describe('access gate', () => {
  test.skip(!localOwnerIs('GW Owner'), 'Needs OWNER_USER_ID in .dev.vars set to GW Owner')

  test('an Owner refreshing sees a loading screen, never the waiting screen', async ({ users }) => {
    const [owner] = await users(['GW Owner'])
    await watchGateScreens(owner.context)

    for (let i = 0; i < 3; i++) {
      if (i === 0) await owner.page.goto('/ask')
      else await owner.page.reload()
      await expect(owner.page.getByTestId('app-navigation')).toBeVisible({ timeout: 20_000 })
      const screens = await gateScreens(owner.page)
      expect(screens, `load ${i + 1}`).not.toContain('waiting')
      expect(screens[0], `load ${i + 1} starts on the loading screen`).toBe('loading')
      expect(screens[screens.length - 1]).toBe('app')
    }
  })

  test('a failed token refresh while in use keeps the confirmed role', async ({ users }) => {
    const [owner] = await users(['GW Owner'])
    const page = owner.page
    await watchGateScreens(owner.context)
    await page.clock.install()
    await page.goto('/ask')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 20_000 })

    // The token endpoint fails (expired session refresh, network blip), and
    // time passes: the cached token expires, the 30 s profile poll asks for a
    // new one, gets none, and the socket's reconnects can't authenticate.
    await owner.context.route('**/api/auth/token', (route) => route.fulfill({ status: 503, body: 'unavailable' }))
    await page.clock.fastForward('01:00:00')
    await page.waitForTimeout(1500)
    await page.clock.fastForward('00:01:00')
    await page.waitForTimeout(1500)

    expect(await gateScreens(page)).not.toContain('waiting')
    await expect(page.getByTestId('app-navigation')).toBeVisible()

    // The token comes back: the app is still there and still the Owner's.
    await owner.context.unroute('**/api/auth/token')
    await page.clock.fastForward('00:01:00')
    await page.waitForTimeout(1500)
    expect(await gateScreens(page)).not.toContain('waiting')
    await expect(page.getByRole('link', { name: 'Team' })).toBeVisible()
  })
})
