import assert from 'node:assert/strict'
import { createAuthStatusCache, createSingleFlight, hasDshAuthCookie, shouldBootstrapDshAuth } from './dsh-web-runner.mjs'

assert.equal(hasDshAuthCookie('session=one; dsh-auth-web=token'), true)
assert.equal(hasDshAuthCookie('session=one; eiscore-session=token'), false)
assert.equal(shouldBootstrapDshAuth({ method: 'GET', url: '/', headers: { accept: 'text/html' } }), true)
assert.equal(shouldBootstrapDshAuth({ method: 'GET', url: '/', headers: { 'sec-fetch-dest': 'iframe' } }), true)
assert.equal(shouldBootstrapDshAuth({ method: 'GET', url: '/', headers: { cookie: 'dsh-auth-web=token' } }), false)
assert.equal(shouldBootstrapDshAuth({ method: 'GET', url: '/', headers: { accept: 'application/json' } }), true)
assert.equal(shouldBootstrapDshAuth({ method: 'GET', url: '/api/chat', headers: { accept: 'text/html' } }), true)

const flights = createSingleFlight()
let bootstrapLoads = 0
const bootstrap = async () => {
  bootstrapLoads += 1
  await new Promise((resolve) => setTimeout(resolve, 5))
  return { setCookies: ['dsh-auth-web=token'] }
}
const bootstrapped = await Promise.all([
  flights.run('anonymous', bootstrap),
  flights.run('anonymous', bootstrap)
])
assert.deepEqual(bootstrapped[0], bootstrapped[1])
assert.equal(bootstrapLoads, 1)
await flights.run('anonymous', bootstrap)
assert.equal(bootstrapLoads, 2)

let failedBootstraps = 0
await assert.rejects(flights.run('retry', async () => {
  failedBootstraps += 1
  throw new Error('bootstrap failed')
}))
await flights.run('retry', async () => {
  failedBootstraps += 1
  return true
})
assert.equal(failedBootstraps, 2)

const cache = createAuthStatusCache(500, 2)
let loads = 0
const loadAuthenticated = async () => {
  loads += 1
  await new Promise((resolve) => setTimeout(resolve, 5))
  return { authenticated: true }
}

const concurrent = await Promise.all([
  cache.get('session-a', loadAuthenticated),
  cache.get('session-a', loadAuthenticated)
])
assert.deepEqual(concurrent, [{ authenticated: true }, { authenticated: true }])
assert.equal(loads, 1)
await cache.get('session-a', loadAuthenticated)
assert.equal(loads, 1)

cache.delete('session-a')
await cache.get('session-a', loadAuthenticated)
assert.equal(loads, 2)

let rejectedLoads = 0
const loadUnauthenticated = async () => {
  rejectedLoads += 1
  return { authenticated: false }
}
await cache.get('session-b', loadUnauthenticated)
await cache.get('session-b', loadUnauthenticated)
assert.equal(rejectedLoads, 2)

await new Promise((resolve) => setTimeout(resolve, 525))
await cache.get('session-a', loadAuthenticated)
assert.equal(loads, 3)

console.log('PASS: DSH bootstrap single-flight, cookie detection, and short-lived authenticated-status cache')
