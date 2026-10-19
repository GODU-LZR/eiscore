import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  fallbackProductImageAfterError,
  resolveProductImageUrl
} from '../../eiscore-base/src/utils/product-image.mjs'

const images = {
  byCode: {
    'LUNDU-PUMP-WQ': '/enterprise-assets/site/framed/product-wq-card.jpg'
  },
  submersiblePump: '/enterprise-assets/site/framed/product-wq-card.jpg',
  pipelinePump: '/enterprise-assets/site/framed/product-pst-card.jpg',
  jetPump: '/enterprise-assets/site/framed/product-jet-card.jpg',
  singlePhaseMotor: '/enterprise-assets/site/framed/product-yc-card.jpg',
  threePhaseMotor: '/enterprise-assets/site/framed/product-ye3-card.jpg',
  motor: '/enterprise-assets/site/lundu-overview-motors.png'
}

assert.equal(resolveProductImageUrl({
  code: 'LUNDU-PUMP-WQ',
  imageUrl: '/published/verified-custom-pump.jpg'
}, images), '/published/verified-custom-pump.jpg')
assert.equal(resolveProductImageUrl({
  code: 'LUNDU-PUMP-WQ',
  imageUrl: ''
}, images), images.byCode['LUNDU-PUMP-WQ'])
assert.equal(resolveProductImageUrl({
  code: 'LUNDU-P-PUMP-001',
  name: '水泵 WQD15-15-2.2',
  category: '潜水',
  imageUrl: ''
}, images), images.submersiblePump)
assert.equal(resolveProductImageUrl({
  code: 'LUNDU-P-PUMP-006',
  name: '水泵 IS65-50-160',
  category: '管道泵',
  imageUrl: ''
}, images), images.pipelinePump)
assert.equal(resolveProductImageUrl({
  code: 'LUNDU-P-MOTOR-001',
  name: '三相异步电机 YE3-631-2',
  category: '交流电机',
  imageUrl: ''
}, images), images.threePhaseMotor)
assert.equal(resolveProductImageUrl({
  code: 'LUNDU-P-MOTOR-058',
  name: '单相异步电机 YC-90S-4',
  category: '交流电机',
  imageUrl: ''
}, images), images.singlePhaseMotor)
assert.equal(resolveProductImageUrl({
  code: 'LUNDU-P-PUMP-011',
  name: 'JET 自吸喷射泵',
  category: '自吸泵',
  imageUrl: ''
}, images), images.jetPump)
assert.equal(resolveProductImageUrl({
  code: 'LUNDU-P-MOTOR-PENDING',
  name: '三相异步电机（待补型号）',
  category: '交流电机',
  imageUrl: ''
}, images), images.motor)
assert.equal(resolveProductImageUrl({
  code: 'CUSTOM-001',
  name: '定制密封件',
  imageUrl: '/published/custom-seal.png'
}, images), '/published/custom-seal.png')
assert.equal(resolveProductImageUrl({
  code: 'CUSTOM-002',
  name: '未知产品',
  imageUrl: ''
}, images), '')
assert.equal(resolveProductImageUrl({
  code: 'OTHER-MOTOR-001',
  name: '交流电机 YE3-631-2',
  category: '交流电机',
  imageUrl: ''
}), '')
assert.equal(fallbackProductImageAfterError('/wrong-placeholder.jpg', {
  code: 'LUNDU-P-PUMP-001',
  name: '水泵 WQD15-15-2.2',
  category: '潜水',
  imageUrl: '/wrong-placeholder.jpg'
}, images), images.submersiblePump)
assert.equal(fallbackProductImageAfterError(images.submersiblePump, {
  code: 'LUNDU-P-PUMP-001',
  name: '水泵 WQD15-15-2.2',
  category: '潜水',
  imageUrl: images.submersiblePump
}, images), '')

const loginView = await readFile(new URL('../../eiscore-base/src/views/LoginView.vue', import.meta.url), 'utf8')
assert.match(loginView, /const imageUrl = resolveProductImageUrl\(product, PRODUCT_IMAGE_FALLBACKS\)/)
assert.match(loginView, /getEnterpriseConfig\(globalThis\).*?enterprise\?\.id === 'lundu'/)
assert.match(loginView, /imageUrl:\s*product\?\.imageUrl\s*\|\|\s*PRODUCT_IMAGE_FALLBACKS\.byCode\?\.\[manufacturingSeriesCodes\[index\]\]\s*\|\|\s*galleryImages\.value\[index\]\?\.url/)
assert.match(loginView, /@error="handleQuoteProductImageError\(\$event, item\)"/)
assert.match(loginView, /fallbackProductImageAfterError\([\s\S]*?getAttribute\('src'\)/)
assert.match(loginView, /storedQuotes\.map\(\(item\)\s*=>\s*\{[\s\S]*?publicProducts\.value\.find\(\(entry\)\s*=>\s*entry\.code\s*===\s*item\?\.code\)/)

console.log('lundu-product-image-regression: PASS')
