<template>
  <button v-if="!excluded && workerVisible && !businessHarnessState.assistantOpen && !workspaceVisible" type="button" class="worker-trigger" data-guide="worker-assistant" @click="openHarnessAssistant()">
    <img class="worker-logo" :src="deepseekIcon" alt="" aria-hidden="true" /><span>工作助手</span>
  </button>
  <section v-show="visible" class="harness-host" :class="{ 'is-workspace': workspaceVisible, 'is-fullscreen': fullscreen && !workspaceVisible }" :style="workspaceStyle" aria-label="DeepSeek Harness 工作助手">
    <header v-show="!workspaceVisible" class="worker-header">
      <strong>DeepSeek Harness</strong>
      <HarnessFullscreenButton :fullscreen="fullscreen" @toggle="toggleFullscreen" />
      <button type="button" class="worker-close" aria-label="关闭工作助手" @click="closeAssistant"><el-icon><Close /></el-icon></button>
    </header>
    <BusinessHarnessFrame v-if="started && !excluded" :active="visible" :entry="workspaceVisible ? 'workbench' : 'worker'" />
  </section>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Close } from '@element-plus/icons-vue'
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
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measureWorkspace)
  window.removeEventListener('scroll', measureWorkspace, true)
  resetBusinessHarness()
})
</script>

<style scoped>
.worker-trigger { position: fixed; bottom: 30px; right: 30px; z-index: 2000; width: 60px; height: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; border: 1px solid var(--el-border-color-lighter); border-radius: 16px; background: var(--el-bg-color); color: #4d6bfe; cursor: pointer; box-shadow: 0 4px 18px #0002; }
.worker-logo { display: block; width: 28px; height: 28px; object-fit: contain; }
.worker-trigger span:last-child { font-size: 10px; }
.harness-host { position: fixed; top: 80px; right: 30px; width: 380px; height: calc(100dvh - 160px); box-sizing: border-box; z-index: 2000; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--el-border-color); border-radius: 16px; background: var(--el-bg-color); box-shadow: 0 8px 32px #0003; }
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
