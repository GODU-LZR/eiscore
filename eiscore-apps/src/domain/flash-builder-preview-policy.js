// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { escapeFlashHtml } from './flash-builder-markdown-policy.js'

const SNAPSHOT_DYNAMIC_SELECTORS = [
  'script',
  'noscript',
  'link[rel="modulepreload"]',
  'link[rel="preload"][as="script"]'
]

export const parseFlashPreviewRatio = (width, height) => {
  const widthText = String(width || '').trim()
  const heightText = String(height || '').trim()
  if (!widthText || !heightText) return null
  const numericWidth = Number(widthText)
  const numericHeight = Number(heightText)
  if (!Number.isFinite(numericWidth) || !Number.isFinite(numericHeight) || numericWidth <= 0 || numericHeight <= 0) {
    return null
  }
  const ratio = numericWidth / numericHeight
  return ratio < 0.4 || ratio > 4 ? null : ratio
}

export const buildFlashPreviewStageStyle = (ratio) => {
  if (!ratio) return null
  return {
    width: `min(100%, calc((100dvh - 240px) * ${ratio}))`,
    maxWidth: '100%',
    margin: '0 auto',
    flex: 'none',
    aspectRatio: String(ratio),
    maxHeight: 'calc(100dvh - 240px)'
  }
}

export const sanitizeFlashPreviewSnapshotHtml = (rawHtml, { parseDocument = null } = {}) => {
  const source = String(rawHtml || '').trim()
  if (!source) return ''

  if (typeof parseDocument === 'function') {
    try {
      const doc = parseDocument(source)
      SNAPSHOT_DYNAMIC_SELECTORS.forEach((selector) => {
        doc?.querySelectorAll?.(selector)?.forEach((node) => node.remove())
      })
      const html = String(doc?.documentElement?.outerHTML || '').trim()
      if (!html) return ''
      return `<!doctype html>\n${html}`
    } catch {
      // Preserve the legacy regexp fallback when the injected DOM parser fails.
    }
  }

  return source
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']preload["'][^>]*as=["']script["'][^>]*>/gi, '')
    .trim()
}

export const buildFlashSourceSnapshotHtml = (draftSource, { title = '闪念应用' } = {}) => {
  const source = String(draftSource || '').trim()
  if (!source) return ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <pre style="white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">${escapeFlashHtml(source)}</pre>
</body>
</html>`
}
