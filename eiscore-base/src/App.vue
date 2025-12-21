<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()

onMounted(() => {
  // 初始化系统配置（应用保存的主题色等）
  systemStore.initTheme()
})
</script>

<style>
/* 可以在这里设置全局的基础样式 */
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>