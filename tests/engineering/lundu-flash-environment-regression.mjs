import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const directory = mkdtempSync(join(tmpdir(), 'lundu-flash-env-'))
const envPath = join(directory, '.env')
const providerKey = 'sk-flash-test-key-0123456789abcdef'
const base = 'POSTGRES_PASSWORD=postgres-secret-keep\nAGENT_DB_PASSWORD=agent-secret-keep\nDEEPSEEK_API_KEY=business-key-keep\nFLASH_CLINE_ENABLED=false\n'
writeFileSync(envPath, base, { mode: 0o600 })
const args = [
  'scripts/configure-lundu-flash-env.py', '--file', envPath,
  '--harness-root', resolve(directory, 'harness'), '--flash-source', resolve(directory, 'source'),
  '--workspace', resolve(directory, 'flash-workspace')
]
const configure = (key) => spawnSync('python', args, {
  cwd: root, input: `${key}\n`, encoding: 'utf8', windowsHide: true
})

try {
  const configured = configure(providerKey)
  assert.equal(configured.status, 0, configured.stderr)
  assert.doesNotMatch(configured.stdout + configured.stderr, new RegExp(providerKey))
  const first = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator), line.slice(separator + 1)]
  }))
  assert.equal(first.POSTGRES_PASSWORD, 'postgres-secret-keep')
  assert.equal(first.AGENT_DB_PASSWORD, 'agent-secret-keep')
  assert.equal(first.DEEPSEEK_API_KEY, 'business-key-keep')
  assert.equal(first.FLASH_DEEPSEEK_API_KEY, providerKey)
  assert.equal(first.DSH_PROVIDER, 'deepseek-official')
  assert.equal(first.DSH_MODEL, 'deepseek-v4-flash')
  assert.equal(first.FLASH_AGENT_DB_USER, 'eiscore_flash_agent')
  assert.equal(new Set([
    first.FLASH_AGENT_DB_PASSWORD,
    first.FLASH_EISCORE_HARNESS_AUDIT_HASH_KEY,
    first.FLASH_EISCORE_HARNESS_BRIDGE_SECRET,
    first.FLASH_EISCORE_TOOL_PROXY_SECRET
  ]).size, 4)
  assert.equal(new Set(Object.keys(first)).size, Object.keys(first).length)
  if (process.platform !== 'win32') assert.equal(statSync(envPath).mode & 0o777, 0o600)

  const repeated = configure(providerKey)
  assert.equal(repeated.status, 0, repeated.stderr)
  const second = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator), line.slice(separator + 1)]
  }))
  assert.equal(second.FLASH_AGENT_DB_PASSWORD, first.FLASH_AGENT_DB_PASSWORD)
  assert.equal(second.FLASH_EISCORE_HARNESS_BRIDGE_SECRET, first.FLASH_EISCORE_HARNESS_BRIDGE_SECRET)

  const invalid = configure('not a key')
  assert.notEqual(invalid.status, 0)
  assert.doesNotMatch(invalid.stdout + invalid.stderr, /not a key/)
  console.log('PASS: Lundu Flash environment provisioning is isolated, idempotent, permission-bounded, and redacts credentials')
} finally {
  rmSync(directory, { recursive: true, force: true })
}
