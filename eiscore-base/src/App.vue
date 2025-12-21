<template>
  <router-view />
</template>

<style>
/* 全局重置样式 */
body, html, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
}

/* 引用 Element Plus 的标准背景色变量 */
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  
  /* 👇 关键：让背景色跟随主题变化 */
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  transition: background-color 0.3s, color 0.3s; /* 加个过渡动画更丝滑 */
}

/* 修复暗黑模式下微前端容器可能出现的白边 */
#micro-container {
  background-color: var(--el-bg-color-page) !important;
}
</style>