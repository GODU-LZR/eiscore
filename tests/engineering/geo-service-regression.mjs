// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const moduleSource = read('shared/eis-geo-services.js')
const geo = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`)

assert.equal(geo.hasChinese('Guangdong'), false)
assert.equal(geo.hasChinese('广东 Guangdong'), true)

let config = {
  lang: 'zh-CN',
  ipApiUrl: 'https://geo.example/ip',
  ipLangParam: 'lang',
  reverseApiUrl: 'https://geo.example/reverse?lat={lat}&lng={lng}',
  reverseLangParam: 'accept-language',
  translateProvider: 'glm',
  translateApiUrl: '',
  translateLang: 'zh-CN',
  mapAiPrompt: '地图提示 113.9,22.5'
}
const calls = []
const responses = new Map([
  ['/agent/ai/translate', { text: '广东省深圳市' }],
  ['/agent/ai/map-locate', { address: '广东省-深圳市-南山区-粤海街道' }],
  ['https://geo.example/ip?lang=zh-CN', {
    ip: '203.0.113.10',
    latitude: 22.5,
    longitude: 113.9,
    country: '中国',
    city: '深圳市'
  }],
  ['https://geo.example/reverse?lat=22.5&lng=113.9&accept-language=zh-CN', {
    display_name: '广东省深圳市南山区'
  }]
])
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, options })
  const body = responses.get(url)
  return { ok: body !== undefined, json: async () => body }
}

const services = geo.createGeoServices({
  getConfig: () => config,
  getToken: () => 'test-token',
  fetchImpl
})

assert.equal(await services.translateText('Shenzhen'), '广东省深圳市')
assert.equal(await services.translateText('Shenzhen'), '广东省深圳市', 'translation should use the shared cache')
assert.equal(calls.filter(({ url }) => url === '/agent/ai/translate').length, 1)
const translateCall = calls.find(({ url }) => url === '/agent/ai/translate')
assert.equal(translateCall.options.method, 'POST')
assert.equal(translateCall.options.headers.Authorization, 'Bearer test-token')
assert.equal(JSON.parse(translateCall.options.body).text, 'Shenzhen')

assert.equal(
  await services.askGlmForMapLocation('data:image/png;base64,abc', 22.5, 113.9),
  '广东省-深圳市-南山区-粤海街道'
)
const mapCall = calls.find(({ url }) => url === '/agent/ai/map-locate')
assert.equal(mapCall.options.headers.Authorization, 'Bearer test-token')
assert.deepEqual(JSON.parse(mapCall.options.body), {
  imageUrl: 'data:image/png;base64,abc',
  lat: 22.5,
  lng: 113.9,
  prompt: '地图提示 113.9,22.5'
})

assert.deepEqual(await services.fetchIpLocation(), {
  lat: 22.5,
  lng: 113.9,
  address: '中国深圳市',
  ip: '203.0.113.10',
  source: 'ip'
})
assert.equal(await services.fetchReverseAddress(22.5, 113.9), '广东省深圳市南山区')

config = {
  ...config,
  translateProvider: 'external',
  translateApiUrl: 'https://translate.example/text?key=public',
  translateMethod: 'get',
  translateTextField: 'q',
  translateSourceField: 'source',
  translateTargetField: 'target',
  translateExtra: { format: 'text' },
  translateResultField: ''
}
responses.set(
  'https://translate.example/text?key=public&format=text&q=Street&source=auto&target=zh-CN',
  { translatedText: '街道' }
)
assert.equal(await services.translateText('Street'), '街道')

config = {
  ...config,
  translateApiUrl: 'https://translate.example/post',
  translateMethod: 'post',
  translateResultField: 'payload.value'
}
responses.set('https://translate.example/post', { payload: { value: '工业园' } })
assert.equal(await services.translateText('Industrial park'), '工业园')
const externalPost = calls.find(({ url }) => url === 'https://translate.example/post')
assert.deepEqual(externalPost.options.headers, { 'Content-Type': 'application/json' })
assert.deepEqual(JSON.parse(externalPost.options.body), {
  format: 'text',
  q: 'Industrial park',
  source: 'auto',
  target: 'zh-CN'
})

const failing = geo.createGeoServices({
  getConfig: () => ({ translateProvider: 'glm' }),
  getToken: () => '',
  fetchImpl: async () => { throw new Error('offline') }
})
assert.equal(await failing.translateText('Original'), 'Original')
assert.equal(await failing.askGlmForMapLocation('', 0, 0), '')
assert.equal(await failing.fetchIpLocation(), null)
assert.equal(await failing.fetchReverseAddress(0, 0), '')

const geoDialogSources = [
  'shared/eis-data-grid-v2/components/GeoDialog.vue',
  'eiscore-apps/src/components/eis-data-grid-v2/components/GeoDialog.vue'
]
for (const path of geoDialogSources) {
  const component = read(path)
  assert.match(
    component,
    /from\s*['"]@shared\/eis-geo-services['"]/
  )
  assert.match(component, /createGeoServices\(\{\s*getConfig:\s*getGeoConfig,\s*getToken\s*\}\)/)
  assert.doesNotMatch(component, /\bfetch\s*\(/)
}

for (const app of ['equipment', 'hr', 'materials', 'production', 'purchase', 'quality', 'sales']) {
  const entry = read(`eiscore-${app}/src/components/eis-data-grid-v2/index.vue`)
  assert.match(
    entry,
    /import GeoDialog from ['"]@shared\/eis-data-grid-v2\/components\/GeoDialog\.vue['"]/
  )
}

assert.equal([...moduleSource.matchAll(/\bglobalThis\.fetch\s*\(/g)].length, 1)
assert.doesNotMatch(moduleSource, /localStorage|auth_token|user_info|\/api\//)
console.log('PASS: shared Geo service preserves translation and location request semantics (2 implementations, 8 consumers)')
