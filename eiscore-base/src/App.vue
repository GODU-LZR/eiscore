<template>
  <div class="main-layout">
    <el-menu mode="horizontal" :router="true" :default-active="$route.path">
      <el-menu-item index="/">🏠 基座首页</el-menu-item>
      <el-menu-item index="/materials">📦 物料系统</el-menu-item>
      <el-menu-item index="/hr">👥 人事系统</el-menu-item>
    </el-menu>

    <router-view />

    <div id="micro-container"></div>
  </div>
</template>

<style>
#micro-container {
  min-height: 500px;
  padding: 20px;
  background: #f5f7fa;
}
</style>