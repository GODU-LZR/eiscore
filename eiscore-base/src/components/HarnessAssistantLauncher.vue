<template>
  <div class="harness-assistant-launcher">
    <button class="harness-launcher" type="button" aria-label="打开 DeepSeek Harness 工作助手" @click="open">
      <span class="harness-launcher__dot" aria-hidden="true"></span>
      <span>工作助手</span>
    </button>
    <el-dialog
      v-model="visible"
      title="DeepSeek Harness 工作助手"
      width="min(1180px, 94vw)"
      top="5vh"
      destroy-on-close
      class="harness-assistant-dialog"
      @closed="reset"
    >
      <div class="harness-assistant-frame-wrap" :aria-busy="pending">
        <iframe
          v-if="ready && !failed"
          ref="frameRef"
          class="harness-assistant-frame"
          src="/harness-embed/"
          title="DeepSeek Harness 工作助手"
          @load="flushWorkerCommand"
        ></iframe>
        <div v-else class="harness-assistant-status" role="status">
          <span>{{ failed ? 'DeepSeek Harness 认证失败，请重新登录' : '正在建立 Harness 会话' }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAuthHeader } from '@/utils/auth'
import { prepareHarnessAuth } from '@/services/harness-auth-client'

const WORKER_DRAFT_PROTOCOL = 'eiscore-harness-worker-draft'
const WORKER_DRAFT_VERSION = 1
const MAX_WORKER_PROMPT_LENGTH = 20000
const visible = ref(false)
const pending = ref(false)
const ready = ref(false)
const failed = ref(false)
const frameRef = ref(null)
const workerCommands = []
const knownWorkerCommandIds = new Set()
let authPromise = null

const harnessOrigin = () => new URL('/harness-embed/', window.location.href).origin

const rememberCommandId = (id) => {
  if (knownWorkerCommandIds.has(id)) return false
  knownWorkerCommandIds.add(id)
  if (knownWorkerCommandIds.size > 100) knownWorkerCommandIds.delete(knownWorkerCommandIds.values().next().value)
  return true
}

const sendWorkerMessage = (message) => {
  const target = frameRef.value?.contentWindow
  if (!target) return false
  target.postMessage({
    source: 'eiscore-host',
    protocol: WORKER_DRAFT_PROTOCOL,
    version: WORKER_DRAFT_VERSION,
    ...message
  }, harnessOrigin())
  return true
}

const flushWorkerCommand = () => {
  const command = workerCommands[0]
  if (!command || command.sent || !ready.value) return
  command.sent = sendWorkerMessage({ type: 'prepare', id: command.id, prompt: command.prompt })
}

const finishWorkerCommand = (id) => {
  if (workerCommands[0]?.id !== id) return
  workerCommands.shift()
  flushWorkerCommand()
}

const handleHarnessMessage = async (event) => {
  if (event.origin !== harnessOrigin() || event.source !== frameRef.value?.contentWindow) return
  const message = event.data
  if (!message || message.source !== 'eiscore-harness' || message.protocol !== WORKER_DRAFT_PROTOCOL || message.version !== WORKER_DRAFT_VERSION) return
  const active = workerCommands[0]
  if (!active || active.id !== message.id) return

  if (message.type === 'proposal') {
    if (active.confirming || active.decided) return
    active.confirming = true
    let accepted = true
    if (message.hasExistingDraft === true) {
      try {
        await ElMessageBox.confirm(
          '工作助手输入框已有草稿。是否用本次内容替换？',
          '确认替换草稿',
          { confirmButtonText: '替换草稿', cancelButtonText: '保留现有草稿', type: 'warning' }
        )
      } catch {
        accepted = false
      }
    }
    if (workerCommands[0] !== active) return
    active.confirming = false
    active.decided = true
    if (!sendWorkerMessage({ type: accepted ? 'apply' : 'cancel', id: active.id })) {
      ElMessage.error('工作助手会话已断开，请重新打开后重试')
      finishWorkerCommand(active.id)
    }
    return
  }

  if (message.type === 'applied') {
    ElMessage.success('草稿已放入工作助手输入框，请检查后手动发送')
    finishWorkerCommand(active.id)
  } else if (message.type === 'cancelled') {
    finishWorkerCommand(active.id)
  } else if (message.type === 'error') {
    ElMessage.error(message.reason === 'draft-changed'
      ? '输入框内容刚刚发生变化，已保留当前草稿'
      : '无法写入工作助手草稿，请在输入框中手动粘贴')
    finishWorkerCommand(active.id)
  }
}

const handleWorkerCommand = (event) => {
  const detail = event?.detail
  const id = String(detail?.id || '')
  const prompt = detail?.prompt
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(id) || typeof prompt !== 'string' || prompt.length > MAX_WORKER_PROMPT_LENGTH) {
    ElMessage.error('工作助手草稿请求无效或内容过长')
    return
  }
  if (workerCommands.length >= 8) {
    ElMessage.warning('工作助手正在处理其他草稿，请稍后重试')
    return
  }
  if (!rememberCommandId(id)) return
  if (prompt.trim()) workerCommands.push({ id, prompt, sent: false, confirming: false, decided: false })
  void open()
}

const open = async () => {
  visible.value = true
  if (ready.value) {
    flushWorkerCommand()
    return
  }
  if (authPromise) return authPromise
  pending.value = true
  failed.value = false
  ready.value = false
  authPromise = (async () => {
    try {
      ready.value = await prepareHarnessAuth({
        harnessWebUrl: '/harness-embed/',
        authorization: getAuthHeader().Authorization || ''
      })
      failed.value = !ready.value
      if (ready.value) flushWorkerCommand()
    } catch {
      failed.value = true
    } finally {
      pending.value = false
      authPromise = null
    }
  })()
  return authPromise
}

const reset = () => {
  pending.value = false
  ready.value = false
  failed.value = false
  workerCommands.length = 0
}

onMounted(() => {
  window.addEventListener('eis-harness-open-worker', handleWorkerCommand)
  window.addEventListener('message', handleHarnessMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('eis-harness-open-worker', handleWorkerCommand)
  window.removeEventListener('message', handleHarnessMessage)
})
</script>

<style scoped>
.harness-launcher {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1200;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--el-color-primary, #9a7b46);
  border-radius: 20px;
  background: var(--el-color-primary, #9a7b46);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(var(--el-color-primary-rgb, 154, 123, 70), 0.22);
}
.harness-launcher:hover { background: var(--el-color-primary-dark-2, #795f36); }
.harness-launcher__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--el-color-primary-light-7, #e8ddc4); }
.harness-assistant-frame-wrap { height: min(76vh, 760px); min-height: 420px; background: #f8fafc; }
.harness-assistant-frame { width: 100%; height: 100%; border: 0; display: block; }
.harness-assistant-status { height: 100%; display: grid; place-items: center; color: #64748b; }
@media (max-width: 760px) {
  .harness-launcher { right: 14px; bottom: 14px; }
  .harness-assistant-frame-wrap { min-height: 60vh; }
}
</style>
