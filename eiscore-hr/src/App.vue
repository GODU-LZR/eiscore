<template>
  <div style="border: 5px solid red; padding: 20px; margin: 10px;">
    <h3>🚩 HR 子应用调试区</h3>
    <p>当前路由路径: {{ $route.fullPath }}</p>
    
    <router-view></router-view>
  </div>
</template>

<script setup>
// 无需其他逻辑
</script>