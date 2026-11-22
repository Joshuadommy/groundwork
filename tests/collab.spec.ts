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

test('new sign-ins wait for access and receive no records', async ({ users }) => {
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

  test('owner gets an abstained answer when nothing relevant is indexed', async ({ users, request }) => {
    test.skip(
      !localOwnerIs('GW Owner'),
      'Needs OWNER_USER_ID in .dev.vars set to GW Owner; run with npx playwright test -c tests/playwright.config.ts',
    )
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
