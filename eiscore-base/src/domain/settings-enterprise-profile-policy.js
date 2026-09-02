// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const text = (value, fallback = '') => String(value ?? fallback ?? '').trim()

export const isPublishedEnterpriseProfile = (profile) => (
  profile?.source === 'published-site' && !!text(profile?.siteKey)
)

export const createEnterpriseProfileSummary = (profile = {}) => ({
  displayName: text(profile.displayName, '未发布'),
  legalName: text(profile.legalName, '—'),
  siteKey: text(profile.siteKey, '—'),
  publicSiteUrl: text(profile.publicSiteUrl),
  logoUrl: text(profile.logoUrl),
  description: text(profile.description, '—'),
  contact: [profile?.contact?.phone, profile?.contact?.email]
    .map((item) => text(item))
    .filter(Boolean)
    .join(' / ') || '—',
  locales: Array.isArray(profile.enabledLocales)
    ? profile.enabledLocales.map((item) => text(item)).filter(Boolean).join('、') || '—'
    : '—',
  publishedVersion: Number(profile.publishedVersion) || 0
})

export const resolveEnterpriseProfilePreviewUrl = (profile) => (
  isPublishedEnterpriseProfile(profile) && text(profile.publicSiteUrl)
    ? text(profile.publicSiteUrl)
    : '/login'
)
