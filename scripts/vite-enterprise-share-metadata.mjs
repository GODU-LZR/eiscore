// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const text = (value, fallback = '') => String(value ?? fallback ?? '').trim()

const escapeHtml = (value) => text(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const readEnterpriseConfig = (root) => {
  try {
    return JSON.parse(readFileSync(resolve(root, 'public/config/eiscore-enterprise.json'), 'utf8'))
  } catch {
    return {}
  }
}

export function enterpriseShareMetadataPlugin({ root = resolve(import.meta.dirname, '..', 'eiscore-base') } = {}) {
  return {
    name: 'eiscore-enterprise-share-metadata',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const config = readEnterpriseConfig(root)
        const login = config.branding?.login || {}
        const title = text(
          process.env.VITE_ENTERPRISE_SHARE_TITLE,
          text(login.shareTitle, text(login.siteTitle, text(config.enterprise?.displayName, 'EISCore')))
        )
        const description = text(
          process.env.VITE_ENTERPRISE_SHARE_DESCRIPTION,
          text(login.shareDescription, text(login.description, ''))
        )
        const image = text(process.env.VITE_ENTERPRISE_SHARE_IMAGE)
        const origin = text(process.env.VITE_ENTERPRISE_SHARE_ORIGIN).replace(/\/+$/, '')
        const absolute = (value) => value.startsWith('/') && origin ? `${origin}${value}` : value
        const favicon = text(process.env.VITE_ENTERPRISE_FAVICON, '/favicon.ico')
        const appleTouchIcon = text(process.env.VITE_ENTERPRISE_APPLE_TOUCH_ICON, favicon)
        const siteName = text(config.enterprise?.displayName, title)
        const tags = [
          `<title>${escapeHtml(title)}</title>`,
          `<meta name="description" content="${escapeHtml(description)}">`,
          `<meta name="theme-color" content="${escapeHtml(config.branding?.themeColor || '#1557A6')}">`,
          `<meta property="og:type" content="website">`,
          `<meta property="og:title" content="${escapeHtml(title)}">`,
          `<meta property="og:description" content="${escapeHtml(description)}">`,
          `<meta property="og:url" content="${escapeHtml(absolute('/login'))}">`,
          `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
          image ? `<meta property="og:image" content="${escapeHtml(absolute(image))}">` : '',
          image ? '<meta property="og:image:width" content="1200">' : '',
          image ? '<meta property="og:image:height" content="630">' : '',
          image ? `<meta property="og:image:alt" content="${escapeHtml(siteName)}">` : '',
          `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
          `<meta name="twitter:title" content="${escapeHtml(title)}">`,
          `<meta name="twitter:description" content="${escapeHtml(description)}">`,
          image ? `<meta name="twitter:image" content="${escapeHtml(absolute(image))}">` : '',
          `<link rel="icon" href="${escapeHtml(absolute(favicon))}">`,
          `<link rel="apple-touch-icon" href="${escapeHtml(absolute(appleTouchIcon))}">`
        ].join('\n    ')
        return html.replace(/\s*<title>.*?<\/title>/is, '').replace('</head>', `    ${tags}\n  </head>`)
      }
    }
  }
}
