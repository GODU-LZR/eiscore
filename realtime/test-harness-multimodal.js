'use strict';

const assert = require('node:assert/strict');
const { formatMultimodalResult, sanitizeMultimodalPayload } = require('./harness-multimodal');

const translation = sanitizeMultimodalPayload('eiscore_multimodal_translate', { text: ' hello ' });
assert.equal(translation.messages[1].content, 'hello');
assert.equal(translation.stream, false);
assert.deepEqual(formatMultimodalResult('eiscore_multimodal_translate', { choices: [{ message: { content: 'translated' } }] }), { text: 'translated' });

const ocr = sanitizeMultimodalPayload('eiscore_multimodal_ocr', { image_url: 'https://example.test/a.png' });
assert.equal(ocr.messages[0].content[1].image_url.url, 'https://example.test/a.png');
assert.deepEqual(formatMultimodalResult('eiscore_multimodal_ocr', { text: 'ocr' }), { text: 'ocr' });

const map = sanitizeMultimodalPayload('eiscore_multimodal_map_locate', { imageUrl: 'data:image/png;base64,AAAA', lat: 22.5, lng: 113.9 });
assert.match(map.messages[0].content[0].text, /113\.9,22\.5/);
assert.deepEqual(formatMultimodalResult('eiscore_multimodal_map_locate', { choices: [{ message: { content: '广东-深圳-南山-粤海街道' } }] }), { address: '广东-深圳-南山-粤海街道' });

assert.throws(() => sanitizeMultimodalPayload('eiscore_multimodal_translate', { text: 'x', api_key: 'secret' }), /unsupported authorization/);
assert.throws(() => sanitizeMultimodalPayload('eiscore_multimodal_ocr', { image_url: 'file:///etc/passwd' }), /http\(s\) URL/);
assert.throws(() => sanitizeMultimodalPayload('eiscore_multimodal_map_locate', { image_url: 'https://example.test/a.png', lat: 91 }), /coordinates are invalid/);
console.log('PASS: Harness multimodal payload and response boundaries');
