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
onMounted(() => window.addEventListener('message', receiveDraftResult))
onBeforeUnmount(() => {
  ++requestId
  clearTimeout(deliveryTimer)
  clearTimeout(entryTimer)
  window.removeEventListener('message', receiveDraftResult)
})
</script>

<style scoped>
.business-harness-frame { display: flex; flex: 1; flex-direction: column; min-height: 0; background: var(--el-bg-color); }
iframe { width: 100%; height: 100%; flex: 1; min-height: 0; border: 0; }
.harness-status { display: flex; flex: 1; flex-wrap: wrap; align-content: center; justify-content: center; align-items: center; gap: 10px; padding: 20px; color: var(--el-text-color-secondary); }
.draft-retry { padding: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
</style>
