<template>
  <button v-if="!excluded && workerVisible && !businessHarnessState.assistantOpen && !workspaceVisible" type="button" class="worker-trigger" data-guide="worker-assistant" @click="openHarnessAssistant()">
    <img class="worker-logo" :src="deepseekIcon" alt="" aria-hidden="true" /><span>工作助手</span>
  </button>
  <section v-show="visible" class="harness-host" :class="{ 'is-workspace': workspaceVisible, 'is-fullscreen': fullscreen && !workspaceVisible, 'is-file-drop-target': fileDropActive }" :style="workspaceStyle" aria-label="DeepSeek Harness 工作助手" @dragenter="handleHostDragEnter" @dragover="handleHostDragOver" @dragleave="handleHostDragLeave" @drop="handleHostDrop">
    <header v-show="!workspaceVisible" class="worker-header">
      <strong>DeepSeek Harness</strong>
      <HarnessFullscreenButton :fullscreen="fullscreen" @toggle="toggleFullscreen" />
      <button type="button" class="worker-close" aria-label="关闭工作助手" @click="closeAssistant"><el-icon><Close /></el-icon></button>
    </header>
    <BusinessHarnessFrame ref="harnessFrameRef" v-if="started && !excluded" :active="visible" :entry="workspaceVisible ? 'workbench' : 'worker'" @file-drop-finished="fileDropActive = false" @file-drop-progress="handleFileDropProgress" />
    <div v-if="fileDropActive" class="file-drop-capture" aria-hidden="true">释放文件以添加</div>
    <div v-if="fileDropProgress.active" class="file-drop-status" role="status" aria-live="polite">{{ fileDropStatusText }}</div>
  </section>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getWorkerFullscreen, saveWorkerFullscreen } from '@shared/eis-ui-preferences.mjs'
import { useUserStore } from '@/stores/user'
import { businessHarnessState, isStandaloneBusinessHarnessPath, openHarnessAssistant, resetBusinessHarness } from '@/services/business-harness-controller'
import BusinessHarnessFrame from './BusinessHarnessFrame.vue'
import HarnessFullscreenButton from './HarnessFullscreenButton.vue'
import deepseekIcon from '@/assets/deepseek-color.svg'

const props = defineProps({ workerVisible: Boolean })
const route = useRoute()
const userStore = useUserStore()
const fullscreen = ref(getWorkerFullscreen())
const started = ref(false)
const workspaceStyle = ref({})
const fileDropActive = ref(false)
const fileDropProgress = ref({ active: false, status: '', completed: 0, total: 0, failed: 0 })
const harnessFrameRef = ref(null)
const excluded = computed(() => /^\/apps\/flash-builder(?:\/|$)/.test(route.path) || isStandaloneBusinessHarnessPath(route.path))
const workspaceVisible = computed(() => !excluded.value && !businessHarnessState.workerCommandActive && (route.path === '/workbench' || route.path === '/') && !!businessHarnessState.workspace)
const visible = computed(() => !excluded.value && (workspaceVisible.value || ((props.workerVisible || businessHarnessState.workerCommandActive) && businessHarnessState.assistantOpen)))
let resizeObserver

function measureWorkspace() {
  const element = businessHarnessState.workspace
  if (!workspaceVisible.value || !element) { workspaceStyle.value = {}; return }
  const rect = element.getBoundingClientRect()
  workspaceStyle.value = { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` }
}
function toggleFullscreen() {
  fullscreen.value = !fullscreen.value
  saveWorkerFullscreen(fullscreen.value)
}
function closeAssistant() {
  businessHarnessState.assistantOpen = false
  businessHarnessState.workerCommandActive = false
}
function hasFiles(event) {
  return Array.from(event?.dataTransfer?.types || []).includes('Files')
}
function handleHostDragEnter(event) {
  if (!hasFiles(event)) return
  event.preventDefault()
  fileDropActive.value = true
}
function handleHostDragOver(event) {
  if (!hasFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  fileDropActive.value = true
}
function handleHostDragLeave(event) {
  if (!fileDropActive.value) return
  const nextTarget = event.relatedTarget
  if (nextTarget && event.currentTarget?.contains?.(nextTarget)) return
  fileDropActive.value = false
}
function handleHostDrop(event) {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.stopPropagation()
  fileDropActive.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (!files.length) return
  if (typeof harnessFrameRef.value?.acceptDroppedFiles !== 'function') {
    ElMessage.warning('工作助手正在加载，请稍后重试')
    return
  }
  void harnessFrameRef.value.acceptDroppedFiles(files)
}
function handleFileDropProgress(progress) {
  const status = String(progress?.status || '')
  if (status === 'started' || status === 'progress') {
    fileDropProgress.value = {
      active: true,
      status,
      completed: Number(progress.completed) || 0,
      total: Number(progress.total) || 0,
      failed: 0
    }
    return
  }
  fileDropProgress.value = {
    active: false,
    status,
    completed: Number(progress?.completed) || 0,
    total: Number(progress?.total) || 0,
    failed: Number(progress?.failed) || 0
  }
}
const fileDropStatusText = computed(() => {
  const { completed, total } = fileDropProgress.value
  return total ? `正在上传文件 ${completed}/${total}，可继续整理文字草稿` : '正在准备文件上传'
})
function handleWorkerCommand(event) {
  const detail = event?.detail
  if (!detail || typeof detail !== 'object') return
  openHarnessAssistant({ type: 'open-worker', id: detail.id, prompt: detail.prompt })
}
watch(visible, (value) => { if (value) started.value = true })
watch(excluded, (value) => { if (value) { resetBusinessHarness(); started.value = false } })
watch(() => userStore.token, resetBusinessHarness)
watch([() => businessHarnessState.workspace, workspaceVisible], () => {
  resizeObserver?.disconnect()
  if (businessHarnessState.workspace) resizeObserver?.observe(businessHarnessState.workspace)
  measureWorkspace()
}, { flush: 'post' })
onMounted(() => {
  resizeObserver = new ResizeObserver(measureWorkspace)
  if (businessHarnessState.workspace) resizeObserver.observe(businessHarnessState.workspace)
  measureWorkspace()
  if (visible.value) started.value = true
  window.addEventListener('resize', measureWorkspace)
  window.addEventListener('scroll', measureWorkspace, true)
  window.addEventListener('eis-harness-open-worker', handleWorkerCommand)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measureWorkspace)
  window.removeEventListener('scroll', measureWorkspace, true)
  window.removeEventListener('eis-harness-open-worker', handleWorkerCommand)
  resetBusinessHarness()
})
</script>

<style scoped>
.worker-trigger { position: fixed; bottom: 30px; right: 30px; z-index: 2000; width: 60px; height: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; border: 1px solid var(--el-border-color-lighter); border-radius: 16px; background: var(--el-bg-color); color: #4d6bfe; cursor: pointer; box-shadow: 0 4px 18px #0002; }
.worker-logo { display: block; width: 28px; height: 28px; object-fit: contain; }
.worker-trigger span:last-child { font-size: 10px; }
.harness-host { position: fixed; top: 80px; right: 30px; width: 380px; height: calc(100dvh - 160px); box-sizing: border-box; z-index: 2000; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--el-border-color); border-radius: 16px; background: var(--el-bg-color); box-shadow: 0 8px 32px #0003; }
.harness-host.is-file-drop-target { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px var(--el-color-primary-light-8), 0 8px 32px #0003; }
.file-drop-capture { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; pointer-events: none; color: var(--el-color-primary); background: rgba(255, 255, 255, .72); font-size: 14px; font-weight: 600; }
.file-drop-status { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 5; padding: 8px 12px; border: 1px solid var(--el-border-color); border-radius: 8px; color: var(--el-text-color-regular); background: color-mix(in srgb, var(--el-bg-color) 94%, var(--el-color-primary)); box-shadow: 0 4px 16px #0002; font-size: 12px; text-align: center; }
.harness-host.is-workspace { right: auto; z-index: 1; border: 0; border-radius: 0; box-shadow: none; }
.harness-host.is-fullscreen { inset: 0; width: 100%; height: 100dvh; border-radius: 0; }
.worker-header { height: 52px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding: 0 12px; border-bottom: 1px solid var(--el-border-color); color: var(--el-text-color-primary); }
.worker-header strong { flex: 1; font-size: 14px; }
.worker-close { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; font-size: 18px; }
.worker-close:hover { background: var(--el-fill-color-light); }
button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
@media (max-width: 600px) {
  .harness-host:not(.is-workspace):not(.is-fullscreen) { top: 64px; right: 8px; width: min(380px, calc(100vw - 16px)); height: calc(100dvh - 80px); }
  .worker-trigger { right: 16px; bottom: 20px; }
}
</style>
