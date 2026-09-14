// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const text = (value) => String(value || '').trim()

export function resolveEnterpriseOperationsTitle(site) {
  const enterpriseName = text(site?.brandName || site?.brand_name || site?.legalName || site?.legal_name)
  return enterpriseName ? `${enterpriseName}｜企业站点运营｜EISCore` : '企业站点运营｜EISCore'
}

export function resolveEnterpriseFaviconUrl(site) {
  const trademark = site?.trademark && typeof site.trademark === 'object' ? site.trademark : {}
  const candidate = text(
    trademark.faviconAssetPath ||
    trademark.favicon_asset_path ||
    trademark.faviconUrl ||
    trademark.favicon_url ||
    site?.faviconUrl ||
    site?.favicon_url
  )
  if (candidate.startsWith('assets/') && !candidate.includes('..') && !candidate.includes('\\')) {
    return `/company-site/enterprise-assets/${candidate.slice('assets/'.length)}`
  }
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('..') && !candidate.includes('\\')) {
    return candidate
  }
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.toString() : ''
  } catch {
    return ''
  }
}

const updateIcon = (documentTarget, id, rel, href) => {
  let element = documentTarget.getElementById(id)
  if (!element) {
    element = documentTarget.createElement('link')
    element.id = id
    element.rel = rel
    documentTarget.head?.appendChild(element)
  }
  if (!element) return
  element.rel = rel
  element.href = href
  if (rel === 'icon') element.type = 'image/svg+xml'
}

export function applyEnterpriseDocumentBranding(site, documentTarget = globalThis.document) {
  if (!documentTarget) return
  documentTarget.title = resolveEnterpriseOperationsTitle(site)
  const faviconUrl = resolveEnterpriseFaviconUrl(site)
  if (!faviconUrl) return
  updateIcon(documentTarget, 'enterprise-favicon', 'icon', faviconUrl)
  updateIcon(documentTarget, 'enterprise-apple-touch-icon', 'apple-touch-icon', faviconUrl)
}
