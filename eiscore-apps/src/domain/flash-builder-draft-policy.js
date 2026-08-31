// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const DEFAULT_FLASH_BUILDER_DRAFT_SOURCE = `<template>
  <div class="flash-draft-page">
    <section class="hero">
      <div class="hero-badge">Flash Builder</div>
      <h1>闪念应用草稿画板</h1>
      <p>在左侧描述你的需求，智能体会持续生成并优化这里的页面效果。</p>
    </section>
  </div>
</template>
<style scoped>
.flash-draft-page { min-height: 100vh; padding: 36px; color: #0f172a; background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%); font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
.hero { max-width: 860px; margin: 0 auto; padding: 34px 30px; border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 20px; background: rgba(255, 255, 255, 0.78); box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08); }
.hero-badge { width: fit-content; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #1d4ed8; background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.22); }
.hero h1 { margin: 14px 0 10px; font-size: 38px; line-height: 1.15; }
.hero p { margin: 0; font-size: 17px; color: #475569; }
</style>
`

const normalizeObjectValue = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const normalizeFlashConfig = (value) => normalizeObjectValue(value)
export const normalizeFlashSourceCode = (value) => normalizeObjectValue(value)
export const normalizeFlashDraftSourceText = (value) => String(value || '').replace(/\r\n/g, '\n').trim()
export const normalizeFlashAppStatus = (value) => String(value || '').trim().toLowerCase()

export const indentFlashMultiline = (text, spaces = 4) => String(text || '')
  .split('\n')
  .map((line) => `${' '.repeat(spaces)}${line}`)
  .join('\n')

export const stripFlashSourceMapMarkers = (text) => String(text || '')
  .replace(/\/\/#\s*sourceMappingURL=.*$/gim, '')
  .replace(/\/\*#\s*sourceMappingURL=[\s\S]*?\*\//gim, '')
  .trim()

export const buildFlashDraftFromPublishedHtml = (
  publishedHtml,
  { extractBody = (value) => value } = {}
) => {
  const bodyHtml = extractBody(publishedHtml)
  if (!bodyHtml) return ''
  return `<template>
  <div class="flash-legacy-draft">
${indentFlashMultiline(bodyHtml, 4)}
  </div>
</template>
`
}

export const buildFlashSourceCodeWithDraft = (
  baseSourceCode,
  draftSource,
  {
    draftFile,
    mode,
    updatedAt,
    extraFlash = {}
  } = {}
) => {
  const source = normalizeFlashSourceCode(baseSourceCode)
  const flash = source?.flash && typeof source.flash === 'object' ? source.flash : {}
  return {
    ...source,
    flash: {
      ...flash,
      draft_file: draftFile,
      draft_source: String(draftSource || ''),
      draft_updated_at: updatedAt,
      mode,
      ...extraFlash
    }
  }
}

export const resolveFlashDraftIsolation = (
  row,
  {
    defaultDraft = DEFAULT_FLASH_BUILDER_DRAFT_SOURCE,
    buildLegacyDraft = () => ''
  } = {}
) => {
  const sourceCode = normalizeFlashSourceCode(row?.source_code)
  const flashSource = sourceCode?.flash && typeof sourceCode.flash === 'object' ? sourceCode.flash : {}
  const savedDraft = normalizeFlashDraftSourceText(flashSource?.draft_source)
  const publishedDraft = normalizeFlashDraftSourceText(flashSource?.published_draft_source)
  const legacyPublishedDraft = normalizeFlashDraftSourceText(buildLegacyDraft(flashSource?.published_html))
  const fallbackDraft = normalizeFlashDraftSourceText(defaultDraft)
  const targetDraft = savedDraft || publishedDraft || legacyPublishedDraft || fallbackDraft

  let reason = 'init_new_app_draft'
  if (savedDraft) reason = 'restore_app_draft'
  else if (publishedDraft) reason = 'restore_published_draft'
  else if (legacyPublishedDraft) {
    reason = normalizeFlashAppStatus(row?.status) === 'draft'
      ? 'restore_draft_seed'
      : 'restore_legacy_published_snapshot'
  }

  return { savedDraft, targetDraft, reason }
}

export const buildFlashBuilderConfig = (
  baseConfig = {},
  {
    codeServerEnabled,
    mode,
    legacyMode,
    draftRoot,
    draftFile,
    previewRoute,
    updatedAt
  } = {}
) => ({
  ...baseConfig,
  flash: {
    ...(baseConfig.flash || {}),
    mode: codeServerEnabled ? mode : legacyMode,
    draftRoot,
    draftFile,
    previewRoute,
    featureFlag: 'flash_builder_v2',
    updatedAt
  }
})
