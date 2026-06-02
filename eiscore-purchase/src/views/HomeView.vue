<template>
  <div class="module-home">
    <el-card class="module-card" shadow="hover">
      <template #header>
        <div class="header">采购模块</div>
      </template>
      <p>采购子模块已接入基座，可在此承载采购业务应用。</p>
      <p class="path">当前入口：`/purchase/apps`</p>
    </el-card>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

</script>

<style scoped>
.module-home {
  min-height: 100%;
  box-sizing: border-box;
  padding: 24px;
  background: linear-gradient(140deg, #f7f9fc, #eef3fb);
}

.module-card {
  max-width: 760px;
  border-radius: 12px;
}

.header {
  font-size: 18px;
  font-weight: 600;
}

.path {
  margin-top: 8px;
  color: #606266;
}
</style>
