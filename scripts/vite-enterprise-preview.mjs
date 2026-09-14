// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { lstatSync, readFileSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const packsRoot = resolve(repoRoot, 'enterprise-packs')
const previewPaths = new Set(['/company-site/__enterprise-preview', '/__enterprise-preview'])
// The platform client uses the canonical company-site path. Keep the legacy
// agent-prefixed path as a compatibility alias for older preview clients.
const publicSiteConfigPaths = new Set([
  '/company-site/public/site-config',
  '/agent/company-site/public/site-config'
])
const publicAssetPrefix = '/enterprise-assets/'
const publicAssetContentTypes = Object.freeze({
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
})

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const resolvePackRoot = (packInput) => {
  if (!packInput) return null
  const candidate = resolve(repoRoot, packInput)
  const fromPacks = relative(packsRoot, candidate)
  if (!fromPacks || fromPacks === '..' || fromPacks.startsWith(`..${sep}`)) return null
  return candidate
}

const loadPreviewPack = (packRoot) => ({
  manifest: readJson(resolve(packRoot, 'manifest.json')),
  runtime: readJson(resolve(packRoot, 'runtime', 'eiscore-enterprise.json')),
  seed: readJson(resolve(packRoot, 'data', 'company-site.json'))
})

const servePreviewAsset = (pathname, packRoot, res) => {
  if (!pathname.startsWith(publicAssetPrefix)) return false
  const assetsRoot = resolve(packRoot, 'assets')
  let suffix = ''
  try {
    suffix = decodeURIComponent(pathname.slice(publicAssetPrefix.length))
  } catch {
    res.statusCode = 400
    res.end('Invalid asset path')
    return true
  }
  if (!suffix || suffix.includes('\\') || suffix.split('/').includes('..')) {
    res.statusCode = 404
    res.end('Asset not found')
    return true
  }
  const assetPath = resolve(assetsRoot, suffix)
  const relativePath = relative(assetsRoot, assetPath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
    res.statusCode = 404
    res.end('Asset not found')
    return true
  }
  try {
    const stats = lstatSync(assetPath)
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('not a regular file')
    const contentType = publicAssetContentTypes[extname(assetPath).toLowerCase()]
    if (!contentType) throw new Error('unsupported asset type')
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stats.size)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(readFileSync(assetPath))
  } catch {
    res.statusCode = 404
    res.end('Asset not found')
  }
  return true
}

const asPublicSitePayload = ({ manifest, seed }, requestedLocale = '') => {
  const sourceSite = seed.site || {}
  const content = seed.content || {}
  const defaultLocale = sourceSite.defaultLocale || 'zh-CN'
  const enabledLocales = Array.isArray(sourceSite.enabledLocales) && sourceSite.enabledLocales.length
    ? sourceSite.enabledLocales
    : [defaultLocale]
  const locale = enabledLocales.includes(requestedLocale) ? requestedLocale : defaultLocale
  const localeCandidates = [...new Set([locale, defaultLocale])]
  const localized = (items, key = 'slug') => {
    const picked = new Map()
    for (const candidate of localeCandidates) {
      for (const item of Array.isArray(items) ? items : []) {
        if ((item?.locale || defaultLocale) !== candidate) continue
        const itemKey = item?.[key] || item?.id || `${candidate}-${picked.size}`
        if (!picked.has(itemKey)) picked.set(itemKey, item)
      }
    }
    return [...picked.values()]
  }
  const productLocales = localized(content.productLocales, 'productCode')
  const productLocaleByCode = new Map(productLocales.map((item) => [item.productCode, item]))
  const products = (content.products || []).map((item) => {
    const translation = productLocaleByCode.get(item.productCode) || {}
    return {
      ...item,
      ...translation,
      applications: translation.applications || item.applications || [],
      seo: translation.seo || item.seo || {}
    }
  })
  const seoRecords = localized(content.seo, 'path')
  return {
    ok: true,
    site: {
      siteKey: seed.siteKey || 'primary',
      legalName: sourceSite.legalName || '',
      brandName: sourceSite.brandName || '',
      brandShortName: sourceSite.brandShortName || '',
      factoryName: sourceSite.factoryName || '',
      domain: '',
      template: sourceSite.templateKey || 'manufacturer-editorial-v1',
      defaultLocale,
      enabledLocales,
      theme: sourceSite.theme || {},
      contact: sourceSite.contact || {},
      socialLinks: sourceSite.socialLinks || {},
      trademark: {
        ...(sourceSite.trademark || {}),
        asset: sourceSite.trademark?.logoAssetPath
          ? `/company-site/${sourceSite.trademark.logoAssetPath}`
          : ''
      },
      settings: {
        ...(sourceSite.settings || {}),
        publicPath: '/login'
      },
      seo: { ...(sourceSite.seo || {}), ...(seoRecords[0] || {}) },
      status: 'draft-preview',
      publishedVersion: 0,
      publishedAt: null
    },
    content: {
      requestedLocale: locale,
      locales: enabledLocales.map((entry) => ({
        locale: entry,
        fallback_locale: '',
        status: 'draft',
        translation_owner: `enterprise-pack:${manifest.packageId}`
      })),
      pages: localized(content.pages),
      products,
      solutions: localized(content.solutions),
      cases: localized(content.cases),
      faq: localized((content.knowledge || []).filter((item) => item?.documentType === 'faq'), 'title'),
      seo: seoRecords,
      keywords: localized(content.keywords, 'keyword')
    },
    governance: {
      factStatus: seed.governance?.factStatus || manifest.governance?.factStatus || 'pending',
      productionApproved: manifest.governance?.productionApproved === true,
      packageStatus: manifest.status || 'draft'
    }
  }
}

export function enterprisePreviewPlugin(packInput) {
  const packRoot = resolvePackRoot(packInput)

  return {
    name: 'eiscore-enterprise-preview',
    apply: 'serve',
    configureServer(server) {
      if (!packRoot) return
      server.middlewares.use((req, res, next) => {
        const pathname = String(req.url || '').split('?')[0]
        if (servePreviewAsset(pathname, packRoot, res)) return
        const isPreviewRequest = previewPaths.has(pathname)
        const isPublicSiteRequest = publicSiteConfigPaths.has(pathname)
        if (!isPreviewRequest && !isPublicSiteRequest) return next()

        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        try {
          const pack = loadPreviewPack(packRoot)
          const requestUrl = new URL(req.url || '/', 'http://enterprise-preview.local')
          const payload = isPublicSiteRequest
            ? asPublicSitePayload(pack, requestUrl.searchParams.get('locale') || '')
            : { ok: true, ...pack }
          res.statusCode = 200
          res.end(JSON.stringify(payload))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, message: '本地企业案例预览包读取失败', detail: error.message }))
        }
      })
    }
  }
}
