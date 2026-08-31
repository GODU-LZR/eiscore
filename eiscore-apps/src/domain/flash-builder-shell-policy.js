// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const PROMPT_ECHO_LINE_PATTERNS = [
  /^你是闪念应用开发助手/,
  /^硬性约束[:：]/,
  /^输出要求[:：]/,
  /^严禁输出思考过程/,
  /^禁止出现/,
  /^可调用系统语义接口/,
  /^先运行\s*`?node\s+\/app\/flash-semantic-tool\.js\s+--registry/i,
  /^读接口示例[:：]/,
  /^写接口必须添加\s*--confirm/i,
  /^执行要求[:：]/,
  /^步骤[:：]?$/,
  /^最终输出[:：]/,
  /^当前用户请求[:：]/,
  /^以下是最近上下文[:：]/,
  /^node\s+\/app\/flash-semantic-tool\.js/i,
  /^-?\s*运行[:：]\s*node\s+\/app\/flash-semantic-tool\.js/i,
  /^<toolcall>/i,
  /^<\/toolcall>/i
]

const normalizeRegistryCheck = (value) => value && typeof value === 'object'
  ? {
    claimed: Number(value.claimed || 0),
    actual: Number(value.actual || 0),
    matched: !!value.matched
  }
  : null

export const normalizeFlashShellToolCall = (raw, { id = '' } = {}) => {
  const fromObject = raw && typeof raw === 'object' && !Array.isArray(raw)
  const text = fromObject ? JSON.stringify(raw) : String(raw || '').trim()
  if (!text) return null
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  let parsed = null
  if (fromObject) parsed = raw
  else {
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = null
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const toolId = String(parsed.tool_id || parsed.toolId || parsed.id || parsed.command || '').trim()
    const message = String(
      parsed.message || parsed.result || parsed.error_message || parsed.error?.message || ''
    ).trim()
    const code = String(parsed.code || parsed.reason_code || parsed.error?.reason_code || '').trim()
    const httpStatusRaw = Number(
      parsed.http_status ?? parsed.httpStatus ?? parsed.status ?? parsed.error?.http_status
    )
    return {
      id,
      toolId: toolId || 'toolcall',
      ok: typeof parsed.ok === 'boolean' ? parsed.ok : null,
      code: code || '',
      httpStatus: Number.isFinite(httpStatusRaw) ? httpStatusRaw : null,
      message: message || cleaned.slice(0, 220)
    }
  }
  return {
    id,
    toolId: 'toolcall',
    ok: null,
    code: '',
    httpStatus: null,
    message: cleaned.slice(0, 220)
  }
}

export const createFlashShellMessage = (
  role,
  content,
  extra = {},
  { id = '', normalizeToolCall = normalizeFlashShellToolCall } = {}
) => ({
  id,
  role,
  content: String(content || '').trim(),
  thought: String(extra.thought || '').trim(),
  toolCalls: Array.isArray(extra.toolCalls)
    ? extra.toolCalls.map((item) => normalizeToolCall(item)).filter(Boolean)
    : [],
  registryCheck: normalizeRegistryCheck(extra.registryCheck)
})

export const sanitizeFlashConversationTitle = (value, fallback = '新会话') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > 28 ? `${text.slice(0, 28)}...` : text
}

export const normalizeFlashSavedMessage = (
  item,
  { id = '', normalizeToolCall = normalizeFlashShellToolCall } = {}
) => {
  const role = String(item?.role || '').toLowerCase()
  if (role !== 'user' && role !== 'assistant') return null
  return {
    id: String(item?.id || id),
    role,
    content: String(item?.content || '').trim(),
    thought: String(item?.thought || '').trim(),
    toolCalls: Array.isArray(item?.toolCalls)
      ? item.toolCalls.map((entry) => normalizeToolCall(entry)).filter(Boolean)
      : [],
    registryCheck: normalizeRegistryCheck(item?.registryCheck)
  }
}

export const stripFlashPromptEchoLines = (rawText) => {
  const kept = []
  String(rawText || '').split(/\r?\n/).forEach((line) => {
    const text = String(line || '').trim()
    if (!text) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('')
      return
    }
    if (PROMPT_ECHO_LINE_PATTERNS.some((pattern) => pattern.test(text))) return
    kept.push(line)
  })
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export const extractFlashRegistryCountClaim = (rawText) => {
  const matches = String(rawText || '').match(/(?:共|总计|total)\s*(\d+)\s*(?:个工具|tools?)/ig) || []
  if (!matches.length) return 0
  const numberMatch = String(matches[matches.length - 1]).match(/(\d+)/)
  const count = Number(numberMatch?.[1] || 0)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export const extractFlashToolCallsFromText = (
  rawText,
  { normalizeToolCall = normalizeFlashShellToolCall } = {}
) => {
  const toolCalls = []
  const text = String(rawText || '')
    .replace(/<toolcall>([\s\S]*?)<\/toolcall>/gi, (_, inner = '') => {
      const item = normalizeToolCall(inner)
      if (item) toolCalls.push(item)
      return ''
    })
    .replace(/<\/?toolcall>/gi, '')
    .replace(/<toolcall>\s*$/gi, '')
    .trim()
  return { text, toolCalls }
}

export const parseFlashThoughtAndAnswer = (
  rawContent,
  { normalizeToolCall = normalizeFlashShellToolCall } = {}
) => {
  const source = String(rawContent || '').trim()
  if (!source) return { answer: '', thought: '', toolCalls: [], registryClaimedCount: 0 }
  const extracted = extractFlashToolCallsFromText(source, { normalizeToolCall })
  let working = extracted.text
  const thoughtChunks = []
  const extractTag = (regex) => {
    working = working.replace(regex, (_, inner = '') => {
      const text = String(inner || '').trim()
      if (text) thoughtChunks.push(stripFlashPromptEchoLines(text))
      return ''
    })
  }
  extractTag(/<think>([\s\S]*?)<\/think>/gi)
  extractTag(/<analysis>([\s\S]*?)<\/analysis>/gi)
  extractTag(/<environment_details>([\s\S]*?)<\/environment_details>/gi)
  extractTag(/<task>([\s\S]*?)<\/task>/gi)

  const finalAnswerMatch = working.match(/(?:最终回答|最终答复|回答|答复)\s*[:：]\s*([\s\S]+)/i)
  if (finalAnswerMatch?.[1]) {
    const prior = stripFlashPromptEchoLines(working.slice(0, finalAnswerMatch.index).trim())
    if (prior) thoughtChunks.push(prior)
    working = String(finalAnswerMatch[1]).trim()
  }
  const thoughtLinePatterns = [
    /^用户要求/, /^当前用户请求/, /^以下是最近上下文/, /^最近上下文/, /^历史上下文/,
    /^recent context/i, /^current user request/i, /^这意味着/, /^从环境信息来看/, /^环境信息/,
    /^工作目录/, /^任务路径/, /^硬性约束/, /^我需要/, /^我将/, /^我会/, /^思考[:：]/,
    /^分析[:：]/, /^\d+\.\s*\[(user|assistant)\]/i, /^\[(user|assistant)\]/i, /^-\s*\[[xX\s]\]/
  ]
  const answerLines = []
  working.split(/\r?\n/).forEach((line) => {
    const text = String(line || '').trim()
    if (!text) {
      answerLines.push('')
      return
    }
    if (thoughtLinePatterns.some((pattern) => pattern.test(text))) thoughtChunks.push(text)
    else answerLines.push(line)
  })
  const answerSource = stripFlashPromptEchoLines(answerLines.join('\n'))
  const thoughtSource = stripFlashPromptEchoLines(thoughtChunks.join('\n'))
  return {
    answer: answerSource.replace(/\n{3,}/g, '\n\n').trim(),
    thought: thoughtSource.replace(/\n{3,}/g, '\n\n').trim(),
    toolCalls: extracted.toolCalls,
    registryClaimedCount: extractFlashRegistryCountClaim(answerSource || source)
  }
}

export const formatFlashFileSize = (bytes) => {
  const size = Number(bytes) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export const normalizeFlashShellAttachment = (item, { id = '', uploadedAt = '' } = {}) => {
  const relativePath = String(item?.relativePath || item?.path || '').replace(/\\/g, '/').trim()
  if (!relativePath) return null
  return {
    id: String(item?.id || id),
    name: String(item?.name || relativePath.split('/').pop() || 'file').trim(),
    mimeType: String(item?.mimeType || item?.type || 'application/octet-stream').trim() || 'application/octet-stream',
    size: Math.max(0, Number(item?.size) || 0),
    relativePath,
    textPreview: String(item?.textPreview || '').slice(0, 8000),
    uploadedAt: String(item?.uploadedAt || uploadedAt)
  }
}

export const buildFlashDefaultConversation = (
  id = '',
  { generatedId = '', nowIso = '', titleTime = '' } = {}
) => ({
  id: id || generatedId,
  title: `会话 ${titleTime}`,
  createdAt: nowIso,
  updatedAt: nowIso,
  messages: [],
  attachments: []
})

export const mergeFlashShellToolCalls = (
  existing,
  incoming,
  { normalizeToolCall = normalizeFlashShellToolCall, limit = 20 } = {}
) => {
  const base = Array.isArray(existing) ? existing.slice() : []
  const queue = Array.isArray(incoming) ? incoming : []
  queue.forEach((item) => {
    const normalized = normalizeToolCall(item)
    if (!normalized) return
    const signature = `${normalized.toolId}|${normalized.code}|${normalized.httpStatus || ''}|${normalized.message}`
    const duplicated = base.some((entry) => (
      `${entry.toolId}|${entry.code}|${entry.httpStatus || ''}|${entry.message}` === signature
    ))
    if (!duplicated) base.push(normalized)
  })
  return base.slice(-limit)
}

export const buildFlashRegistryCheck = (claimedCount, actualCount) => {
  const claimed = Number(claimedCount || 0)
  const actual = Number(actualCount || 0)
  if (!Number.isFinite(claimed) || claimed <= 0 || !Number.isFinite(actual) || actual <= 0) return null
  return { claimed, actual, matched: claimed === actual }
}

export const isFlashRecoverableShellError = (rawMessage) => {
  const text = String(rawMessage || '').toLowerCase()
  if (!text) return true
  return /timeout|network|socket|connection|disconnect|temporary|temporarily|upstream|503|502|504|rate limit|busy|unavailable|econnreset|econnrefused/.test(text)
}

export const buildFlashShellHistory = (messages, historyLimit = 10) => (Array.isArray(messages) ? messages : [])
  .slice(-historyLimit * 2)
  .map((item) => ({ role: item.role, content: item.content }))
  .filter((item) => (item.role === 'user' || item.role === 'assistant') && String(item.content || '').trim())

export const formatFlashConversationMeta = (conversation) => {
  if (!conversation) return ''
  const messageCount = Array.isArray(conversation.messages) ? conversation.messages.length : 0
  const attachmentCount = Array.isArray(conversation.attachments) ? conversation.attachments.length : 0
  return attachmentCount > 0
    ? `${messageCount} 条消息 · ${attachmentCount} 个附件`
    : `${messageCount} 条消息`
}
