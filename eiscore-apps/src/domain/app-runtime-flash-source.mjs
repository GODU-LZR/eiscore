// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const parseJsonObject = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export const normalizeDraftSourceText = (value) => String(value || '').replace(/\r\n/g, '\n').trim()

const stripSourceMapMarkers = (text) => String(text || '')
  .replace(/\/\/#\s*sourceMappingURL=.*$/gim, '')
  .replace(/\/\*#\s*sourceMappingURL=[\s\S]*?\*\//gim, '')
  .trim()

export const sanitizeFlashPublishedHtml = (value, { parseHtmlDocument } = {}) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (typeof parseHtmlDocument === 'function') {
    try {
      const doc = parseHtmlDocument(raw)
      const removableSelectors = [
        'script',
        'noscript',
        'link[rel="modulepreload"]',
        'link[rel="preload"][as="script"]'
      ]
      removableSelectors.forEach((selector) => {
        doc?.querySelectorAll?.(selector)?.forEach((node) => node.remove())
      })
      const html = stripSourceMapMarkers(String(doc?.documentElement?.outerHTML || ''))
      if (html) return `<!doctype html>\n${html}`
    } catch {
      // Preserve the regexp fallback when browser parsing fails.
    }
  }

  return stripSourceMapMarkers(raw)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']preload["'][^>]*as=["']script["'][^>]*>/gi, '')
    .trim()
}

export const buildFlashPublishedSrcdoc = (sourceCode, options = {}) => {
  const source = parseJsonObject(sourceCode)
  if (!source || typeof source !== 'object') return ''
  const flash = source.flash
  if (!flash || typeof flash !== 'object') return ''
  const html = sanitizeFlashPublishedHtml(flash.published_html || '', options)
  if (!html) return ''
  if (html.toLowerCase().includes('<html')) return html
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head><body>${html}</body></html>`
}

export const extractFlashRuntimeDraftSource = (row) => {
  const source = parseJsonObject(row?.source_code)
  if (!source || typeof source !== 'object') return ''
  const flash = source.flash
  if (!flash || typeof flash !== 'object') return ''
  return normalizeDraftSourceText(flash.published_draft_source || flash.draft_source || '')
}
