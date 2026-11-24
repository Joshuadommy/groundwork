/**
 * Responsive tables and text wrapping on Evals, Documents and Team: below
 * about 640px the tables are stacked cards, and at no width from 320px up
 * does any text wrap one word per line.
 *
 * Owner-only: needs OWNER_USER_ID in .dev.vars set to GW Owner. Uses whatever
 * rows the local workspace has.
 */
import { test, expect } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { localOwnerIs } from './helpers/actions'

const WIDTHS = [320, 360, 390, 414, 480, 560, 640, 641, 700, 768, 900, 1024, 1280]
const PAGES = [
  { path: '/evals', id: 'page-evals', rows: 'eval-row' },
  { path: '/documents', id: 'page-documents', rows: 'document-row' },
  { path: '/team', id: 'page-team', rows: 'member-row' },
]

/** Text nodes of 3+ words that take as many lines as they have words. */
function oneWordPerLine(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const words = (node.textContent ?? '').trim().split(/\s+/).filter(Boolean)
      if (words.length < 3) continue
      const el = node.parentElement
      if (!el || el.closest('.sr-only, thead, [aria-hidden="true"], script, style, title')) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))
      if (lines.size >= words.length) bad.push(`${words.join(' ').slice(0, 60)} (${lines.size} lines)`)
    }
    return bad
  })
}

test('tables stack as cards on phones and no text wraps one word per line from 320px up', async ({ users }) => {
  test.skip(!localOwnerIs('GW Owner'), 'Needs OWNER_USER_ID in .dev.vars set to GW Owner')
  test.setTimeout(120_000)
  const [owner] = await users(['GW Owner'])
  const page = owner.page
  const problems: string[] = []
  for (const p of PAGES) {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(p.path)
    await expect(page.getByTestId(p.id)).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(1200)
    const hasRows = (await page.getByTestId(p.rows).count()) > 0
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(150)
      for (const b of await oneWordPerLine(page)) problems.push(`${p.path} @${width}px: ${b}`)
      // No horizontal scrolling of the page itself.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (overflow > 1) problems.push(`${p.path} @${width}px: page scrolls sideways by ${overflow}px`)
      if (hasRows) {
        const display = await page.getByTestId(p.rows).first().evaluate((el) => getComputedStyle(el).display)
        // Cards are grid (Documents, Team) or wrapping flex (Evals); wider, ordinary table rows.
        expect(display, `${p.path} @${width}px row display`).toBe(width <= 640 ? (p.path === '/evals' ? 'flex' : 'grid') : 'table-row')
        if (width <= 640) {
          // Card order: the first line is the name/question alone; badges and actions sit below it.
          const row = page.getByTestId(p.rows).first()
          const top = row.locator(p.path === '/evals' ? '.ev-question' : p.path === '/documents' ? '.dc-doc' : '.tm-who')
          const below = row.locator(p.path === '/evals' ? '.ev-status' : p.path === '/documents' ? '.dc-status' : '.tm-role')
          const [a, b] = [await top.boundingBox(), await below.boundingBox()]
          if (a && b && b.y < a.y + a.height - 1) problems.push(`${p.path} @${width}px: second line overlaps the first line`)
        }
      }
    }
  }
  expect(problems).toEqual([])
})
