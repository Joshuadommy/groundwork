/**
 * Multi-user collaboration spec — verifies two users sign in into
 * separate browser contexts and the app distinguishes them.
 *
 * `users(2)` takes any two accounts from your pool, so this spec passes on a
 * fresh app with no setup beyond having two test accounts:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Ask for accounts *by name* (`users(['Alice', 'Bob'])`) only when the
 * behaviour under test depends on which identity acts — otherwise naming them
 * couples the spec to one machine's pool.
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { callAction, localOwnerIs, tokenFor } from './helpers/actions'

// A machine that has never created test accounts is the normal state of a
// fresh checkout, and there `users()` throws — turning "you have no pool yet"
// into three red tests about the app, which it is not. Skip the file instead
// and say what creates the pool. The count is of accounts usable HERE: the
// pool is global per developer, but passwords live only on the machine that
// created the account.
const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

test('people without access (viewer) wait and receive no records', async ({ users }) => {
  // Named, not users(2): the pool's first accounts include GW Owner, which is
  // the app owner in local runs (OWNER_USER_ID in .dev.vars) and so is admin.
  const [a, b] = await users(['GW Editor', 'GW Viewer'])

  // These accounts are not the app owner and have not been approved, so they
  // start as `viewer` (no access).
  // /ask is gated; each browser must show the waiting screen for ITS account.
  await Promise.all([a.page.goto('/ask'), b.page.goto('/ask')])

  for (const user of [a, b]) {
    await expect(user.page.getByTestId('waiting-for-access')).toBeVisible({ timeout: 15_000 })
    // Email, not name: the email is the credential the context signed in with.
    await expect(user.page.getByTestId('waiting-email')).toHaveText(user.email)
    // No app shell or section links for someone without access.
    await expect(user.page.getByTestId('app-navigation')).toHaveCount(0)
    await expect(user.page.getByTestId('page-ask')).toHaveCount(0)
  }
})

test.describe('document upload', () => {
  const pdf = {
    name: 'refused.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% Groundwork test upload that must be refused\n'),
  }

  test('a viewer gets 403', async ({ users, request }) => {
    // GW Viewer is never approved, so its role is `viewer` (shown as No access).
    const [viewer] = await users(['GW Viewer'])
    await viewer.page.goto('/ask')
    await expect(viewer.page.getByTestId('waiting-for-access')).toBeVisible({ timeout: 15_000 })

    const res = await request.post('/api/documents', {
      headers: { Authorization: `Bearer ${await tokenFor(viewer)}` },
      multipart: { file: pdf },
    })
    expect(res.status()).toBe(403)
    expect(await res.json()).toEqual({ success: false, error: 'You do not have permission to do this.' })
  })

  test('requires a token', async ({ request }) => {
    const res = await request.post('/api/documents', { multipart: { file: pdf } })
    expect(res.status()).toBe(401)
  })
})

test.describe('askQuestion action', () => {
  test('refuses people waiting for access', async ({ users, request }) => {
    const [waiting] = await users(['GW Viewer'])
    await waiting.page.goto('/ask')
    await expect(waiting.page.getByTestId('waiting-for-access')).toBeVisible({ timeout: 15_000 })

    const { status, body } = await callAction(
      request,
      'askQuestion',
      { question: '[test] How many remote days?' },
      await tokenFor(waiting),
    )
    expect(status).toBe(200)
    expect(body).toMatchObject({ success: false, error: 'You do not have permission to do this.' })
  })

  test('owner gets an abstained answer for a question the documents do not cover', async ({ users, request }) => {
    test.skip(
      !localOwnerIs('GW Owner'),
      'Needs OWNER_USER_ID in .dev.vars set to GW Owner; run with npx playwright test -c tests/playwright.config.ts',
    )
    // Once documents are indexed this makes a real, owner-billed model call,
    // so it runs only on request.
    test.skip(process.env.GW_LIVE_AI !== '1', 'Makes a live AI call; set GW_LIVE_AI=1 to run it')
    const [owner] = await users(['GW Owner'])
    await owner.page.goto('/ask')
    await expect(owner.page.getByTestId('page-ask')).toBeVisible({ timeout: 15_000 })

    const { status, body } = await callAction(
      request,
      'askQuestion',
      { question: '[test] What is the boiling point of tungsten on Mars?' },
      await tokenFor(owner),
    )
    expect(status).toBe(200)
    expect(body).toMatchObject({ success: true, data: { status: 'abstained' } })
    expect(typeof body!.data.answerId).toBe('string')
  })
})

test.describe('owner UI', () => {
  test('the upload dialog refuses unsupported files before sending them', async ({ users }) => {
    test.skip(
      !localOwnerIs('GW Owner'),
      'Needs OWNER_USER_ID in .dev.vars set to GW Owner; run with npx playwright test -c tests/playwright.config.ts',
    )
    const [owner] = await users(['GW Owner'])
    await owner.page.goto('/documents')
    await expect(owner.page.getByTestId('page-documents')).toBeVisible({ timeout: 15_000 })
    await expect(owner.page.getByTestId('app-navigation')).toBeVisible()
    await owner.page.getByTestId('open-upload').click()
    await owner.page.getByTestId('upload-input').setInputFiles({ name: 'team-photo.png', mimeType: 'image/png', buffer: Buffer.from('x') })
    await expect(owner.page.getByTestId('upload-file-chip')).toContainText("Images aren't supported")
    await expect(owner.page.getByTestId('upload-submit')).toBeDisabled()
    await owner.page.getByTestId('upload-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('') })
    await expect(owner.page.getByTestId('upload-file-chip')).toContainText('This file is empty.')
    await expect(owner.page.getByTestId('upload-submit')).toBeDisabled()
  })
})

test.describe('access approval, live feedback and server-enforced roles', () => {
  test('owner approves a waiting user; their screen becomes the app; a Viewer cannot save eval cases', async ({ users, request }) => {
    test.skip(
      !localOwnerIs('GW Owner'),
      'Needs OWNER_USER_ID in .dev.vars set to GW Owner; run with npx playwright test -c tests/playwright.config.ts',
    )
    test.setTimeout(120_000)
    const [owner, guest] = await users(['GW Owner', 'GW Editor'])

    await guest.page.goto('/ask')
    await expect(guest.page.getByTestId('waiting-for-access')).toBeVisible({ timeout: 15_000 })

    await owner.page.goto('/team')
    const waitingRow = owner.page.locator(`[data-testid=waiting-row][data-email="${guest.email}"]`)
    await expect(waitingRow).toBeVisible({ timeout: 15_000 })

    try {
      await waitingRow.getByRole('button', { name: 'Approve as Viewer' }).click()
      await expect(owner.page.locator(`[data-testid=member-row][data-email="${guest.email}"]`)).toBeVisible()

      // The guest's open tab turns into the app without a reload.
      await expect(guest.page.getByTestId('page-ask')).toBeVisible({ timeout: 20_000 })
      await expect(guest.page.getByTestId('waiting-for-access')).toHaveCount(0)

      // Server-enforced: an approved Viewer cannot save eval cases, re-run evals,
      // delete documents or upload, whatever the UI shows.
      const token = await tokenFor(guest)
      const refused = { success: false, error: 'You do not have permission to do this.' }
      expect((await callAction(request, 'saveEvalCase', { answerId: 'any' }, token)).body).toEqual(refused)
      expect((await callAction(request, 'addEvalCase', { question: 'Can a Viewer add this?' }, token)).body).toEqual(refused)
      expect((await callAction(request, 'runEvals', {}, token)).body).toEqual(refused)
      expect((await callAction(request, 'deleteDocument', { documentId: 'any' }, token)).body).toEqual(refused)
      const upload = await request.post('/api/documents', {
        headers: { Authorization: `Bearer ${token}` },
        multipart: { file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } },
      })
      expect(upload.status()).toBe(403)

      // Role dropdown: the custom listbox, by keyboard (no native <select>).
      await expect(owner.page.locator('select')).toHaveCount(0)
      const memberRow = owner.page.locator(`[data-testid=member-row][data-email="${guest.email}"]`)
      const roleBtn = memberRow.getByRole('button', { name: /^Role for / })
      await expect(roleBtn).toHaveText('Viewer')
      await roleBtn.focus()
      await owner.page.keyboard.press('ArrowDown')
      const list = owner.page.getByRole('listbox')
      await expect(list.getByRole('option')).toHaveText([/^Viewer/, /^Editor/, /^Owner/])
      await expect(list.getByRole('option', { selected: true })).toContainText('Viewer')
      await expect(list).toContainText('Also uploads and deletes documents and saves eval cases.')
      await owner.page.keyboard.press('Escape')
      await expect(list).toHaveCount(0)
      await expect(roleBtn).toBeFocused()
      await expect(roleBtn).toHaveText('Viewer')
      // Enter opens, ArrowDown moves to Editor, Enter chooses; focus returns to the button.
      await owner.page.keyboard.press('Enter')
      await owner.page.keyboard.press('ArrowDown')
      await owner.page.keyboard.press('Enter')
      await expect(roleBtn).toHaveText('Editor', { timeout: 10_000 })
      await expect(roleBtn).toBeFocused()
      // The change is real: the guest's tab now offers uploading.
      await guest.page.goto('/documents')
      await expect(guest.page.getByTestId('open-upload')).toBeVisible({ timeout: 20_000 })
      // Back to Viewer with the mouse.
      await roleBtn.click()
      await owner.page.getByRole('option', { name: /^Viewer/ }).click()
      await expect(roleBtn).toHaveText('Viewer', { timeout: 10_000 })
      await expect(guest.page.getByTestId('open-upload')).toHaveCount(0, { timeout: 20_000 })

      // Live feedback across two windows (needs at least one finished answer locally).
      await owner.page.goto('/ask')
      const ownerFirst = owner.page.locator('[data-testid=answer]:not([data-status=pending]):not([data-status=error])').first()
      if (await ownerFirst.count()) {
        const id = await ownerFirst.locator('h3').getAttribute('id')
        const guestCard = guest.page.locator(`article:has(h3#${id})`)
        const ownerCount = owner.page.locator(`article:has(h3#${id})`).getByTestId('count-up')
        const before = Number(await ownerCount.innerText())
        await guestCard.getByTestId('vote-up').click()
        await expect(ownerCount).toHaveText(String(before + 1), { timeout: 10_000 })
        await guestCard.getByTestId('vote-up').click() // toggle off again
        await expect(ownerCount).toHaveText(String(before), { timeout: 10_000 })
      }
    } finally {
      // Always put the guest back to "waiting" so other specs see the expected state.
      await owner.page.goto('/team')
      const member = owner.page.locator(`[data-testid=member-row][data-email="${guest.email}"]`)
      const waiting = owner.page.locator(`[data-testid=waiting-row][data-email="${guest.email}"]`)
      // Wait for the roster to load: count() alone does not wait, and an empty
      // roster once skipped this cleanup and left the guest approved.
      await expect(member.or(waiting)).toBeVisible({ timeout: 15_000 })
      if (await member.count()) {
        await member.getByRole('button', { name: /^Remove / }).click()
        await owner.page.getByTestId('confirm-dialog').getByRole('button', { name: 'Remove member' }).click()
        await expect(owner.page.locator(`[data-testid=waiting-row][data-email="${guest.email}"]`)).toBeVisible({ timeout: 15_000 })
      }
    }
    await expect(guest.page.getByTestId('waiting-for-access')).toBeVisible({ timeout: 20_000 })
  })
})
