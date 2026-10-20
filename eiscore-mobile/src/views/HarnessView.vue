<template>
  <main class="mobile-harness" :aria-busy="loading">
    <iframe v-if="ready" class="mobile-harness__frame" src="/harness-embed/" title="DeepSeek Harness 工作台"></iframe>
    <div v-else class="mobile-harness__status" role="status">
      {{ failed ? 'DeepSeek Harness 认证失败，请重新登录' : '正在建立 Harness 会话' }}
    </div>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getToken } from '@/utils/auth'
import { prepareHarnessAuth } from '@eiscore/platform/harness-auth'

const loading = ref(true)
const ready = ref(false)
const failed = ref(false)

onMounted(async () => {
  const token = getToken()
  ready.value = await prepareHarnessAuth({
    harnessWebUrl: '/harness-embed/',
    authorization: token ? `Bearer ${token}` : ''
  })
  failed.value = !ready.value
  loading.value = false
})
</script>

<style scoped>
.mobile-harness { width: 100%; min-height: 100vh; background: #f8fafc; }
.mobile-harness__frame { display: block; width: 100%; height: 100vh; border: 0; }
.mobile-harness__status { min-height: 100vh; display: grid; place-items: center; color: #64748b; }
</style>
