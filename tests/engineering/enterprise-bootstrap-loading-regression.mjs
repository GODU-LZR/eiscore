import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'eiscore-base/index.html'), 'utf8')
const mainSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/main.js'), 'utf8')
const mobileIndexSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/index.html'), 'utf8')
const mobileMainSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/main.js'), 'utf8')

assert.match(indexSource, /id="eiscore-bootstrap-loading"/)
assert.match(indexSource, /eiscore-bootstrap-loading__ring/)
assert.match(indexSource, /prefers-reduced-motion:\s*reduce/)
assert.match(indexSource, /animation:\s*eiscore-bootstrap-loading-spin/)
assert.match(mainSource, /dismissBootstrapLoading/)
assert.match(mainSource, /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame\(dismissBootstrapLoading\)/)
assert.match(mainSource, /removeBootstrapLoading\(\)/)
assert.match(mobileIndexSource, /id="eiscore-bootstrap-loading"/)
assert.match(mobileIndexSource, /eiscore-bootstrap-loading__ring/)
assert.match(mobileMainSource, /dismissBootstrapLoading/)
assert.match(mobileMainSource, /removeBootstrapLoading\(\)/)

console.log('enterprise-bootstrap-loading-regression: PASS')
