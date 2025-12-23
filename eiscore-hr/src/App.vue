<template>
  <router-view />
</template>

<script setup>
// 这里不需要任何逻辑，路由会接管一切
</script>

<style>
/* 确保子应用占满容器，不留白边 */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
}

#app {
  height: 100%;
}
</style>