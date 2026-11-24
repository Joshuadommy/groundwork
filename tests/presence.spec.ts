/**
 * Presence in the top bar (SDK usePresence): approved teammates see each
 * other online; a person waiting for access never appears and sees nobody.
 *
 * GW Owner approves GW Editor as a Viewer for the test and removes them again
 * afterwards (as collab.spec.ts does). GW Viewer stays waiting throughout.
 * Owner-only: needs OWNER_USER_ID in .dev.vars set to GW Owner.
 */
import { test, expect, findTestAccountByName } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { localOwnerIs } from './helpers/actions'

const avatar = (page: Page, userId: string) => page.locator(`[data-testid=presence-avatar][data-user-id="${userId}"]`)

test('two approved teammates see each other online; a waiting user never appears or sees anyone', async ({ users }) => {
  test.skip(!localOwnerIs('GW Owner'), 'Needs OWNER_USER_ID in .dev.vars set to GW Owner')
  test.setTimeout(150_000)
  const [owner, teammate, waiting] = await users(['GW Owner', 'GW Editor', 'GW Viewer'])
  const ownerId = findTestAccountByName('GW Owner').userId!
  const teammateId = findTestAccountByName('GW Editor').userId!
  const waitingId = findTestAccountByName('GW Viewer').userId!

  // Every roster the server sends the waiting user's browser.
  const waitingRosters: number[] = []
  waiting.page.on('websocket', (ws) =>
    ws.on('framereceived', (f) => {
      try {
        const m = JSON.parse(String(f.payload))
        if (m.type === 'user.list') waitingRosters.push(m.payload.users.length)
      } catch {
        /* binary frames */
      }
    }),
  )
  await waiting.page.goto('/ask')
  await expect(waiting.page.getByTestId('waiting-for-access')).toBeVisible({ timeout: 20_000 })

  await owner.page.goto('/team')
  const waitingRow = owner.page.locator(`[data-testid=waiting-row][data-email="${teammate.email}"]`)
  await expect(waitingRow).toBeVisible({ timeout: 20_000 })
  await waitingRow.getByRole('button', { name: 'Approve as Viewer' }).click()
  try {
    await teammate.page.goto('/ask')
    await expect(teammate.page.getByTestId('page-ask')).toBeVisible({ timeout: 20_000 })

    // Each sees the other (the owner's roster refreshes within 20 s of the teammate arriving).
    await expect(avatar(owner.page, teammateId)).toBeVisible({ timeout: 45_000 })
    await expect(avatar(teammate.page, ownerId)).toBeVisible({ timeout: 45_000 })
    await expect(owner.page.getByTestId('presence-count')).toHaveText('2 online')
    await expect(teammate.page.getByTestId('presence-count')).toHaveText('2 online')

    // The waiting user is connected (online by heartbeat) but never listed.
    await expect(avatar(owner.page, waitingId)).toHaveCount(0)
    await expect(avatar(teammate.page, waitingId)).toHaveCount(0)

    // Names on hover and on keyboard focus.
    const a = avatar(owner.page, teammateId)
    await expect(a).toHaveAttribute('aria-label', /GW Editor/)
    await a.hover()
    await expect(a.locator('.presence-tip')).toHaveCSS('opacity', '1')
    await expect(a.locator('.presence-tip')).toHaveText('GW Editor')
    await owner.page.mouse.move(0, 0)
    await a.focus()
    await expect(a.locator('.presence-tip')).toHaveCSS('opacity', '1')

    // The waiting user sees nobody: no presence on their screen, and the server sent them only empty rosters.
    await expect(waiting.page.getByTestId('presence')).toHaveCount(0)
    expect(waitingRosters.length).toBeGreaterThan(0)
    expect(waitingRosters.every((n) => n === 0)).toBe(true)
  } finally {
    await owner.page.goto('/team')
    const member = owner.page.locator(`[data-testid=member-row][data-email="${teammate.email}"]`)
    await expect(member.or(waitingRow)).toBeVisible({ timeout: 15_000 })
    if (await member.count()) {
      await member.getByRole('button', { name: /^Remove / }).click()
      await owner.page.getByTestId('confirm-dialog').getByRole('button', { name: 'Remove member' }).click()
      await expect(waitingRow).toBeVisible({ timeout: 15_000 })
    }
  }
})
