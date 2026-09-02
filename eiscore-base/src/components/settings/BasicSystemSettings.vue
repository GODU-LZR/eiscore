<template>
  <el-divider content-position="left">基础配置</el-divider>
  <el-form-item label="系统标题">
    <el-input v-model="form.title" placeholder="请输入左上角显示标题" />
  </el-form-item>
  <el-form-item label="主题颜色">
    <div class="theme-row">
      <el-color-picker v-model="form.themeColor" />
      <div class="preset-colors">
        <button
          v-for="color in predefineColors"
          :key="color"
          type="button"
          class="color-block"
          :style="{ backgroundColor: color }"
          @click="form.themeColor = color"
        />
      </div>
    </div>
  </el-form-item>
  <el-form-item label="开启通知">
    <el-switch v-model="form.notifications" />
  </el-form-item>
  <el-form-item label="物料分类层级">
    <el-radio-group v-model="form.materialsCategoryDepth">
      <el-radio :label="2">二级</el-radio>
      <el-radio :label="3">三级</el-radio>
    </el-radio-group>
  </el-form-item>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

defineProps({
  form: { type: Object, required: true },
  predefineColors: { type: Array, required: true }
})
</script>
