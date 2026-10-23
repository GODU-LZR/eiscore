import assert from 'node:assert/strict'
import { handleKnowledgeDshBootstrapRedirect } from './dsh-web-runner.mjs'

const request = { method: 'GET', url: '/', headers: {} }
const upstreamResponse = {
  statusCode: 303,
  headers: { location: '/' },
  resumed: false,
  resume() { this.resumed = true }
}
const response = {
  status: 0,
  headers: {},
  body: '',
  writeHead(status, headers) { this.status = status; this.headers = headers; return this },
  end(body = '') { this.body = body }
}

let bootstrapInput
let forwarded
const handled = await handleKnowledgeDshBootstrapRedirect({
  request,
  response,
  upstreamResponse,
  headers: { cookie: 'session=kept; dsh-auth-old=stale' },
  bootstrapCookies: ['dsh-auth-old=stale'],
  retryBootstrap: true,
  profile: 'knowledge',
  bootstrap: async (headers) => {
    bootstrapInput = headers
    return { headers: { ...headers, cookie: 'session=kept; dsh-auth-new=fresh' }, setCookies: ['dsh-auth-new=fresh'] }
  },
  forward: (...args) => { forwarded = args }
})

assert.equal(handled, true)
assert.equal(upstreamResponse.resumed, true)
assert.equal(bootstrapInput.cookie, 'session=kept')
assert.equal(forwarded[0], request)
assert.equal(forwarded[2].cookie, 'session=kept; dsh-auth-new=fresh')
assert.deepEqual(forwarded[3], ['dsh-auth-old=stale', 'dsh-auth-new=fresh'])
assert.equal(forwarded[4], false)
assert.equal(response.status, 0)

let secondBootstrapCalls = 0
let secondForwardCalls = 0
const secondResponse = {
  status: 0,
  headers: {},
  body: '',
  writeHead(status, headers) { this.status = status; this.headers = headers; return this },
  end(body = '') { this.body = body }
}
const secondHandled = await handleKnowledgeDshBootstrapRedirect({
  request,
  response: secondResponse,
  upstreamResponse: { ...upstreamResponse, resumed: false },
  headers: { cookie: 'session=kept; dsh-auth-new=fresh' },
  retryBootstrap: false,
  profile: 'knowledge',
  bootstrap: async () => { secondBootstrapCalls++; return { headers: {}, setCookies: [] } },
  forward: () => { secondForwardCalls++ }
})

assert.equal(secondHandled, true)
assert.equal(secondBootstrapCalls, 0)
assert.equal(secondForwardCalls, 0)
assert.equal(secondResponse.status, 503)
assert.equal(secondResponse.headers['cache-control'], 'no-store')
assert.deepEqual(JSON.parse(secondResponse.body), { code: 'DSH_BOOTSTRAP_UNAVAILABLE' })

const businessResponse = { ...upstreamResponse, resumed: false }
assert.equal(await handleKnowledgeDshBootstrapRedirect({
  request,
  response: secondResponse,
  upstreamResponse: businessResponse,
  headers: {},
  retryBootstrap: true,
  profile: 'business',
  bootstrap: async () => { throw new Error('business profile must not bootstrap-retry') },
  forward: () => { throw new Error('business profile must forward as usual') }
}), false)
assert.equal(businessResponse.resumed, false)

console.log('PASS: knowledge DSH bootstrap retries once with fresh cookies, then fails closed; business profile is unchanged')
