// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { enterpriseShareMetadataPlugin } from '../../scripts/vite-enterprise-share-metadata.mjs'

const previousOrigin = process.env.VITE_ENTERPRISE_SHARE_ORIGIN
const previousImage = process.env.VITE_ENTERPRISE_SHARE_IMAGE
const previousFavicon = process.env.VITE_ENTERPRISE_FAVICON
const previousTitle = process.env.VITE_ENTERPRISE_SHARE_TITLE
const previousDescription = process.env.VITE_ENTERPRISE_SHARE_DESCRIPTION
process.env.VITE_ENTERPRISE_SHARE_ORIGIN = 'https://lundu.eiscore.top'
process.env.VITE_ENTERPRISE_SHARE_IMAGE = '/enterprise-assets/site/share-card.jpg'
process.env.VITE_ENTERPRISE_FAVICON = '/enterprise-assets/site/favicon.svg'
process.env.VITE_ENTERPRISE_SHARE_TITLE = '伦度机电｜电机与水泵制造'
process.env.VITE_ENTERPRISE_SHARE_DESCRIPTION = '伦度机电有限公司电机与水泵制造商。'
try {
  const plugin = enterpriseShareMetadataPlugin()
  const html = plugin.transformIndexHtml.handler('<html><head><title>EISCore</title></head><body></body></html>')
  const lunduHtml = html
  assert.match(html, /<title>伦度机电｜电机与水泵制造<\/title>/)
  assert.match(lunduHtml, /property="og:image" content="https:\/\/lundu\.eiscore\.top\/enterprise-assets\/site\/share-card\.jpg"/)
  assert.match(lunduHtml, /property="og:image:width" content="1200"/)
  assert.match(lunduHtml, /property="og:image:height" content="630"/)
  assert.match(lunduHtml, /name="twitter:card" content="summary_large_image"/)
  assert.match(lunduHtml, /rel="icon" href="https:\/\/lundu\.eiscore\.top\/enterprise-assets\/site\/favicon\.svg"/)
  assert.doesNotMatch(lunduHtml, /<title>EISCore<\/title>/)
} finally {
  if (previousOrigin === undefined) delete process.env.VITE_ENTERPRISE_SHARE_ORIGIN
  else process.env.VITE_ENTERPRISE_SHARE_ORIGIN = previousOrigin
  if (previousImage === undefined) delete process.env.VITE_ENTERPRISE_SHARE_IMAGE
  else process.env.VITE_ENTERPRISE_SHARE_IMAGE = previousImage
  if (previousFavicon === undefined) delete process.env.VITE_ENTERPRISE_FAVICON
  else process.env.VITE_ENTERPRISE_FAVICON = previousFavicon
  if (previousTitle === undefined) delete process.env.VITE_ENTERPRISE_SHARE_TITLE
  else process.env.VITE_ENTERPRISE_SHARE_TITLE = previousTitle
  if (previousDescription === undefined) delete process.env.VITE_ENTERPRISE_SHARE_DESCRIPTION
  else process.env.VITE_ENTERPRISE_SHARE_DESCRIPTION = previousDescription
}

console.log('enterprise-share-metadata-regression: PASS')
