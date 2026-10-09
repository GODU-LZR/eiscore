// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const text = (value, fallback = '') => String(value ?? fallback ?? '').trim()
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

const safePublicUrl = (value) => {
  const raw = text(value)
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const hostname = url.hostname.toLowerCase()
    const isLocal = hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '127.0.0.1'
      || hostname === '::1'
    return url.protocol === 'https:' && !url.username && !url.password && !isLocal ? url.toString() : ''
  } catch {
    return ''
  }
}

const publicAssetUrl = (value, canonical) => {
  const raw = text(value)
  const absolute = safePublicUrl(raw)
  if (absolute) return absolute
  if (!raw.startsWith('/') || !canonical) return ''
  try {
    return new URL(raw, canonical).toString()
  } catch {
    return ''
  }
}

const canonicalFromProfile = (profile, pathname) => {
  const explicit = safePublicUrl(profile?.seo?.canonical)
  if (explicit) return explicit
  const domain = text(profile?.domain).replace(/\/+$/, '')
  if (!domain) return ''
  const candidate = /^https:\/\//i.test(domain) ? domain : `https://${domain}`
  try {
    const origin = safePublicUrl(`${candidate}/`)
    return origin ? new URL(pathname || '/login', origin).toString() : ''
  } catch {
    return ''
  }
}

const compactObject = (value) => Object.fromEntries(
  Object.entries(value).filter(([, entry]) => entry !== '' && entry !== null && entry !== undefined)
)

const structuredDataFromProfile = (profile, canonical, logoUrl) => {
  const portal = isObject(profile?.portal) ? profile.portal : {}
  const configured = isObject(profile?.seo?.structuredData) ? profile.seo.structuredData : null
  const organizationId = canonical ? `${canonical}#organization` : ''
  const websiteId = canonical ? `${canonical}#website` : ''
  const graph = []

  graph.push(compactObject({
    '@type': 'Organization',
    '@id': organizationId,
    name: text(profile?.displayName || profile?.legalName),
    legalName: text(profile?.legalName),
    url: canonical,
    logo: logoUrl,
    description: text(profile?.description),
    email: text(profile?.contact?.email),
    telephone: text(profile?.contact?.phone),
    address: text(profile?.contact?.address)
  }))

  if (canonical) {
    graph.push(compactObject({
      '@type': 'WebSite',
      '@id': websiteId,
      url: canonical,
      name: text(profile?.displayName || profile?.legalName),
      inLanguage: text(profile?.locale || profile?.defaultLocale, 'zh-CN'),
      publisher: organizationId ? { '@id': organizationId } : undefined
    }))
  }

  for (const product of Array.isArray(portal.products) ? portal.products : []) {
    const name = text(product?.name)
    if (!name) continue
    graph.push(compactObject({
      '@type': 'Product',
      name,
      sku: text(product?.code),
      category: text(product?.category),
      description: text(product?.summary),
      brand: organizationId ? { '@id': organizationId } : { '@type': 'Brand', name: text(profile?.displayName) }
    }))
  }

  const faq = (Array.isArray(portal.faq) ? portal.faq : [])
    .map((item) => {
      const name = text(item?.question)
      const answer = text(item?.answer)
      return name && answer
        ? { '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer } }
        : null
    })
    .filter(Boolean)
  if (faq.length) graph.push({ '@type': 'FAQPage', mainEntity: faq })

  if (configured) graph.push(configured)
  return { '@context': 'https://schema.org', '@graph': graph }
}

export function buildEnterpriseSeoHead(profile, { pathname = '/login' } = {}) {
  const seo = isObject(profile?.seo) ? profile.seo : {}
  const locale = text(profile?.locale || profile?.defaultLocale, 'zh-CN')
  const canonical = canonicalFromProfile(profile, pathname)
  const shareImage = publicAssetUrl(
    seo.image || seo.imageUrl || profile?.portal?.loginBranding?.shareImage,
    canonical
  )
  const shareImageAlt = text(seo.imageAlt, text(profile?.displayName || profile?.legalName))
  const logoUrl = publicAssetUrl(profile?.logoUrl, canonical)
  const keywords = Array.isArray(seo.keywords)
    ? seo.keywords.map((item) => text(item)).filter(Boolean)
    : text(seo.keywords).split(',').map((item) => item.trim()).filter(Boolean)
  const title = text(seo.title, text(profile?.displayName || profile?.legalName))
  const description = text(seo.description, text(profile?.description))
  const configuredRobots = text(seo.robots, 'index,follow')
  const robots = profile?.status && profile.status !== 'published'
    ? 'noindex,nofollow'
    : configuredRobots
  const alternates = canonical
    ? (Array.isArray(profile?.enabledLocales) ? profile.enabledLocales : [locale]).map((entry) => ({
        locale: text(entry),
        href: `${canonical}${canonical.includes('?') ? '&' : '?'}lang=${encodeURIComponent(text(entry))}`
      })).filter((entry) => entry.locale)
    : []

  return Object.freeze({
    lang: locale,
    title,
    description,
    keywords,
    robots,
    canonical,
    alternates: Object.freeze(alternates.map(Object.freeze)),
    openGraph: Object.freeze(compactObject({
      'og:type': 'website',
      'og:title': title,
      'og:description': description,
      'og:url': canonical,
      'og:site_name': text(profile?.displayName || profile?.legalName),
      'og:locale': locale.replace('-', '_'),
      'og:image': shareImage,
      'og:image:alt': shareImageAlt,
      'og:image:width': shareImage ? '1200' : '',
      'og:image:height': shareImage ? '630' : ''
    })),
    twitter: Object.freeze(compactObject({
      'twitter:card': shareImage ? 'summary_large_image' : 'summary',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': shareImage,
      'twitter:image:alt': shareImageAlt
    })),
    favicon: publicAssetUrl(profile?.faviconUrl, canonical),
    appleTouchIcon: publicAssetUrl(profile?.faviconUrl, canonical),
    structuredData: structuredDataFromProfile(profile, canonical, logoUrl)
  })
}

export function applyEnterpriseSeoHead(documentRef, head) {
  if (!documentRef?.head || !documentRef?.documentElement || !head) return () => {}
  const marker = 'data-eiscore-enterprise-head'
  const previousTitle = documentRef.title
  const previousLang = documentRef.documentElement.getAttribute('lang')
  documentRef.head.querySelectorAll(`[${marker}]`).forEach((node) => node.remove())
  documentRef.title = text(head.title, previousTitle)
  documentRef.documentElement.setAttribute('lang', text(head.lang, 'zh-CN'))

  const append = (tagName, attributes, content = '') => {
    const node = documentRef.createElement(tagName)
    node.setAttribute(marker, 'true')
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)))
    if (content) node.textContent = content
    documentRef.head.appendChild(node)
  }
  const meta = (name, content, property = false) => {
    if (text(content)) append('meta', { [property ? 'property' : 'name']: name, content: text(content) })
  }

  const icon = (id, rel, href, type = '') => {
    if (!text(href)) return
    const node = documentRef.createElement('link')
    node.setAttribute(marker, 'true')
    node.id = id
    node.rel = rel
    node.href = href
    if (type) node.type = type
    documentRef.head.appendChild(node)
  }

  meta('description', head.description)
  meta('keywords', Array.isArray(head.keywords) ? head.keywords.join(', ') : head.keywords)
  meta('robots', head.robots)
  Object.entries(head.openGraph || {}).forEach(([name, content]) => meta(name, content, true))
  Object.entries(head.twitter || {}).forEach(([name, content]) => meta(name, content))
  icon('enterprise-share-favicon', 'icon', head.favicon, 'image/svg+xml')
  icon('enterprise-share-apple-touch-icon', 'apple-touch-icon', head.appleTouchIcon)
  if (head.canonical) append('link', { rel: 'canonical', href: head.canonical })
  for (const alternate of head.alternates || []) {
    append('link', { rel: 'alternate', hreflang: alternate.locale, href: alternate.href })
  }
  if (head.structuredData?.['@graph']?.length) {
    append('script', { type: 'application/ld+json' }, JSON.stringify(head.structuredData))
  }

  return () => {
    documentRef.head.querySelectorAll(`[${marker}]`).forEach((node) => node.remove())
    documentRef.title = previousTitle
    if (previousLang === null) documentRef.documentElement.removeAttribute('lang')
    else documentRef.documentElement.setAttribute('lang', previousLang)
  }
}
