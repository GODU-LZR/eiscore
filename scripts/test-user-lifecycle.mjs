// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

// Real SQL/HTTP checks use only uniquely named tmpfs containers. No existing
// database name, volume, runtime endpoint or credentials are accepted.
import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`
const network = `eiscore-user-lifecycle-net-${suffix}`
const database = `eiscore-user-lifecycle-db-${suffix}`
const api = `eiscore-user-lifecycle-api-${suffix}`
const postgresImage = 'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f'
const postgrestImage = 'postgrest/postgrest@sha256:00c1ec8a9339f52a7e765cb3bd3ab5b001f0b5dd954cfb69b43b9de494a9a0aa'
const rootPassword = randomBytes(32).toString('base64url')
const postgrestPassword = randomBytes(32).toString('base64url')
const flashAgentPassword = randomBytes(32).toString('base64url')
const jwtSecret = randomBytes(40).toString('base64url')
const userPassword = randomBytes(24).toString('base64url')
const roles = ['20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000013']
const department = '10000000-0000-4000-8000-000000000012'

const execute = (program, args, { input, allowFailure = false } = {}) => {
  const result = spawnSync(program, args, {
    cwd: repoRoot, input, encoding: 'utf8', windowsHide: true,
    timeout: 120_000, maxBuffer: 64 * 1024 * 1024
  })
  if (result.error) throw result.error
  // Never echo Docker arguments: test credentials are generated in memory.
  if (result.status !== 0 && !allowFailure) throw new Error(`${program} failed: ${result.stderr || result.stdout}`)
  return result
}
const docker = (args, options) => execute('docker', args, options)
const sql = (text, options) => docker([
  'exec', '-i', database, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'eiscore'
], { input: text, ...options }).stdout.trim()
const sqlFile = (path) => docker([
  'exec', database, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'eiscore', '-f', `/repo/${path}`
])
const runManifest = () => execute(process.execPath, [
  'scripts/apply-runtime-migrations.mjs', '--manifest', 'database/migrations/core.json',
  '--db-container', database, '--db-name', 'eiscore', '--db-user', 'postgres',
  '--backup-evidence', 'test://user-lifecycle-isolated-tmpfs',
  '--release-revision', 'user-lifecycle-test', '--operator', 'user-lifecycle-test'
])
const pause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const availablePort = () => new Promise((resolvePromise, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    server.close((error) => error ? reject(error) : resolvePromise(port))
  })
})
const token = (claims) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`
  return `${body}.${createHmac('sha256', jwtSecret).update(body).digest('base64url')}`
}

let baseUrl
let checks = 0
const authorization = `Bearer ${token({ role: 'web_user', app_role: 'super_admin', username: 'lifecycle-admin', exp: Math.floor(Date.now() / 1000) + 600 })}`
const restrictedAuthorization = `Bearer ${token({ role: 'web_user', app_role: 'lifecycle-empty', username: 'lifecycle-empty', exp: Math.floor(Date.now() / 1000) + 600, permissions: [] })}`
const createAuthorization = `Bearer ${token({ role: 'web_user', app_role: 'lifecycle-create', username: 'lifecycle-create', exp: Math.floor(Date.now() / 1000) + 600, permissions: ['op:hr_user.create'] })}`
const request = async (path, method = 'GET', body, auth = authorization) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: {
      authorization: auth, 'content-type': 'application/json',
      'accept-profile': 'public', 'content-profile': 'public', prefer: 'return=representation'
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : null }
}
const expectStatus = (out, statuses) => {
  assert.ok(statuses.includes(out.status), `unexpected HTTP ${out.status}: ${JSON.stringify(out.data)}`)
  checks++
  return out.data
}
const getUser = async (id) => expectStatus(await request(`/v_users_manage?id=eq.${id}`), [200])[0]
const create = async (body, path = '/users') => expectStatus(await request(path, 'POST', body), [201])[0]
const login = async (username, payload = false) => request('/rpc/login', 'POST', payload
  ? { payload: { username, password: userPassword } }
  : { username, password: userPassword }, '')
const requireLogin = async (username, permissions, appRole = 'lifecycle_reader') => {
  for (const payload of [false, true]) {
    const result = expectStatus(await login(username, payload), [200])
    const [header, body, signature] = result.token.split('.')
    assert.equal(signature, createHmac('sha256', jwtSecret).update(`${header}.${body}`).digest('base64url'))
    const claims = JSON.parse(Buffer.from(body, 'base64url'))
    assert.equal(claims.tenant_id, 'lifecycle-tenant')
    assert.equal(result.tenant_id, claims.tenant_id)
    assert.equal(claims.app_role, appRole)
    assert.deepEqual(claims.permissions, permissions)
    assert.deepEqual(result.permissions, permissions)
  }
}
const denyLogin = async (username) => {
  for (const payload of [false, true]) expectStatus(await login(username, payload), [401, 403])
}
const deniedWrite = async (path, method, body, auth) => {
  const error = expectStatus(await request(path, method, body, auth), [400, 403, 409, 500])
  assert.ok(['55000', '42501', '22023'].includes(error.code), `denial must come from lifecycle guard: ${JSON.stringify(error)}`)
}

try {
  docker(['version'])
  docker(['network', 'create', network])
  docker([
    'run', '-d', '--name', database, '--network', network, '--read-only',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=2g',
    '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--shm-size', '256m',
    '-e', 'POSTGRES_DB=eiscore', '-e', `POSTGRES_PASSWORD=${rootPassword}`,
    '--mount', `type=bind,source=${repoRoot},target=/repo,readonly`, postgresImage
  ])
  let ready = false
  for (let attempt = 0; attempt < 160; attempt++) {
    const log = docker(['logs', database], { allowFailure: true })
    if (`${log.stdout}\n${log.stderr}`.includes('PostgreSQL init process complete; ready for start up.')
        && docker(['exec', database, 'pg_isready', '-U', 'postgres'], { allowFailure: true }).status === 0) {
      ready = true
      break
    }
    await pause(250)
  }
  assert.ok(ready, 'isolated PostgreSQL failed to start')
  const mounts = JSON.parse(docker(['inspect', '--format', '{{json .Mounts}}', database]).stdout)
  assert.equal(mounts.some((mount) => mount.Type === 'volume'), false, 'test must not attach persistent volumes')
  sqlFile('database/bootstrap/roles-v2.sql')
  sqlFile('database/baselines/eiscore-db-v1/schema.sql')
  sqlFile('database/baselines/eiscore-db-v1/register.sql')
  sql(`INSERT INTO public.users(username,password,status) VALUES ('legacy-disabled','${userPassword}','disabled'),('legacy-active','${userPassword}','active');`)
  runManifest()
  assert.equal(sql("SELECT status FROM public.users WHERE username='legacy-disabled';"), 'disabled')
  assert.equal(sql("SELECT status FROM public.users WHERE username='legacy-active';"), 'active')
  docker([
    'exec', '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore',
    '-e', `POSTGRES_PASSWORD=${rootPassword}`, '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
    '-e', `POSTGREST_DB_PASSWORD=${postgrestPassword}`,
    '-e', `AGENT_DB_PASSWORD=${randomBytes(32).toString('base64url')}`,
    '-e', `FLASH_AGENT_DB_PASSWORD=${flashAgentPassword}`,
    database, 'bash', '/repo/scripts/configure-database-runtime-secrets-v2.sh'
  ])
  sql(`
    INSERT INTO public.departments(id,name) VALUES ('${department}','测试部门');
    INSERT INTO public.roles(id,code,name) VALUES
      ('${roles[0]}','lifecycle_reader','测试读者'),('${roles[1]}','lifecycle_other','测试其他');
    INSERT INTO public.permissions(code,name) VALUES ('lifecycle:test.read','测试读取');
    INSERT INTO public.role_permissions(role_id,permission_id)
      SELECT '${roles[0]}',id FROM public.permissions WHERE code='lifecycle:test.read';
  `)
  const port = await availablePort()
  baseUrl = `http://127.0.0.1:${port}`
  docker([
    'run', '-d', '--name', api, '--network', network, '-p', `127.0.0.1:${port}:3000`,
    '-e', `PGRST_DB_URI=postgres://eiscore_authenticator:${postgrestPassword}@${database}:5432/eiscore`,
    '-e', 'PGRST_DB_SCHEMAS=public,hr', '-e', 'PGRST_DB_ANON_ROLE=web_anon',
    '-e', `PGRST_JWT_SECRET=${jwtSecret}`, postgrestImage
  ])
  ready = false
  for (let attempt = 0; attempt < 160; attempt++) {
    try { if ((await fetch(`${baseUrl}/`)).ok) { ready = true; break } } catch {}
    await pause(250)
  }
  assert.ok(ready, 'isolated PostgREST failed to start')

  await denyLogin('legacy-disabled')
  await deniedWrite('/users', 'POST', { username: 'cannot-create-active', password: userPassword, status: 'active' }, createAuthorization)
  await deniedWrite('/v_users_manage', 'POST', { username: 'cannot-create-active-view', password: userPassword, status: 'active' }, createAuthorization)
  const user = await create({ username: 'lifecycle-user', password: userPassword, tenant_id: 'lifecycle-tenant', role: 'lifecycle_reader', permissions: ['lifecycle:test.read'], created_at: '2000-01-01', updated_at: '2000-01-01' })
  assert.equal(user.status, 'created')
  assert.ok(new Date(user.created_at).getFullYear() > 2000)
  assert.equal(user.created_at, user.updated_at)
  await denyLogin(user.username)
  await deniedWrite(`/users?id=eq.${user.id}`, 'PATCH', { status: 'locked' })
  await deniedWrite(`/users?id=eq.${user.id}`, 'PATCH', { status: 'active' }, restrictedAuthorization)
  expectStatus(await request(`/users?id=eq.${user.id}`, 'PATCH', { status: 'active' }), [200])
  await requireLogin(user.username, ['lifecycle:test.read'])
  const beforeRole = await getUser(user.id)
  expectStatus(await request('/user_roles', 'POST', { user_id: user.id, role_id: roles[0] }), [201])
  const withRole = await getUser(user.id)
  assert.ok(new Date(withRole.updated_at) > new Date(beforeRole.updated_at))
  assert.equal(withRole.created_at, user.created_at)
  await requireLogin(user.username, ['lifecycle:test.read'])

  const edited = expectStatus(await request(`/v_users_manage?id=eq.${user.id}`, 'PATCH', { full_name: '可修改资料', created_at: '2000-01-01', updated_at: '2000-01-01' }), [200])[0]
  assert.equal(edited.created_at, user.created_at)
  assert.ok(new Date(edited.updated_at) > new Date(withRole.updated_at))
  assert.equal(sql(`SELECT updated_at = '${edited.updated_at}'::timestamptz FROM public.users WHERE id=${user.id};`), 't')
  const locked = expectStatus(await request(`/v_users_manage?id=eq.${user.id}`, 'PATCH', { status: 'locked' }), [200])[0]
  assert.equal(locked.status, 'locked')
  assert.equal((await getUser(user.id)).role_id, roles[0], 'locking must not rewrite roles')
  await requireLogin(user.username, ['lifecycle:test.read'])
  for (const path of [`/users?id=eq.${user.id}`, `/v_users_manage?id=eq.${user.id}`]) {
    await deniedWrite(path, 'PATCH', { full_name: '绕过锁定' })
    await deniedWrite(path, 'PATCH', { status: 'active', full_name: '同时解锁编辑' })
    await deniedWrite(path, 'DELETE')
  }
  await deniedWrite(`/v_users_manage?id=eq.${user.id}`, 'PATCH', { status: 'active', role_id: roles[1] })
  await deniedWrite(`/v_users_manage?id=eq.${user.id}`, 'PATCH', { status: 'active', dept_id: department })
  await deniedWrite('/user_roles', 'POST', { user_id: user.id, role_id: roles[1] })
  await deniedWrite(`/user_roles?user_id=eq.${user.id}`, 'PATCH', { role_id: roles[1] })
  await deniedWrite(`/user_roles?user_id=eq.${user.id}`, 'DELETE')
  assert.deepEqual(await getUser(user.id), locked, 'rejected writes must roll back all fields and dates')
  expectStatus(await request(`/v_users_manage?id=eq.${user.id}`, 'PATCH', { status: 'active' }), [200])
  expectStatus(await request(`/v_users_manage?id=eq.${user.id}`, 'PATCH', { full_name: '解除锁定后可修改' }), [200])
  await deniedWrite(`/user_roles?user_id=eq.${user.id}`, 'PATCH', { role_id: roles[1] }, restrictedAuthorization)
  const beforeRoleChange = await getUser(user.id)
  const changedRole = expectStatus(await request(`/v_users_manage?id=eq.${user.id}`, 'PATCH', { role_id: roles[1] }), [200])[0]
  assert.equal(changedRole.updated_at, (await getUser(user.id)).updated_at)
  assert.ok(new Date(changedRole.updated_at) > new Date(beforeRoleChange.updated_at))
  expectStatus(await request(`/users?id=eq.${user.id}`, 'PATCH', { status: 'created' }), [200])
  await denyLogin(user.username)

  const viewUser = expectStatus(await request('/v_users_manage', 'POST', {
    username: 'lifecycle-view-created', password: userPassword, role_id: roles[0], dept_id: department
  }, createAuthorization), [201])[0]
  assert.equal(viewUser.status, 'created')
  assert.equal(viewUser.created_at, (await getUser(viewUser.id)).created_at)
  assert.equal(viewUser.updated_at, (await getUser(viewUser.id)).updated_at)
  assert.equal((await getUser(viewUser.id)).dept_id, department)
  expectStatus(await request(`/v_users_manage?id=eq.${viewUser.id}`, 'PATCH', { dept_id: null }), [200])
  assert.equal((await getUser(viewUser.id)).dept_id, null)
  await denyLogin(viewUser.username)
  expectStatus(await request(`/v_users_manage?id=eq.${viewUser.id}`, 'PATCH', { status: 'active' }), [200])
  await deniedWrite(`/user_roles?user_id=eq.${user.id}`, 'PATCH', { user_id: viewUser.id }, restrictedAuthorization)
  expectStatus(await request(`/v_users_manage?id=eq.${viewUser.id}`, 'DELETE'), [200])
  assert.equal((await request(`/users?id=eq.${viewUser.id}`)).data.length, 0)
  const snapshot = sql(`SELECT row_to_json(u) FROM public.users u WHERE id=${user.id};`)
  runManifest()
  assert.equal(sql(`SELECT row_to_json(u) FROM public.users u WHERE id=${user.id};`), snapshot, 'repeat migration must not rewrite user data')
  console.log(`PASS: isolated user lifecycle (${checks} HTTP checks, signed permission/tenant login overloads, table/view/role bypasses, server dates, migration repeat; zero persistent volumes)`)
} finally {
  docker(['rm', '-f', api], { allowFailure: true })
  docker(['rm', '-f', database], { allowFailure: true })
  docker(['network', 'rm', network], { allowFailure: true })
}
