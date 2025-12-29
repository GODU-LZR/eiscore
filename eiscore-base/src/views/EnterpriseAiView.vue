<template>
  <div class="enterprise-ai-view">
    <AiCopilot mode="enterprise" :auto-open="true" close-route="/" />
  </div>
</template>

<script setup>
import { onActivated } from 'vue'
import AiCopilot from '@/components/AiCopilot.vue'
import { aiBridge } from '@/utils/ai-bridge'

onActivated(() => {
  aiBridge.setMode('enterprise')
  aiBridge.openWindow()
})
</script>

<style scoped lang="scss">
.enterprise-ai-view {
  width: 100%;
  height: 100%;
}
</style>

