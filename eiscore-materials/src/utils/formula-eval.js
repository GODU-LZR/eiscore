// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const evaluateFormulaExpression = (expr) => {
  if (!expr || typeof expr !== 'string') return null
  const tokens = tokenize(expr)
  if (!tokens) return null
  const rpn = toRpn(tokens)
  if (!rpn) return null
  return evalRpn(rpn)
}

const OPERATORS = {
  '+': { prec: 1, assoc: 'L', args: 2 },
  '-': { prec: 1, assoc: 'L', args: 2 },
  '*': { prec: 2, assoc: 'L', args: 2 },
  '/': { prec: 2, assoc: 'L', args: 2 },
  'u-': { prec: 3, assoc: 'R', args: 1 }
}

const isDigit = (ch) => ch >= '0' && ch <= '9'

const tokenize = (expr) => {
  const tokens = []
  let i = 0
  let prev = 'start'
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1
      continue
    }
    if (isDigit(ch) || ch === '.') {
      const start = i
      let dotCount = ch === '.' ? 1 : 0
      i += 1
      while (i < expr.length) {
        const c = expr[i]
        if (isDigit(c)) {
          i += 1
          continue
        }
        if (c === '.') {
          dotCount += 1
          if (dotCount > 1) return null
          i += 1
          continue
        }
        break
      }
      const raw = expr.slice(start, i)
      const num = Number.parseFloat(raw)
      if (!Number.isFinite(num)) return null
      tokens.push({ type: 'number', value: num })
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
      if (ch === '-' && (prev === 'start' || prev === 'operator' || prev === '(')) {
        tokens.push({ type: 'operator', value: 'u-' })
      } else {
        tokens.push({ type: 'operator', value: ch })
      }
      prev = 'operator'
      i += 1
      continue
    }
    return null
  }
  return tokens
}

const toRpn = (tokens) => {
  const output = []
  const stack = []
  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token)
      continue
    }
    if (token.type === 'operator') {
      const o1Info = OPERATORS[token.value]
      if (!o1Info) return null
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (top.type !== 'operator') break
        const o2Info = OPERATORS[top.value]
        if (!o2Info) break
        const higherPrec = o1Info.assoc === 'L'
          ? o1Info.prec <= o2Info.prec
          : o1Info.prec < o2Info.prec
        if (!higherPrec) break
        output.push(stack.pop())
      }
      stack.push(token)
      continue
    }
    if (token.type === 'paren' && token.value === '(') {
      stack.push(token)
      continue
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
      if (!found) return null
      continue
    }
    return null
  }
  while (stack.length) {
    const top = stack.pop()
    if (top.type === 'paren') return null
    output.push(top)
  }
  return output
}

const evalRpn = (rpn) => {
  const stack = []
  for (const token of rpn) {
    if (token.type === 'number') {
      stack.push(token.value)
      continue
    }
    const op = OPERATORS[token.value]
    if (!op || stack.length < op.args) return null
    if (token.value === 'u-') {
      stack.push(-stack.pop())
      continue
    }
    const right = stack.pop()
    const left = stack.pop()
    if (token.value === '+') stack.push(left + right)
    if (token.value === '-') stack.push(left - right)
    if (token.value === '*') stack.push(left * right)
    if (token.value === '/') {
      if (right === 0) return null
      stack.push(left / right)
    }
  }
  if (stack.length !== 1) return null
  return stack[0]
}
