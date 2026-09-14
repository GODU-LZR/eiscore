// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const COMPANY_SITE_CAPABILITIES = Object.freeze({
  salesDrafts: false,
  customerMatch: false,
  keywordMapReport: false,
  factGovernance: false,
  geoSnapshots: true,
  contentTypes: Object.freeze({
    pages: true,
    products: true,
    productLocales: true,
    solutions: true,
    cases: true,
    certificates: false,
    downloads: false,
    evidence: true,
    knowledge: true,
    seo: true,
    keywords: true,
    externalProfiles: false
  })
})

export const isCompanyContentTypeEnabled = (type) => (
  COMPANY_SITE_CAPABILITIES.contentTypes[String(type || '')] === true
)
