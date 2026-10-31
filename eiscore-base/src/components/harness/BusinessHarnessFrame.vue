<template>
  <div class="business-harness-frame" :aria-busy="pending">
    <iframe v-if="ready && !failed" ref="frame" :src="harnessWebUrl" title="DeepSeek Harness 工作助手" @load="syncEntry(true)" @error="failed = true" />
    <div v-else class="harness-status" role="status" aria-live="polite">
      <el-icon v-if="pending" class="is-loading"><Loading /></el-icon>
      <span>{{ failed ? 'DeepSeek Harness 加载失败，请重试' : '正在加载 DeepSeek Harness' }}</span>
      <el-button v-if="failed && !pending" size="small" @click="prepare">重试</el-button>
    </div>
    <div v-if="entryFailed" class="draft-retry" role="status">
      交接草稿需返回入口会话。<el-button size="small" @click="syncEntry(true)">返回入口会话</el-button>
    </div>
    <div v-if="draftDeliveryFailed" class="draft-retry" role="status">
      指令尚未交接，草稿已保留。<el-button size="small" @click="deliverDraft">重试交接</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getAuthHeader } from '@/utils/auth'
import { prepareBusinessHarnessAuth } from '@/services/business-harness-auth'
import { businessHarnessState } from '@/services/business-harness-controller'

const props = defineProps({ active: Boolean, entry: { type: String, default: 'worker' } })
const emit = defineEmits(['file-drop-finished', 'file-drop-progress'])
const userStore = useUserStore()
const harnessWebUrl = import.meta.env.VITE_HARNESS_WEB_URL || '/harness-embed/'
const frame = ref(null)
const ready = ref(false)
const pending = ref(false)
const failed = ref(false)
const draftDeliveryFailed = ref(false)
const entryFailed = ref(false)
const entryReady = ref(false)
let requestId = 0
let deliveryTimer
let attempts = 0
let authorizationSnapshot = ''
let entryRequest = null
let entrySequence = 0
let entryTimer
let draftDecisionId = ''

const WORKER_DRAFT_PROTOCOL = 'eiscore-harness-worker-draft'
const WORKER_DRAFT_VERSION = 1
const FILE_DROP_PROTOCOL = 'eiscore-harness-file-drop'
const FILE_DROP_VERSION = 1
const MAX_DROP_FILES = 20
const MAX_FILE_BYTES = 20 * 1024 * 1024
const FILE_UPLOAD_TIMEOUT_MS = 45_000
const FILE_UPLOAD_CONCURRENCY = 3
const FILE_REQUEST_TIMEOUT_MS = 15_000
const FILE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/
const FILE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'mp3',
  'md', 'txt', 'csv', 'wav', 'm4a', 'ogg', 'aac', 'flac'
])

const currentEntry = () => props.entry === 'workbench' ? 'workbench' : 'worker'
const clearEntry = () => {
  clearTimeout(entryTimer)
  clearTimeout(deliveryTimer)
  draftDecisionId = ''
  entryRequest = null
  entryReady.value = false
  entryFailed.value = false
}

function syncEntry(renew = false) {
  clearTimeout(entryTimer)
  if (renew || entryRequest?.entry !== currentEntry()) clearEntry()
  if (!props.active || !ready.value || failed.value || !frame.value?.contentWindow) return
  if (!hasCurrentAuthorization()) { invalidateAuthorization(); return }
  if (entryReady.value) { deliverDraft(); return }
  entryFailed.value = false
  const request = entryRequest ||= { type: 'eiscore:harness-entry', version: 1, entry: currentEntry(), id: `entry-${Date.now()}-${++entrySequence}` }
  let count = 0
  const send = () => {
    if (entryRequest !== request || !props.active || !frame.value?.contentWindow || !ready.value || failed.value) return
    if (!hasCurrentAuthorization()) { invalidateAuthorization(); return }
    frame.value.contentWindow.postMessage(request, window.location.origin)
    if (++count < 15) entryTimer = setTimeout(send, 1000)
    else entryFailed.value = true
  }
  send()
}

function hasCurrentAuthorization() {
  return !!authorizationSnapshot && getAuthHeader().Authorization === authorizationSnapshot
}

function invalidateAuthorization() {
  ++requestId
  clearTimeout(deliveryTimer)
  clearEntry()
  authorizationSnapshot = ''
  businessHarnessState.pendingDraft = null
  draftDeliveryFailed.value = false
  ready.value = false
  pending.value = false
  failed.value = true
}

async function prepare() {
  if (pending.value) return
  const id = ++requestId
  pending.value = true
  failed.value = false
  ready.value = false
  clearEntry()
  authorizationSnapshot = ''
  let success = false
  const authorization = getAuthHeader().Authorization || ''
  const isCurrent = () => id === requestId && !!authorization && getAuthHeader().Authorization === authorization
  try {
    success = await prepareBusinessHarnessAuth({ harnessWebUrl, authorization }, isCurrent)
  } catch { success = false }
  if (id !== requestId) return
  if (!isCurrent()) { invalidateAuthorization(); return }
  authorizationSnapshot = success ? authorization : ''
  ready.value = success
  pending.value = false
  failed.value = !success
}

function deliverDraft() {
  clearTimeout(deliveryTimer)
  const draft = businessHarnessState.pendingDraft
  if (!draft || !props.active || !frame.value?.contentWindow) return
  if (!ready.value || failed.value || !entryReady.value || currentEntry() !== 'worker' || entryRequest?.entry !== currentEntry()) return
  if (!hasCurrentAuthorization()) { invalidateAuthorization(); return }
  draftDeliveryFailed.value = false
  attempts = 0
  const send = () => {
    if (businessHarnessState.pendingDraft !== draft || !props.active || !frame.value?.contentWindow) return
    if (!ready.value || failed.value || !entryReady.value || currentEntry() !== 'worker' || entryRequest?.entry !== currentEntry()) return
    if (!hasCurrentAuthorization()) { invalidateAuthorization(); return }
    frame.value.contentWindow.postMessage({
      source: 'eiscore-host',
      protocol: WORKER_DRAFT_PROTOCOL,
      version: WORKER_DRAFT_VERSION,
      type: 'prepare',
      id: draft.id,
      prompt: draft.prompt
    }, window.location.origin)
    if (++attempts < 10) deliveryTimer = setTimeout(send, 1000)
    else draftDeliveryFailed.value = true
  }
  send()
}

const fileExtension = (name) => {
  const value = String(name || '').trim().toLowerCase()
  const index = value.lastIndexOf('.')
  return index >= 0 ? value.slice(index + 1) : ''
}

async function uploadHarnessFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('文件格式无效')
  const name = String(file.name || '').trim().slice(0, 240)
  const ext = fileExtension(name)
  if (!name || !FILE_EXTENSIONS.has(ext)) throw new Error('文件格式不支持')
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error('文件不能超过20MB')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), FILE_UPLOAD_TIMEOUT_MS)
  try {
    const response = await fetch('/harness-embed-api/eiscore/files/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': String(file.type || 'application/octet-stream').slice(0, 160),
        'x-eiscore-file-name': encodeURIComponent(name)
      },
      body: file,
      signal: controller.signal
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 413) throw new Error('文件请求超过服务上限，请使用20MB以内文件')
      throw new Error(String(body?.message || '文件上传失败'))
    }
    const row = Array.isArray(body) ? body[0] : body
    if (!row?.id) throw new Error('文件上传结果无效')
    return {
      id: row.id,
      name: row.filename || name,
      type: row.mime_type || file.type || '',
      size: row.size_bytes || file.size,
      url: `file:${row.id}`,
      ext,
      uploadedAt: row.created_at || new Date().toISOString()
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('文件上传超时，请检查网络后重试')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function requestHarnessFile(path, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), FILE_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { ...getAuthHeader(), ...(options.headers || {}) },
      signal: controller.signal
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(body?.message || '文件操作失败'))
    return body
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('文件操作超时，请检查网络后重试')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

const createFileDropId = () => `drop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

async function processFileDrop(files, id = createFileDropId()) {
  if (!Array.isArray(files) || !files.length) return false
  if (files.length > MAX_DROP_FILES) {
    ElMessage.warning(`一次最多上传 ${MAX_DROP_FILES} 个文件，请分批添加`)
    emit('file-drop-progress', { status: 'rejected', completed: 0, total: files.length })
    return false
  }
  if (!hasCurrentAuthorization()) { invalidateAuthorization(); return false }
  const uploadedByIndex = []
  const errors = []
  let nextIndex = 0
  let completed = 0
  emit('file-drop-progress', { status: 'started', completed, total: files.length })
  const uploadOne = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++
      const file = files[index]
      try {
        const saved = await uploadHarnessFile(file)
        uploadedByIndex[index] = saved
      } catch (error) {
        errors.push(`${file?.name || '文件'}：${error.message}`)
      } finally {
        completed += 1
        emit('file-drop-progress', { status: 'progress', completed, total: files.length })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(FILE_UPLOAD_CONCURRENCY, files.length) }, uploadOne))
  const uploaded = uploadedByIndex.filter(Boolean)
  if (!frame.value?.contentWindow) return false
  frame.value.contentWindow.postMessage({
    source: 'eiscore-host',
    protocol: FILE_DROP_PROTOCOL,
    version: FILE_DROP_VERSION,
    type: uploaded.length ? 'uploaded' : 'error',
    id,
    files: uploaded,
    errors
  }, window.location.origin)
  if (errors.length) ElMessage.warning(errors.join('；'))
  if (uploaded.length) ElMessage.success(`已上传 ${uploaded.length} 个文件，可在工作助手中归类并关联客户`)
  emit('file-drop-progress', { status: 'finished', completed, total: files.length, uploaded: uploaded.length, failed: errors.length })
  return uploaded.length > 0
}

async function receiveFileDrop(event) {
  const message = event.data
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  if (!message || message.source !== 'eiscore-harness' || message.protocol !== FILE_DROP_PROTOCOL || message.version !== FILE_DROP_VERSION) return
  if (message.type === 'delete-request' || message.type === 'preview-request') {
    const fileId = String(message.fileId || '')
    if (!FILE_ID_PATTERN.test(fileId) || !frame.value?.contentWindow) return
    if (message.type === 'delete-request') {
      try {
        const body = await requestHarnessFile(`/agent/ai/harness/files/delete?id=${encodeURIComponent(fileId)}`, { method: 'DELETE' })
        frame.value?.contentWindow?.postMessage({
          source: 'eiscore-host', protocol: FILE_DROP_PROTOCOL, version: FILE_DROP_VERSION,
          type: 'deleted', fileId, deleted: body?.deleted === true
        }, window.location.origin)
      } catch (error) {
        frame.value?.contentWindow?.postMessage({
          source: 'eiscore-host', protocol: FILE_DROP_PROTOCOL, version: FILE_DROP_VERSION,
          type: 'delete-error', fileId, error: error?.message || '文件删除失败'
        }, window.location.origin)
      }
      return
    }
    try {
      const body = await requestHarnessFile(`/agent/ai/harness/files/read?id=${encodeURIComponent(fileId)}`)
      frame.value?.contentWindow?.postMessage({
        source: 'eiscore-host', protocol: FILE_DROP_PROTOCOL, version: FILE_DROP_VERSION,
        type: 'previewed', fileId, file: body
      }, window.location.origin)
    } catch (error) {
      frame.value?.contentWindow?.postMessage({
        source: 'eiscore-host', protocol: FILE_DROP_PROTOCOL, version: FILE_DROP_VERSION,
        type: 'preview-error', fileId, error: error?.message || '文件预览失败'
      }, window.location.origin)
    }
    return
  }
  if (message.type !== 'received') return
  emit('file-drop-finished')
  const id = String(message.id || '')
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(id) || !Array.isArray(message.files) || message.files.length > MAX_DROP_FILES) return
  await processFileDrop(message.files, id)
}

async function acceptDroppedFiles(fileList) {
  const files = Array.from(fileList || [])
  return processFileDrop(files)
}

defineExpose({ acceptDroppedFiles })

function receiveDraftResult(event) {
  const result = event.data
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  if (!result || typeof result !== 'object' || Array.isArray(result) || result.version !== 1) return
  if (result.type === 'eiscore:harness-entry-ready') {
    if (Object.keys(result).some((key) => !['type', 'version'].includes(key))) return
    syncEntry()
    return
  }
  if (result.type === 'eiscore:harness-entry-result') {
    if (Object.keys(result).some((key) => !['type', 'version', 'entry', 'id', 'status'].includes(key)) || !['applied', 'failed'].includes(result.status)) return
    if (!ready.value || failed.value) return
    if (!hasCurrentAuthorization()) { invalidateAuthorization(); return }
    if (result.id !== entryRequest?.id || result.entry !== entryRequest?.entry || result.entry !== currentEntry()) return
    clearTimeout(entryTimer)
    entryReady.value = result.status === 'applied'
    entryFailed.value = !entryReady.value
    if (entryReady.value) deliverDraft()
    else clearTimeout(deliveryTimer)
    return
  }
  if (result.source === 'eiscore-harness' && result.protocol === WORKER_DRAFT_PROTOCOL) {
    const draft = businessHarnessState.pendingDraft
    if (!draft || result.id !== draft.id || !['proposal', 'applied', 'cancelled', 'error'].includes(result.type)) return
    if (result.type === 'proposal') {
      if (draftDecisionId === result.id) return
      draftDecisionId = result.id
      const decide = async () => {
        let accepted = true
        if (result.hasExistingDraft === true) {
          try {
            await ElMessageBox.confirm('工作助手输入框已有草稿。是否用本次内容替换？', '确认替换草稿', {
              confirmButtonText: '替换草稿',
              cancelButtonText: '保留现有草稿',
              type: 'warning'
            })
          } catch { accepted = false }
        }
        if (businessHarnessState.pendingDraft?.id !== result.id || !frame.value?.contentWindow) return
        frame.value.contentWindow.postMessage({
          source: 'eiscore-host',
          protocol: WORKER_DRAFT_PROTOCOL,
          version: WORKER_DRAFT_VERSION,
          type: accepted ? 'apply' : 'cancel',
          id: result.id
        }, window.location.origin)
      }
      void decide()
      return
    }
    draftDecisionId = ''
    clearTimeout(deliveryTimer)
    if (result.type === 'applied' || result.type === 'cancelled') {
      draftDeliveryFailed.value = false
      businessHarnessState.pendingDraft = null
    } else {
      draftDeliveryFailed.value = false
      businessHarnessState.pendingDraft = null
      ElMessage.error(result.reason === 'draft-changed'
        ? '输入框内容刚刚发生变化，已保留当前草稿'
        : '无法写入工作助手草稿，请在输入框中手动粘贴')
    }
    return
  }
  if (result.type !== 'eiscore:harness-draft-result' || !['applied', 'queued'].includes(result.status)) return
  if (!ready.value || failed.value || !entryReady.value || currentEntry() !== 'worker') return
  if (!hasCurrentAuthorization()) { invalidateAuthorization(); return }
  if (result.id !== businessHarnessState.pendingDraft?.id) return
  clearTimeout(deliveryTimer)
  draftDeliveryFailed.value = false
  businessHarnessState.pendingDraft = null
}

watch(() => props.active, (active) => {
  if (active && authorizationSnapshot && !hasCurrentAuthorization()) invalidateAuthorization()
  if (active && !ready.value && !pending.value && !failed.value) void prepare()
  if (active) syncEntry()
  else { clearTimeout(deliveryTimer); clearTimeout(entryTimer) }
}, { immediate: true })
watch(() => props.entry, () => syncEntry(true), { flush: 'sync' })
watch(() => businessHarnessState.pendingDraft, deliverDraft)
watch(() => userStore.token, () => {
  invalidateAuthorization()
  failed.value = false
  if (props.active) void prepare()
})
onMounted(() => {
  window.addEventListener('message', receiveDraftResult)
  window.addEventListener('message', receiveFileDrop)
})
onBeforeUnmount(() => {
  ++requestId
  clearTimeout(deliveryTimer)
  clearTimeout(entryTimer)
  window.removeEventListener('message', receiveDraftResult)
  window.removeEventListener('message', receiveFileDrop)
})
</script>

<style scoped>
.business-harness-frame { display: flex; flex: 1; flex-direction: column; min-height: 0; background: var(--el-bg-color); }
iframe { width: 100%; height: 100%; flex: 1; min-height: 0; border: 0; }
.harness-status { display: flex; flex: 1; flex-wrap: wrap; align-content: center; justify-content: center; align-items: center; gap: 10px; padding: 20px; color: var(--el-text-color-secondary); }
.draft-retry { padding: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
</style>
