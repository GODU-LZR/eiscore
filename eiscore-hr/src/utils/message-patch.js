import { ElMessage } from 'element-plus'

const PATCH_FLAG = '__EIS_MESSAGE_PATCHED__'
const MESSAGE_TYPES = ['success', 'warning', 'info', 'error']

function getDocumentRef() {
  if (typeof window === 'undefined') return null
  return window.document || document
}

function normalizeMessageText(message) {
  if (typeof message === 'string') return message.trim()
  if (typeof message === 'number') return String(message)
  if (message && typeof message === 'object') {
    if (typeof message.children === 'string') return message.children.trim()
    if (typeof message.value === 'string') return message.value.trim()
  }
  return ''
}

function hasVisibleDuplicate(doc, text) {
  if (!text) return false
  const nodes = doc.querySelectorAll('.el-message .el-message__content')
  for (const node of nodes) {
    if ((node.textContent || '').trim() === text) return true
  }
  return false
}

function normalizeOptions(type, raw) {
  const doc = getDocumentRef()
  const base = {
    type,
    appendTo: doc ? doc.body : undefined,
    grouping: true
  }

  if (typeof raw === 'string' || typeof raw === 'number') {
    return { ...base, message: String(raw) }
  }

  if (raw && typeof raw === 'object') {
    return {
      ...base,
      ...raw,
      type: raw.type || type,
      grouping: raw.grouping !== undefined ? raw.grouping : true,
      appendTo: raw.appendTo || base.appendTo
    }
  }

  return base
}

export function patchElMessage() {
  if (!ElMessage || ElMessage[PATCH_FLAG]) return

  MESSAGE_TYPES.forEach((type) => {
    const original = ElMessage[type]
    if (typeof original !== 'function') return

    ElMessage[type] = (raw) => {
      const options = normalizeOptions(type, raw)
      const doc = getDocumentRef()
      const text = normalizeMessageText(options.message)
      if (doc && hasVisibleDuplicate(doc, text)) return null
      return original(options)
    }
  })

  ElMessage[PATCH_FLAG] = true
}
