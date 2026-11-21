import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('records WebSocket refuses a connection without a token', async ({ request }) => {
    const res = await request.get('/ws/any-room')
    expect(res.status()).toBe(401)
  })

  test('job WebSocket refuses a connection without a token', async ({ request }) => {
    const res = await request.get('/ws/jobs/any-room')
    expect(res.status()).toBe(401)
  })
})
