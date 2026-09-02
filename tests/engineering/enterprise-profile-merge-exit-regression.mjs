// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const audit = readFileSync(resolve(repoRoot, 'docs/engineering/ENTERPRISE_PROFILE_MERGE_EXIT_AUDIT.md'), 'utf8')
const adr = readFileSync(resolve(repoRoot, 'docs/engineering/adr/0011-enterprise-profile-single-source.md'), 'utf8')
const e2e = readFileSync(resolve(repoRoot, 'tests/e2e/enterprise-profile-merge.spec.mjs'), 'utf8')
const e2eConfig = readFileSync(resolve(repoRoot, 'playwright.enterprise-profile.config.mjs'), 'utf8')
const baseVite = readFileSync(resolve(repoRoot, 'eiscore-base/vite.config.js'), 'utf8')
const nginx = readFileSync(resolve(repoRoot, 'nginx/conf.d/default.conf'), 'utf8')
const staticServer = readFileSync(resolve(repoRoot, 'scripts/static-spa-server.mjs'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))

for (const marker of [
  '唯一运行时事实源',
  '企业站点运营',
  '系统设置',
  '保存草稿 → 发布 → 公开 API → 基座重新加载',
  '80 条',
  '107 份',
  '148 个',
  '12/12',
  '1/1',
  '状态化契约模拟',
  '未进入 G4',
  '原仓库'
]) {
  assert.ok(audit.includes(marker), `enterprise profile merge audit lost marker: ${marker}`)
}

assert.match(adr, /状态：接受/)
assert.match(adr, /company_site\.site_config/)
assert.match(adr, /唯一运行时事实源/)
assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:enterprise-profile/)
assert.match(packageJson.scripts?.['test:g3.5-exit'] || '', /enterprise-profile-merge-exit-regression/)
assert.match(packageJson.scripts?.['test:unit'] || '', /npm run test:company-site-runtime/)
assert.match(packageJson.scripts?.['test:company-site-runtime'] || '', /company-site-schema-regression\.mjs/)
assert.match(packageJson.scripts?.['test:company-site-runtime'] || '', /company-site-handlers-regression\.mjs/)
assert.match(packageJson.scripts?.['test:e2e:enterprise-profile-merge'] || '', /enterprise-profile-merge\.spec\.mjs/)
assert.match(e2eConfig, /enterprise-profile-playwright-result\.json/)
assert.match(e2eConfig, /VITE_DEV_CORS_ORIGIN/)
assert.match(baseVite, /rawPath\.startsWith\('\/company-site'\)/)
assert.match(baseVite, /'\/company-site':\s*\{\s*target:\s*'http:\/\/localhost:8092'/s)
assert.match(nginx, /location \/company-site\/ \{\s*proxy_pass http:\/\/host\.docker\.internal:8092\/company-site\//s)
assert.match(staticServer, /prefix:\s*'\/company-site',\s*target:\s*'http:\/\/127\.0\.0\.1:8092'/)
assert.doesNotMatch(e2e, /page\.route\(`\$\{HOST_URL\}\/company-site/)
for (const marker of [
  '企业公开资料已合并到企业站点运营',
  "page.locator('.login-btn').click()",
  '进入企业站点运营',
  '保存设置',
  '发布站点',
  'publicDraftCheck',
  'page.reload()'
]) {
  assert.ok(e2e.includes(marker), `enterprise profile browser acceptance lost marker: ${marker}`)
}

console.log('PASS: enterprise profile merge checkpoint keeps ownership, evidence, isolation and G4 boundary explicit')
