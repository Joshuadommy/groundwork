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
  const [a, b] = await users(2)

  // Test accounts are not the app owner, so they start as `viewer` (no access).
  // /ask is gated; each browser must show the waiting screen for ITS account.
  await Promise.all([a.page.goto('/ask'), b.page.goto('/ask')])

  for (const user of [a, b]) {
    await expect(user.page.getByTestId('waiting-for-access')).toBeVisible({ timeout: 15_000 })
    await expect(user.page.getByTestId('waiting-for-access')).toContainText(user.email)
    // No section links for someone without access.
    await expect(user.page.getByRole('link', { name: 'Documents' })).toHaveCount(0)
    await expect(user.page.getByTestId('page-ask')).toHaveCount(0)

    // Email, not name: the email is the credential the context signed in with.
    await user.page.getByRole('button', { name: 'Account menu' }).click()
    await expect(user.page.getByTestId('nav-user-email')).toHaveText(user.email, {
      timeout: 15_000,
    })
  }
})
