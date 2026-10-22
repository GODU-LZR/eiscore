<template>
  <el-tooltip :content="fullscreen ? '退出全屏' : '全屏'" placement="bottom">
    <button type="button" class="harness-fullscreen-button" :aria-label="fullscreen ? '退出全屏' : '全屏'" :aria-pressed="fullscreen" @click="$emit('toggle')">
      <el-icon><component :is="fullscreen ? ScaleToOriginal : FullScreen" /></el-icon>
    </button>
  </el-tooltip>
</template>

<script setup>
import { FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'

defineProps({ fullscreen: Boolean })
defineEmits(['toggle'])
</script>

<style scoped>
.harness-fullscreen-button { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; font-size: 18px; }
.harness-fullscreen-button:hover { color: var(--el-color-primary); background: var(--el-fill-color-light); }
.harness-fullscreen-button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
</style>
