<template>
  <router-view v-slot="{ Component }">
    <keep-alive :include="['HomeView']">
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>

<script setup>
// 移动端根组件 — 无额外布局壳
</script>

<style>
:root {
  --eis-primary: #1677ff;
  --eis-primary-dark: #0958d9;
  --eis-bg: #f5f7fa;
  --eis-card-bg: #ffffff;
  --eis-text: #1f2937;
  --eis-text-secondary: #6b7280;
  --eis-border: #e5e7eb;
  --eis-success: #22c55e;
  --eis-warning: #f59e0b;
  --eis-danger: #ef4444;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html, body, #app {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
  background: var(--eis-bg);
  color: var(--eis-text);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

/* 安全区适配 */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
