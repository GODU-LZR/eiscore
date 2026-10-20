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
        <iframe v-if="ready && !failed" class="harness-assistant-frame" src="/harness-embed/" title="DeepSeek Harness 工作助手"></iframe>
        <div v-else class="harness-assistant-status" role="status">
          <span>{{ failed ? 'DeepSeek Harness 认证失败，请重新登录' : '正在建立 Harness 会话' }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getAuthHeader } from '@/utils/auth'
import { prepareHarnessAuth } from '@/services/harness-auth-client'

const visible = ref(false)
const pending = ref(false)
const ready = ref(false)
const failed = ref(false)

const open = async () => {
  visible.value = true
  pending.value = true
  failed.value = false
  ready.value = false
  try {
    ready.value = await prepareHarnessAuth({
      harnessWebUrl: '/harness-embed/',
      authorization: getAuthHeader().Authorization || ''
    })
    failed.value = !ready.value
  } catch {
    failed.value = true
  } finally {
    pending.value = false
  }
}

const reset = () => {
  pending.value = false
  ready.value = false
  failed.value = false
}
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
  border: 1px solid #285d57;
  border-radius: 20px;
  background: #285d57;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(15, 56, 51, 0.22);
}
.harness-launcher:hover { background: #1f4b46; }
.harness-launcher__dot { width: 7px; height: 7px; border-radius: 50%; background: #a7f3d0; }
.harness-assistant-frame-wrap { height: min(76vh, 760px); min-height: 420px; background: #f8fafc; }
.harness-assistant-frame { width: 100%; height: 100%; border: 0; display: block; }
.harness-assistant-status { height: 100%; display: grid; place-items: center; color: #64748b; }
@media (max-width: 760px) {
  .harness-launcher { right: 14px; bottom: 14px; }
  .harness-assistant-frame-wrap { min-height: 60vh; }
}
</style>
