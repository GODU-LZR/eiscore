import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'eiscore-base/index.html'), 'utf8')
const mainSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/main.js'), 'utf8')
const mobileIndexSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/index.html'), 'utf8')
const mobileMainSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/main.js'), 'utf8')

const loadingScript = [...indexSource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((script) => script.includes("classList.add('has-eiscore-site-loading')"))
assert.ok(loadingScript, 'the loading ring must be enabled before application modules load')
for (const [pathname, expected] of [
  ['/', true],
  ['/index.html', true],
  ['/login', true],
  ['/login/', true],
  ['/services/quality-delivery', true],
  ['/services/technical-support', true],
  ['/hr/employees', false],
  ['/apps', false],
  ['/company-site', false],
  ['/settings', false],
  ['/logins', false],
  ['/index.html/other', false]
]) {
  const classes = new Set()
  runInNewContext(loadingScript, {
    location: { pathname },
    document: { documentElement: { classList: { add: (name) => classes.add(name) } } }
  })
  assert.equal(classes.has('has-eiscore-site-loading'), expected, `loading ring for ${pathname}`)
}

assert.match(indexSource, /id="eiscore-bootstrap-loading"/)
assert.match(indexSource, /display:\s*none/)
assert.match(indexSource, /has-eiscore-site-loading/)
assert.match(indexSource, /quality-delivery\|technical-support/)
assert.match(indexSource, /eiscore-bootstrap-loading__ring/)
assert.match(indexSource, /prefers-reduced-motion:\s*reduce/)
assert.match(indexSource, /animation:\s*eiscore-bootstrap-loading-spin/)
assert.match(indexSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*#eiscore-bootstrap-loading\s*\{[^}]*\}\s*\.eiscore-bootstrap-loading__ring\s*\{\s*animation:\s*none/s)
assert.match(mainSource, /dismissBootstrapLoading/)
assert.match(mainSource, /const waitForWindowLoad = \(\) =>/)
assert.match(mainSource, /const waitForPublicLandingContent = \(\) =>/)
assert.match(mainSource, /const waitForInitialPageResources = async \(\) =>/)
assert.match(mainSource, /const isPublicLanding = .*test\(window\.location\.pathname\)/)
assert.match(mainSource, /if \(!isPublicLanding\) return/)
assert.match(mainSource, /document\.fonts\?\.ready/)
assert.match(mainSource, /querySelectorAll\('#app img'\)/)
assert.match(mainSource, /waitWithTimeout\(new Promise/)
assert.match(mainSource, /await waitForInitialPageResources\(\)[\s\S]*dismissBootstrapLoading\(\)/)
assert.match(readFileSync(resolve(repoRoot, 'eiscore-base/src/views/LoginView.vue'), 'utf8'), /eiscore:initial-content-ready/)
assert.match(mainSource, /removeBootstrapLoading\(\)/)
assert.match(mobileIndexSource, /id="eiscore-bootstrap-loading"/)
assert.match(mobileIndexSource, /display:\s*none/)
assert.match(mobileIndexSource, /has-eiscore-site-loading/)
assert.match(mobileIndexSource, /mobile\\\/\)\?login/)
assert.match(mobileIndexSource, /eiscore-bootstrap-loading__ring/)
assert.match(mobileIndexSource, /animation:\s*eiscore-bootstrap-loading-spin/)
assert.match(mobileIndexSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*#eiscore-bootstrap-loading\s*\{[^}]*\}\s*\.eiscore-bootstrap-loading__ring\s*\{\s*animation:\s*none/s)
assert.match(mobileMainSource, /dismissBootstrapLoading/)
assert.match(mobileMainSource, /const waitForInitialPageResources = async \(\) =>/)
assert.match(mobileMainSource, /const isPublicLanding = .*test\(window\.location\.pathname\)/)
assert.match(mobileMainSource, /if \(!isPublicLanding\) return/)
assert.match(mobileMainSource, /waitForPublicLandingContent/)
assert.match(mobileMainSource, /removeBootstrapLoading\(\)/)
assert.match(readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/LoginView.vue'), 'utf8'), /eiscore:initial-content-ready/)

console.log('enterprise-bootstrap-loading-regression: PASS')
