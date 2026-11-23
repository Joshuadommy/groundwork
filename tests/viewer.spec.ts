/**
 * Every ready document opens from the Documents list, one after another
 * without a reload, as PDF pages or styled Markdown/text, with no error
 * banner and no uncaught error.
 *
 * Uses whatever documents the local workspace has (uploading here would add
 * pages to the shared knowledge index); skips when there are none ready.
 * Owner-only: needs OWNER_USER_ID in .dev.vars set to GW Owner.
 * For the production-only MIME problem behind bug 2, see live-assets.spec.ts.
 */
import { test, expect } from 'deepspace/testing'
import { localOwnerIs } from './helpers/actions'

test('every ready document opens in the viewer', async ({ users }) => {
  test.skip(!localOwnerIs('GW Owner'), 'Needs OWNER_USER_ID in .dev.vars set to GW Owner')
  test.setTimeout(90_000)
  const [owner] = await users(['GW Owner'])
  const page = owner.page
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto('/documents')
  await expect(page.getByTestId('page-documents')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1000)
  const ready = page.locator('[data-testid=document-row][data-status=ready]')
  const count = await ready.count()
  test.skip(count === 0, 'No ready documents in the local workspace')

  const kinds = new Set<string>()
  for (let i = 0; i < count; i++) {
    const row = ready.nth(i)
    const meta = await row.locator('.sub').innerText()
    const isPdf = meta.startsWith('PDF')
    kinds.add(isPdf ? 'pdf' : 'text')
    await row.locator('a').first().click()
    await expect(page.getByTestId('page-viewer')).toBeVisible()
    if (isPdf) {
      await expect(page.getByTestId('pdf-page').locator('.react-pdf__Page__canvas')).toBeVisible({ timeout: 20_000 })
    } else {
      await expect(page.locator('.md-doc, .txt-doc')).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('.md-doc h1, .md-doc h2, .md-doc h3, .txt-doc').first()).toBeVisible()
    }
    await expect(page.getByTestId('viewer-error')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.locator('a.back').click()
    await expect(page.getByTestId('page-documents')).toBeVisible()
  }
  expect(pageErrors).toEqual([])
  console.log(`opened ${count} documents (${[...kinds].join(', ')})`)
})
