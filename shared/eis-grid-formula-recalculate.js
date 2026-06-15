// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const OPERATORS = {
  '+': { prec: 1, assoc: 'L', args: 2 },
  '-': { prec: 1, assoc: 'L', args: 2 },
  '*': { prec: 2, assoc: 'L', args: 2 },
  '/': { prec: 2, assoc: 'L', args: 2 },
  'u-': { prec: 3, assoc: 'R', args: 1 }
}

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

const trimApiPrefix = (url) => String(url || '').replace(/^\/api\b/, '')

const normalizeBaseUrl = (url) => {
  const clean = trimApiPrefix(url || '').trim()
  const [baseUrl] = clean.split('?')
  return baseUrl || clean
}

const safeDecodeQueryPart = (value) => {
  try {
    return decodeURIComponent(String(value || ''))
  } catch (e) {
    return String(value || '')
  }
}

function extractApiFilterQuery(url = '') {
  const [, rawQuery = ''] = String(url || '').split('?')
  if (!rawQuery) return ''
  const ignored = new Set(['select', 'order', 'limit', 'offset'])
  return rawQuery
    .split('&')
    .map((item) => safeDecodeQueryPart(item.trim()))
    .filter(Boolean)
    .filter((item) => {
      const key = (item.split('=')[0] || '').trim()
      return key && !ignored.has(key)
    })
    .join('&')
}

const isDigit = (ch) => ch >= '0' && ch <= '9'

function buildColumnLookup(staticColumns = [], extraColumns = []) {
  const columns = [
    ...staticColumns.map((col) => ({ ...col, source: 'column' })),
    ...extraColumns.map((col) => ({ ...col, source: 'properties' }))
  ]
  const lookup = new Map()
  columns.forEach((col) => {
    if (!col?.prop || !IDENTIFIER_RE.test(col.prop)) return
    const safeCol = {
      prop: col.prop,
      label: col.label || col.prop,
      source: col.source
    }
    lookup.set(col.prop, safeCol)
    if (col.label) lookup.set(col.label, safeCol)
  })
  return lookup
}

function tokenizeFormulaExpression(expression, lookup) {
  const expr = String(expression || '')
  const tokens = []
  let i = 0
  let prev = 'start'

  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1
      continue
    }

    if (ch === '{') {
      const end = expr.indexOf('}', i + 1)
      if (end === -1) throw new Error('公式缺少右花括号')
      const rawKey = expr.slice(i + 1, end).trim()
      const column = lookup.get(rawKey)
      if (!column) throw new Error(`公式引用了不存在的字段：${rawKey}`)
      tokens.push({ type: 'ref', ...column })
      prev = 'number'
      i = end + 1
      continue
    }

    if (isDigit(ch) || ch === '.') {
      const start = i
      let dotCount = ch === '.' ? 1 : 0
      i += 1
      while (i < expr.length) {
        const next = expr[i]
        if (isDigit(next)) {
          i += 1
          continue
        }
        if (next === '.') {
          dotCount += 1
          if (dotCount > 1) throw new Error('公式数字格式不正确')
          i += 1
          continue
        }
        break
      }
      const raw = expr.slice(start, i)
      const value = Number.parseFloat(raw)
      if (!Number.isFinite(value)) throw new Error('公式数字格式不正确')
      tokens.push({ type: 'number', value })
      prev = 'number'
      continue
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      prev = ch
      i += 1
      continue
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({
        type: 'operator',
        value: ch === '-' && (prev === 'start' || prev === 'operator' || prev === '(') ? 'u-' : ch
      })
      prev = 'operator'
      i += 1
      continue
    }

    throw new Error(`公式包含不支持的字符：${ch}`)
  }

  return tokens
}

function toRpn(tokens) {
  const output = []
  const stack = []
  tokens.forEach((token) => {
    if (token.type === 'number' || token.type === 'ref') {
      output.push(token)
      return
    }
    if (token.type === 'operator') {
      const o1 = token.value
      const o1Info = OPERATORS[o1]
      if (!o1Info) throw new Error(`不支持的公式运算符：${o1}`)
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (top.type !== 'operator') break
        const o2Info = OPERATORS[top.value]
        if (!o2Info) break
        const shouldPop = o1Info.assoc === 'L'
          ? o1Info.prec <= o2Info.prec
          : o1Info.prec < o2Info.prec
        if (!shouldPop) break
        output.push(stack.pop())
      }
      stack.push(token)
      return
    }
    if (token.type === 'paren' && token.value === '(') {
      stack.push(token)
      return
    }
    if (token.type === 'paren' && token.value === ')') {
      let found = false
      while (stack.length) {
        const top = stack.pop()
        if (top.type === 'paren' && top.value === '(') {
          found = true
          break
        }
        output.push(top)
      }
      if (!found) throw new Error('公式括号不匹配')
      return
    }
    throw new Error('公式格式不正确')
  })

  while (stack.length) {
    const top = stack.pop()
    if (top.type === 'paren') throw new Error('公式括号不匹配')
    output.push(top)
  }

  return output
}

export function getFormulaColumns(extraColumns = []) {
  return (extraColumns || []).filter((col) => {
    if (!col?.prop || !IDENTIFIER_RE.test(col.prop)) return false
    return col.type === 'formula' && String(col.expression || '').trim()
  })
}

export function compileFormulaToRpn(expression, staticColumns = [], extraColumns = []) {
  const lookup = buildColumnLookup(staticColumns, extraColumns)
  const tokens = tokenizeFormulaExpression(expression, lookup)
  const rpn = toRpn(tokens)
  if (!rpn.length) throw new Error('公式为空')
  return rpn.map((token) => {
    if (token.type === 'number') return { type: 'number', value: token.value }
    if (token.type === 'ref') {
      return {
        type: 'ref',
        prop: token.prop,
        label: token.label,
        source: token.source
      }
    }
    return { type: 'operator', value: token.value }
  })
}

export function buildFormulaRecalculatePayload({
  props,
  targetColumn,
  searchText = '',
  buildSearchQuery,
  batchSize = 2000,
  precision = 2
}) {
  if (!props || !targetColumn?.prop) return null
  const relationUrl = normalizeBaseUrl(props.writeUrl || props.apiUrl || '')
  if (!relationUrl) return null

  let searchQuery = ''
  const text = String(searchText || '').trim()
  if (text && typeof buildSearchQuery === 'function') {
    searchQuery = safeDecodeQueryPart(buildSearchQuery(text, props.staticColumns || [], props.extraColumns || []))
  }

  return {
    view_id: props.viewId || '',
    api_url: normalizeBaseUrl(props.apiUrl || ''),
    write_url: relationUrl,
    accept_profile: props.acceptProfile || props.profile || 'public',
    content_profile: props.contentProfile || props.profile || props.acceptProfile || 'public',
    base_query: extractApiFilterQuery(props.apiUrl || ''),
    search_query: searchQuery,
    target: {
      prop: targetColumn.prop,
      label: targetColumn.label || targetColumn.prop
    },
    tokens: compileFormulaToRpn(targetColumn.expression, props.staticColumns || [], props.extraColumns || []),
    batch_size: Math.max(100, Math.min(10000, Number(batchSize) || 2000)),
    precision: Math.max(0, Math.min(6, Number(precision) || 2))
  }
}

export async function recalculateFormulaBatch({ request, payload }) {
  return request({
    url: '/rpc/eis_grid_formula_recalculate',
    method: 'post',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    },
    data: { payload },
    timeout: 30000,
    silentError: true,
    suppressErrorMessage: true
  })
}
