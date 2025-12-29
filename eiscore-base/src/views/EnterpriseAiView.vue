<template>
  <div class="enterprise-ai-view">
    <AiCopilot mode="enterprise" :auto-open="true" close-route="/" />
  </div>
</template>

<script setup>
import AiCopilot from '@/components/AiCopilot.vue'
</script>

<style scoped lang="scss">
.enterprise-ai-view {
  width: 100%;
  height: 100%;
}
</style>

