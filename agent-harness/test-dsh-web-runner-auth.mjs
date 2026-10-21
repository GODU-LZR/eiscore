import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAuthStatusCache,
  hasDshAuthCookie,
  isHtmlNavigation,
  shouldBootstrapDshAuth
} from './dsh-web-runner.mjs'

test('DSH auth cookie matching requires a complete cookie assignment', () => {
  assert.equal(hasDshAuthCookie('eiscore-session=abc; dsh-auth-workspace=xyz'), true)
  assert.equal(hasDshAuthCookie('dsh-authenticated=xyz'), false)
  assert.equal(hasDshAuthCookie('not-dsh-auth-workspace=xyz'), false)
  assert.equal(hasDshAuthCookie('dsh-auth-workspace'), false)
})

test('root HTML navigation lets DSH establish its browser session without a bootstrap request', () => {
  const request = { method: 'GET', url: '/?view=home', headers: { accept: 'text/html' } }
  assert.equal(isHtmlNavigation(request), true)
  assert.equal(shouldBootstrapDshAuth(request), false)
  assert.equal(shouldBootstrapDshAuth({ method: 'POST', url: '/', headers: { accept: 'text/html' } }), true)
  assert.equal(shouldBootstrapDshAuth({ method: 'GET', url: '/api/session', headers: { accept: 'application/json' } }), true)
})

test('successful auth status is coalesced and briefly cached; negative results are retried', async () => {
  const cache = createAuthStatusCache(1000, 2)
  let loads = 0
  const loadAuthenticated = async () => {
    loads += 1
    await new Promise((resolve) => setTimeout(resolve, 5))
    return { authenticated: true }
  }

  const [first, concurrent] = await Promise.all([
    cache.get('user-a', loadAuthenticated),
    cache.get('user-a', loadAuthenticated)
  ])
  assert.deepEqual(first, { authenticated: true })
  assert.deepEqual(concurrent, first)
  assert.equal(loads, 1)
  await cache.get('user-a', loadAuthenticated)
  assert.equal(loads, 1)

  let negativeLoads = 0
  const loadUnauthenticated = async () => {
    negativeLoads += 1
    return { authenticated: false }
  }
  await cache.get('user-b', loadUnauthenticated)
  await cache.get('user-b', loadUnauthenticated)
  assert.equal(negativeLoads, 2)

  cache.delete('user-a')
  await cache.get('user-a', loadAuthenticated)
  assert.equal(loads, 2)
})
