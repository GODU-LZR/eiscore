// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const stripAiFunctionValueBlocks = (input) => {
  const text = String(input || '')
  if (!text.includes(': function')) return text
  let out = ''
  let cursor = 0
  while (cursor < text.length) {
    const fnToken = text.indexOf(': function', cursor)
    if (fnToken < 0) {
      out += text.slice(cursor)
      break
    }

    out += text.slice(cursor, fnToken) + ': null'
    let index = fnToken + 1
    const keyword = text.indexOf('function', index)
    if (keyword < 0) {
      cursor = fnToken + 1
      continue
    }
    index = keyword + 'function'.length
    while (index < text.length && text[index] !== '{') index += 1
    if (index >= text.length) {
      cursor = text.length
      break
    }

    let depth = 0
    let inString = false
    let escaped = false
    for (; index < text.length; index += 1) {
      const character = text[index]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (character === '\\') {
          escaped = true
        } else if (character === '"') {
          inString = false
        }
        continue
      }
      if (character === '"') {
        inString = true
        continue
      }
      if (character === '{') depth += 1
      if (character === '}') {
        depth -= 1
        if (depth === 0) {
          index += 1
          break
        }
      }
    }
    cursor = index
  }
  return out
}

export const sanitizeAiJson = (jsonString) => {
  if (!jsonString) return ''
  let cleaned = jsonString
  cleaned = cleaned.replace(/^\s*[^=]*=\s*/, '')
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1')
  cleaned = cleaned.replace(/\/\/.*(?=[\n\r])/g, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/\bundefined\b/g, 'null')
  cleaned = cleaned.replace(/\bNaN\b/g, '0')
  cleaned = cleaned.replace(/\bInfinity\b/g, '0')
  cleaned = cleaned.replace(/\b-Infinity\b/g, '0')
  cleaned = stripAiFunctionValueBlocks(cleaned)
  cleaned = cleaned.replace(/'([^']*)'/g, (_, value) => `"${value.replace(/"/g, '\\"')}"`)
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
  return cleaned.trim()
}

export const extractAiBalancedJson = (input) => {
  const text = String(input || '')
  const start = text.search(/[{[]/)
  if (start < 0) return ''
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character === open) depth += 1
    if (character === close) depth -= 1
    if (depth === 0) return text.slice(start, index + 1)
  }
  return ''
}

export const normalizeAiEchartsGrid = (grid) => {
  const base = { left: 56, right: 28, top: 64, bottom: 44, containLabel: true }
  const next = { ...base, ...(grid && typeof grid === 'object' ? grid : {}) }
  const widthNumber = typeof next.width === 'number' ? next.width : Number.NaN
  const heightNumber = typeof next.height === 'number' ? next.height : Number.NaN
  const widthPercent = typeof next.width === 'string' && next.width.endsWith('%')
    ? Number.parseFloat(next.width)
    : Number.NaN
  const heightPercent = typeof next.height === 'string' && next.height.endsWith('%')
    ? Number.parseFloat(next.height)
    : Number.NaN

  if ((Number.isFinite(widthNumber) && widthNumber < 260) || (Number.isFinite(widthPercent) && widthPercent < 70)) {
    delete next.width
  }
  if ((Number.isFinite(heightNumber) && heightNumber < 180) || (Number.isFinite(heightPercent) && heightPercent < 55)) {
    delete next.height
  }
  return next
}

export const normalizeAiEchartsOption = (option) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null
  const cloned = JSON.parse(JSON.stringify(option))
  if (cloned.series && !Array.isArray(cloned.series)) cloned.series = [cloned.series]
  if (!Array.isArray(cloned.series) || cloned.series.length === 0) return null
  cloned.series = cloned.series
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({ type: item.type || 'line', ...item }))
  if (!cloned.series.length) return null
  cloned.animation = false
  cloned.grid = Array.isArray(cloned.grid)
    ? cloned.grid.map((item) => normalizeAiEchartsGrid(item))
    : normalizeAiEchartsGrid(cloned.grid)
  if (!cloned.tooltip) cloned.tooltip = { trigger: 'axis' }
  return cloned
}

export const parseAiEchartsOptionSafely = (raw) => {
  const source = String(raw || '')
  const primary = sanitizeAiJson(source)
  const candidates = []
  const rawTrimmed = source.trim()
  if (rawTrimmed) candidates.push(rawTrimmed)
  const rawBalanced = extractAiBalancedJson(rawTrimmed)
  if (rawBalanced) candidates.push(rawBalanced)
  if (primary) {
    candidates.push(primary)
    const firstBrace = primary.search(/[{[]/)
    const lastBrace = Math.max(primary.lastIndexOf('}'), primary.lastIndexOf(']'))
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(primary.slice(firstBrace, lastBrace + 1))
    const balanced = extractAiBalancedJson(primary)
    if (balanced) candidates.push(balanced)
  }

  const seen = new Set()
  for (const candidate of candidates) {
    if (!candidate) continue
    const key = candidate.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    try {
      const normalized = normalizeAiEchartsOption(JSON.parse(key))
      if (normalized) return normalized
    } catch {}
  }
  return null
}

export const isAiOmittedEchartsOption = (option) => {
  if (!option || typeof option !== 'object') return false
  const xAxis = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis
  const yAxis = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis
  const firstSeries = Array.isArray(option.series) ? option.series[0] : null
  if (!xAxis || !yAxis || !firstSeries) return false
  const hiddenAxis = xAxis.show === false && yAxis.show === false
  const hiddenLine = Number(firstSeries?.lineStyle?.opacity) === 0
  const hiddenPoint = Number(firstSeries?.itemStyle?.opacity) === 0
  return hiddenAxis && hiddenLine && hiddenPoint
}

export const validateAiEchartsOption = (option) => {
  if (!option || !option.series || !Array.isArray(option.series) || option.series.length === 0) {
    return '图表配置缺少必要的 series 数据'
  }
  return ''
}
