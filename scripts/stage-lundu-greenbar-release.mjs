import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const base = resolve(root, 'eiscore-base/dist')
const staging = resolve(root, 'output/lundu-greenbar-staging')
const archive = resolve(root, 'output/lundu-procurement-customer-service-release-20261007.tar.gz')
rmSync(staging, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
execFileSync('tar', ['-xzf', archive, '-C', staging], { stdio: 'inherit' })
for (const name of ['index.html', 'assets', 'config', 'enterprise-assets', 'favicon.ico', 'sw.js']) {
  const source = resolve(base, name)
  const destination = resolve(staging, name)
  cpSync(source, destination, { recursive: true, force: true })
}
console.log('[ok] staged greenbar release at ' + staging)
