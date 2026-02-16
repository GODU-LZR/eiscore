<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()

onMounted(async () => {
  await systemStore.loadConfig()
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

.dark body,
.dark #app {
  background-color: #0b0f14;
  color: #f3f4f6;
}
.dark #app a,
.dark #app p,
.dark #app span,
.dark #app div,
.dark #app li {
  color: inherit;
}
.dark #app .el-card,
.dark #app .el-dialog,
.dark #app .el-message-box,
.dark #app .el-popover,
.dark #app .el-dropdown-menu,
.dark #app .el-tooltip__popper {
  background-color: #0f172a;
  color: #f3f4f6;
  border-color: #1f2937;
}
.dark #app .el-card__header,
.dark #app .el-dialog__header,
.dark #app .el-message-box__header {
  border-bottom-color: #1f2937;
  color: #f3f4f6;
}
.dark #app .el-form-item__label,
.dark #app .el-breadcrumb__inner,
.dark #app .el-breadcrumb__separator {
  color: #f3f4f6;
}
.dark #app .el-input__wrapper,
.dark #app .el-textarea__inner,
.dark #app .el-select__wrapper,
.dark #app .el-select-dropdown,
.dark #app .el-input-number {
  background-color: #0b0f14;
  border-color: #1f2937;
  color: #f3f4f6;
  box-shadow: none;
}
.dark #app .el-input__inner,
.dark #app .el-textarea__inner {
  color: #f3f4f6;
}
.dark #app .el-button:not(.is-text):not(.is-link) {
  background-color: #0f172a;
  border-color: #1f2937;
  color: #f3f4f6;
}
.dark #app .el-button.is-disabled {
  background-color: #0b0f14;
  border-color: #1f2937;
  color: #6b7280;
}
.dark #app .el-tabs__item,
.dark #app .el-tabs__nav {
  color: #f3f4f6;
  border-color: #1f2937;
}
.dark #app .el-switch__core {
  background-color: #111827;
}

/* Keep message position stable in host + qiankun sub-apps */
.el-message {
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
}
</style>
