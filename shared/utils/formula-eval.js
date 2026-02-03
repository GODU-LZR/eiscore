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
      let start = i
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
      const o1 = token.value
      const o1Info = OPERATORS[o1]
      if (!o1Info) return null
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (top.type !== 'operator') break
        const o2 = top.value
        const o2Info = OPERATORS[o2]
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

const evalRpn = (tokens) => {
  const stack = []
  for (const token of tokens) {
    if (token.type === 'number') {
      stack.push(token.value)
      continue
    }
    if (token.type === 'operator') {
      const op = token.value
      const info = OPERATORS[op]
      if (!info) return null
      if (info.args === 1) {
        if (stack.length < 1) return null
        const val = stack.pop()
        stack.push(-val)
        continue
      }
      if (stack.length < 2) return null
      const right = stack.pop()
      const left = stack.pop()
      let result = null
      if (op === '+') result = left + right
      if (op === '-') result = left - right
      if (op === '*') result = left * right
      if (op === '/') {
        if (right === 0) return null
        result = left / right
      }
      if (!Number.isFinite(result)) return null
      stack.push(result)
      continue
    }
    return null
  }
  if (stack.length !== 1) return null
  return stack[0]
}
