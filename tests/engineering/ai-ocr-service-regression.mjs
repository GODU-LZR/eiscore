// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { createAiOcrService } = require('../../realtime/ai-ocr-service')
const repoRoot = resolve(import.meta.dirname, '../..')

const calls = []
const results = [
  { ok: true, config: { model: 'upstream-model' }, data: { text: '  first text  ' } },
  { ok: false, status: 429, payload: { detail: 'rate limited' } },
  new Error('vision crashed'),
  { ok: true, config: {}, data: { text: 'fourth' } },
  { ok: true, config: {}, data: { text: 'fifth' } },
  { ok: true, config: {}, data: { text: 'sixth' } },
  { ok: true, config: {}, data: { text: '' } }
]
const config = {
  model: 'vision-model',
  temperature: 0.2,
  max_tokens: 512,
  ocr_max_tokens: 2048,
  ocr_prompt: 'configured OCR prompt'
}
const service = createAiOcrService({
  getAiVisionConfig: async () => config,
  callAiVisionUpstreamWithRetry: async (payload, options, retry) => {
    calls.push({ payload, options, retry })
    const result = results.shift()
    if (result instanceof Error) throw result
    return result
  },
  normalizeText: (value) => String(value || '').trim(),
  cleanModelText: (value) => String(value || '').trim(),
  extractCompletionText: (data) => data?.text || ''
})

const direct = await service.runImageOcr('https://images.example/direct.png', 'explicit prompt')
assert.deepEqual(direct, { ok: true, model: 'upstream-model', text: 'first text' })
assert.equal(calls[0].payload.model, 'vision-model')
assert.equal(calls[0].payload.temperature, 0.2)
assert.equal(calls[0].payload.max_tokens, 2048)
assert.deepEqual(calls[0].payload.messages[0].content, [
  { type: 'text', text: 'explicit prompt' },
  { type: 'image_url', image_url: { url: 'https://images.example/direct.png' } }
])
assert.deepEqual(calls[0].options, { cfg: config })
assert.deepEqual(calls[0].retry, { maxRetries: 1, baseDelayMs: 480 })

const messages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'question' },
      { type: 'image_url', image_url: { url: 'https://images.example/1.png' } },
      { type: 'image_url', url: 'https://images.example/2.png' },
      { type: 'image_url', image_url: { url: 'https://images.example/3.png' } },
      { type: 'image_url', image_url: { url: 'https://images.example/4.png' } },
      { type: 'image_url', image_url: { url: 'https://images.example/5.png' } },
      { type: 'image_url', image_url: { url: 'https://images.example/6.png' } },
      { type: 'image_url', image_url: { url: 'https://images.example/7.png' } }
    ]
  },
  { role: 'assistant', content: 'unchanged' }
]
const enriched = await service.enrichMessagesWithOcr(messages)
assert.equal(calls.length, 7, 'one direct OCR plus six message images; the seventh message image is capped')
assert.equal(enriched.ocr.length, 6)
assert.deepEqual(enriched.ocr.slice(0, 2), [
  { ok: false, text: '', error: 'rate limited', status: 429 },
  { ok: false, text: '', error: 'vision crashed' }
])
assert.match(enriched.messages[0].content, /^question/)
assert.match(enriched.messages[0].content, /【图片1 OCR识别失败】rate limited/)
assert.match(enriched.messages[0].content, /【图片2 OCR识别失败】vision crashed/)
assert.match(enriched.messages[0].content, /【图片3 OCR识别结果】\nfourth/)
assert.match(enriched.messages[0].content, /【图片6 OCR识别失败】未识别到文字/)
assert.equal(enriched.messages[1], messages[1])

const noImages = [{ role: 'user', content: 'plain text' }]
assert.deepEqual(await service.enrichMessagesWithOcr(noImages), { messages: noImages, ocr: [] })

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/ai-ocr-service'\)/)
assert.match(compositionRoot, /createAiOcrService\(/)
assert.doesNotMatch(compositionRoot, /const (runImageOcr|enrichMessagesWithOcr|extractImageUrlsFromMessages|replaceImagesWithOcrText|hasImageContent)/)

console.log('PASS: AI OCR service preserves prompt/config payloads, retry policy, six-image cap, ordered per-image fallback and message replacement')
