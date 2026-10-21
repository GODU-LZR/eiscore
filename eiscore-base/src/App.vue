<template>
  <router-view />
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useHostDarkMode } from '@/platform/theme-mode'

const systemStore = useSystemStore()
useHostDarkMode()

onMounted(async () => {
  await systemStore.loadConfig()
  // 初始化系统配置（应用保存的主题色等）
  systemStore.initTheme()
})
</script>

<style>
html[data-eis-surface]:not(.dark) {
  color-scheme: light;
  --el-bg-color-page: var(--eis-surface-color);
  --el-bg-color: var(--eis-surface-color);
  --el-bg-color-overlay: var(--eis-surface-color);
  --el-fill-color-blank: var(--eis-surface-color);
  --el-fill-color-light: color-mix(in srgb, var(--eis-surface-color) 92%, #222b28);
  --el-fill-color-lighter: color-mix(in srgb, var(--eis-surface-color) 96%, #222b28);
  --el-fill-color-extra-light: var(--eis-surface-color);
}

/* Keep the configured light surface when the public login follows OS dark media rules. */
html[data-eis-surface] .login-page,
html[data-eis-surface] .auth-card {
  background: var(--eis-surface-color) !important;
  color: #222b28;
}
html[data-eis-surface] .auth-card {
  border-color: #dcded5 !important;
}
html[data-eis-surface] .auth-card h2,
html[data-eis-surface] .login-form .el-input__inner,
html[data-eis-surface] .login-form .el-form-item__label {
  color: #222b28;
}
html[data-eis-surface] .login-form .el-input__wrapper,
html[data-eis-surface] .auth-close {
  background: var(--eis-surface-color);
}
html[data-eis-surface] .auth-close,
html[data-eis-surface] .auth-subtitle,
html[data-eis-surface] .auth-footnote,
html[data-eis-surface] .safe-note {
  color: #69716c;
}
html[data-eis-surface] body .auth-overlay {
  background: rgba(39, 37, 31, 0.58) !important;
}
html[data-eis-surface] body .auth-overlay .login-form .el-input__wrapper,
html[data-eis-surface] body .auth-overlay .login-form .el-input__wrapper.is-focus {
  background: var(--eis-surface-color) !important;
  box-shadow: 0 0 0 1px #c8c5b9 inset;
}
html[data-eis-surface] body .auth-overlay .login-form .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px var(--login-theme) inset, 0 6px 14px rgba(52, 48, 38, 0.1);
}
html[data-eis-surface] body .auth-overlay .login-form .el-input__inner,
html[data-eis-surface] body .auth-overlay .login-form .el-checkbox__label {
  color: #222b28 !important;
}
html[data-eis-surface] body .auth-overlay .login-form .el-checkbox__inner {
  border-color: #8b9086;
  background: var(--eis-surface-color);
}

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
