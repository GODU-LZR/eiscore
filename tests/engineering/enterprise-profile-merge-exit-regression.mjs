// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const audit = readFileSync(resolve(repoRoot, 'docs/engineering/ENTERPRISE_PROFILE_MERGE_EXIT_AUDIT.md'), 'utf8')
const adr = readFileSync(resolve(repoRoot, 'docs/engineering/adr/0011-enterprise-profile-single-source.md'), 'utf8')
const enterpriseConfig = readFileSync(resolve(repoRoot, 'docs/engineering/ENTERPRISE_CONFIG.md'), 'utf8')
const progress = readFileSync(resolve(repoRoot, 'docs/engineering/REFACTOR_PROGRESS.md'), 'utf8')
const readiness = readFileSync(resolve(repoRoot, 'docs/engineering/PRE_G4_ENGINEERING_READINESS.md'), 'utf8')
const finalReport = readFileSync(resolve(repoRoot, 'docs/engineering/REFACTOR_FINAL_REPORT.md'), 'utf8')
const junleyuanAudit = readFileSync(resolve(repoRoot, 'docs/engineering/JUNLEYUAN_LATEST_RESULT_MERGE_AUDIT.md'), 'utf8')
const e2e = readFileSync(resolve(repoRoot, 'tests/e2e/enterprise-profile-merge.spec.mjs'), 'utf8')
const fullStackE2e = readFileSync(resolve(repoRoot, 'tests/full-stack-e2e/enterprise-profile-merge.spec.mjs'), 'utf8')
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
assert.match(enterpriseConfig, /系统设置只读展示该档案/)
assert.doesNotMatch(enterpriseConfig, /系统设置仍可覆盖部署默认值/)
assert.doesNotMatch(enterpriseConfig, /loginBranding` 继续作为管理员运行期覆盖层/)
assert.match(progress, /真实 PostgreSQL\/PostgREST\/Agent\/双 Vite 完整栈 1\/1/)
assert.doesNotMatch(progress, /未验证：合并场景在恢复后的/)
assert.match(readiness, /当前自动化范围内没有未处理的阻断错误/)
assert.match(readiness, /G4 产品配置化 \| 未开始/)
for (const marker of [
  '企业站 26/26',
  '252 个 Node 文件语法',
  '君乐缘材质 Chromium 1/1',
  '42 个 V2/V3 材料文件',
  'JUNLEYUAN_LATEST_RESULT_MERGE_AUDIT.md'
]) {
  assert.ok(finalReport.includes(marker), `refactor final report lost current enterprise merge evidence: ${marker}`)
}
assert.doesNotMatch(finalReport, /企业站 25\/25/)
assert.doesNotMatch(finalReport, /251 个 Node 文件语法/)
for (const marker of [
  '42 个文件、5,140,758 字节',
  '9ab4082ff091231f4b000995d93f1b675f5f7970ee438b0a2cde524aa1380673',
  'candidate / approved=false / commercial_use=false / supplier_authorization_pending',
  '不代表启动 G4'
]) {
  assert.ok(junleyuanAudit.includes(marker), `Junleyuan latest-result audit lost required evidence: ${marker}`)
}
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
// Production Nginx serves the built company-site micro-frontend statically;
// only its authenticated/public API namespaces are proxied to the EISCore
// Agent Runtime. The old host.docker.internal:8092 assertion described the
// removed dev-only Vite proxy and made this exit gate stale.
assert.match(nginx, /location = \/company-site\/index\.html \{\s*root \/usr\/share\/nginx\/html;\s*try_files \$uri =404;\s*\}/s)
for (const namespace of ['admin', 'public', 'auth']) {
  assert.match(nginx, new RegExp(`location /company-site/${namespace}/ \u007b\\s*proxy_pass http://agent-runtime:8078/company-site/${namespace}/`))
}
assert.match(staticServer, /prefix:\s*'\/company-site',\s*target:\s*'http:\/\/127\.0\.0\.1:8092'/)
assert.doesNotMatch(e2e, /page\.route\(`\$\{HOST_URL\}\/company-site/)
assert.match(fullStackE2e, /status: 'suspended'/)
assert.match(fullStackE2e, /expect\(publicSuspended\.status\(\)\)\.toBe\(404\)/)
assert.match(fullStackE2e, /locator\('\.enterprise-profile-empty'\)/)
assert.match(fullStackE2e, /emptyProfile\.locator\('input, textarea'\)\)\.toHaveCount\(0\)/)
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
