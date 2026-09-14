// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})
const asArray = (value) => (Array.isArray(value) ? value : [])
const asText = (value, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback)

const normalizeCard = (item, index) => {
  const source = asObject(item)
  return {
    id: asText(source.slug || source.productCode, `item-${index + 1}`),
    code: asText(source.productCode),
    name: asText(source.name || source.title, `内容 ${index + 1}`),
    category: asText(source.category || source.industry),
    summary: asText(source.summary || source.description),
    applications: asArray(source.applications).map((entry) => asText(entry)).filter(Boolean)
  }
}

const normalizeMetric = (item, index) => {
  const source = asObject(item)
  return {
    id: `metric-${index + 1}`,
    name: asText(source.value, `—`),
    category: asText(source.label),
    summary: ''
  }
}

export function normalizeEnterprisePreview(payload = {}) {
  const root = asObject(payload)
  const manifest = asObject(root.manifest)
  const runtime = asObject(root.runtime)
  const seed = asObject(root.seed)
  const site = asObject(seed.site)
  const content = asObject(seed.content)
  const home = asArray(content.pages).find((page) => page?.slug === 'home') || asArray(content.pages)[0] || {}
  const homepage = asObject(asObject(home.blocks).homepage)
  const hero = asObject(homepage.hero)
  const theme = asObject(site.theme)
  const settings = asObject(site.settings)
  const governance = asObject(seed.governance)
  const runtimeEnterprise = asObject(runtime.enterprise)

  const enterpriseName = asText(site.legalName, asText(runtimeEnterprise.displayName, '企业案例'))
  const brandName = asText(site.brandName, asText(runtimeEnterprise.shortName, enterpriseName))
  const titleLines = asArray(hero.titleLines).map((entry) => asText(entry)).filter(Boolean)

  return {
    enterpriseName,
    brandName,
    previewLabel: asText(settings.previewLabel, '企业案例预览'),
    packageStatus: asText(manifest.status, 'draft'),
    factStatus: asText(governance.factStatus, 'pending'),
    theme: {
      ink: asText(theme.inkColor, '#19372e'),
      paper: asText(theme.paperColor, '#fffaf0'),
      accent: asText(theme.accentColor || theme.accent, '#f0a83b'),
      primary: asText(theme.primaryColor, '#216b54')
    },
    hero: {
      eyebrow: asText(hero.eyebrow, enterpriseName),
      titleLines: titleLines.length ? titleLines : [asText(home.title, brandName)],
      summary: asText(hero.summary, asText(home.summary)),
      signals: asArray(hero.signals).map((entry) => asText(entry)).filter(Boolean)
    },
    metrics: asArray(homepage.metrics).map(normalizeMetric),
    businessChain: asArray(homepage.businessChain).map((item, index) => ({
      ...normalizeCard(item, index),
      number: asText(item?.number, String(index + 1).padStart(2, '0'))
    })),
    capabilities: asArray(homepage.capabilities).map(normalizeCard),
    products: asArray(content.products).map(normalizeCard),
    solutions: asArray(content.solutions).map(normalizeCard),
    footerNote: asText(homepage.footerNote, asText(governance.notes)),
    isProductionApproved: manifest.status === 'approved' && manifest.governance?.productionApproved === true
  }
}
