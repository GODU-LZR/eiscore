<template>
  <div v-show="active" class="business-harness-frame" :aria-busy="pending">
    <iframe v-if="ready && !failed" ref="frame" :src="harnessPersona.webPath" :title="harnessPersona.id === 'workbench' ? 'DeepSeek Harness 工作台' : 'DeepSeek Harness 工作助手'" @load="deliverDraft" @error="failed = true" />
    <div v-else class="harness-status" role="status" aria-live="polite">
      <el-icon v-if="pending" class="is-loading"><Loading /></el-icon>
      <span>{{ failed ? 'DeepSeek Harness 加载失败，请重试' : '正在加载 DeepSeek Harness' }}</span>
      <el-button v-if="failed && !pending" size="small" @click="prepare">重试</el-button>
    </div>
    <div v-if="draftDeliveryFailed" class="draft-retry" role="status">
      指令尚未交接，草稿已保留。<el-button size="small" @click="deliverDraft">重试交接</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getAuthHeader } from '@/utils/auth'
import { prepareBusinessHarnessAuth } from '@/services/business-harness-auth'
import { businessHarnessState } from '@/services/business-harness-controller'

const props = defineProps({ active: Boolean, persona: { type: String, default: 'work-assistant' } })
const userStore = useUserStore()
const HARNESS_FRAME_PERSONAS = Object.freeze({
  'work-assistant': Object.freeze({ id: 'work-assistant', webPath: '/harness-assistant-embed/' }),
  workbench: Object.freeze({ id: 'workbench', webPath: '/harness-workbench-embed/' })
})
const harnessPersona = computed(() => HARNESS_FRAME_PERSONAS[props.persona] || HARNESS_FRAME_PERSONAS['work-assistant'])
const draftEnabled = computed(() => harnessPersona.value.id === 'work-assistant')
const frame = ref(null)
const ready = ref(false)
const pending = ref(false)
const failed = ref(false)
const draftDeliveryFailed = ref(false)
let requestId = 0
let deliveryTimer
let attempts = 0

async function prepare() {
  if (pending.value) return
  const id = ++requestId
  pending.value = true
  failed.value = false
  ready.value = false
  let success = false
  const authorization = getAuthHeader().Authorization || ''
  try {
    success = await prepareBusinessHarnessAuth({ persona: harnessPersona.value.id, harnessWebUrl: harnessPersona.value.webPath, authorization }, () => id === requestId && !!authorization)
  } catch { success = false }
  if (id !== requestId) return
  ready.value = success
  pending.value = false
  failed.value = !success
}

function deliverDraft() {
  clearTimeout(deliveryTimer)
  if (!draftEnabled.value) return
  const draft = businessHarnessState.pendingDraft
  if (!draft || !props.active || !frame.value?.contentWindow) return
  draftDeliveryFailed.value = false
  attempts = 0
  const send = () => {
    if (businessHarnessState.pendingDraft !== draft || !props.active || !frame.value?.contentWindow) return
    frame.value.contentWindow.postMessage({ type: 'eiscore:harness-draft', version: 1, ...draft }, window.location.origin)
    if (++attempts < 10) deliveryTimer = setTimeout(send, 1000)
    else draftDeliveryFailed.value = true
  }
  send()
}

function receiveDraftResult(event) {
  if (!draftEnabled.value) return
  const result = event.data
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  if (result?.type !== 'eiscore:harness-draft-result' || result.version !== 1 || !['applied', 'queued'].includes(result.status)) return
  if (result.id !== businessHarnessState.pendingDraft?.id) return
  clearTimeout(deliveryTimer)
  draftDeliveryFailed.value = false
  businessHarnessState.pendingDraft = null
}

watch(() => props.active, (active) => {
  if (active && !ready.value && !pending.value && !failed.value) void prepare()
  if (active) deliverDraft()
  else clearTimeout(deliveryTimer)
}, { immediate: true })
watch(() => businessHarnessState.pendingDraft, deliverDraft)
watch(() => userStore.token, () => {
  ++requestId
  clearTimeout(deliveryTimer)
  draftDeliveryFailed.value = false
  ready.value = false
  pending.value = false
  failed.value = false
  if (props.active) void prepare()
})
onMounted(() => window.addEventListener('message', receiveDraftResult))
onBeforeUnmount(() => {
  ++requestId
  clearTimeout(deliveryTimer)
  window.removeEventListener('message', receiveDraftResult)
})
</script>

<style scoped>
.business-harness-frame { display: flex; flex: 1; flex-direction: column; min-height: 0; background: var(--el-bg-color); }
iframe { width: 100%; height: 100%; flex: 1; min-height: 0; border: 0; }
.harness-status { display: flex; flex: 1; flex-wrap: wrap; align-content: center; justify-content: center; align-items: center; gap: 10px; padding: 20px; color: var(--el-text-color-secondary); }
.draft-retry { padding: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
</style>
