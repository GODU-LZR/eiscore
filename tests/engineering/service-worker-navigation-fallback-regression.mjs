import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../../eiscore-base/public/sw.js', import.meta.url), 'utf8')
const helper = source.match(/function getNavigationFallback\(pathname\) \{[\s\S]*?\n\}/)?.[0]

assert.ok(helper, 'service worker must define a navigation fallback policy')
assert.match(source, /networkFirst\(event\.request, getNavigationFallback\(url\.pathname\)\)/)

const getNavigationFallback = vm.runInNewContext(`(${helper})`)
assert.equal(getNavigationFallback('/apps/preview/flash-draft'), '/apps/index.html')
assert.equal(getNavigationFallback('/apps/preview/other'), '/apps/index.html')
assert.equal(getNavigationFallback('/apps/'), '/index.html')
assert.equal(getNavigationFallback('/login'), '/index.html')

console.log('service worker navigation fallback regression passed')
