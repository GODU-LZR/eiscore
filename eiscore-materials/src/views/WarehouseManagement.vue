<template>
  <div class="warehouse-page">
    <div class="app-header">
      <div class="header-text">
        <h2>仓库管理</h2>
        <p>维护仓库、库区、库位与仓储布局</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <el-card
      shadow="never"
      class="grid-card warehouse-card"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0' }"
    >
      <div class="warehouse-management">
        <div class="warehouse-sidebar">
          <WarehouseTree @select="handleWarehouseSelect" />
        </div>

        <div class="warehouse-main">
          <template v-if="selectedWarehouse">
            <div class="warehouse-toolbar">
              <div class="toolbar-status">
                <div class="warehouse-title">
                  <span>{{ selectedWarehouse.name }}</span>
                  <small>{{ selectedWarehouse.code }}</small>
                </div>
                <el-tag :type="warehouseLevelTagType" effect="plain">{{ warehouseLevelText }}</el-tag>
                <el-tag :type="selectedWarehouse.status === '启用' ? 'success' : 'info'" effect="plain">
                  {{ selectedWarehouse.status || '未设置' }}
                </el-tag>
              </div>
              <el-radio-group v-model="activeTab" class="warehouse-view-switch">
                <el-radio-button label="info">基本信息</el-radio-button>
                <el-radio-button v-if="selectedWarehouse.level === 1" label="layout">布局编辑</el-radio-button>
              </el-radio-group>
            </div>

            <div class="warehouse-content">
              <div v-if="activeTab === 'info'" class="info-panel">
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="仓库编码">{{ selectedWarehouse.code }}</el-descriptions-item>
                  <el-descriptions-item label="仓库名称">{{ selectedWarehouse.name }}</el-descriptions-item>
                  <el-descriptions-item label="层级">
                    <el-tag :type="warehouseLevelTagType">{{ warehouseLevelText }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="状态">
                    <el-tag :type="selectedWarehouse.status === '启用' ? 'success' : 'info'">
                      {{ selectedWarehouse.status }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="容量" v-if="selectedWarehouse.capacity">
                    {{ selectedWarehouse.capacity }} {{ selectedWarehouse.unit }}
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ formatTime(selectedWarehouse.created_at) }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>

              <WarehouseLayoutEditor
                v-else-if="activeTab === 'layout' && selectedWarehouse.level === 1"
                :warehouse-id="selectedWarehouse.id"
                @saved="handleLayoutSaved"
              />
            </div>
          </template>

          <el-empty v-else class="warehouse-empty" description="请选择仓库" />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import WarehouseTree from '@/components/WarehouseTree.vue'
import WarehouseLayoutEditor from '@/components/WarehouseLayoutEditor.vue'

const router = useRouter()
const selectedWarehouse = ref(null)
const activeTab = ref('info')

const handleWarehouseSelect = (warehouse) => {
  selectedWarehouse.value = warehouse
  activeTab.value = warehouse?.level === 1 && activeTab.value === 'layout' ? 'layout' : 'info'
}

const handleLayoutSaved = () => {
  // Child component handles its own toast.
}

const goApps = () => {
  router.push('/apps')
}

const warehouseLevelText = computed(() => {
  if (selectedWarehouse.value?.level === 1) return '仓库'
  if (selectedWarehouse.value?.level === 2) return '库区'
  return '库位'
})

const warehouseLevelTagType = computed(() => {
  if (selectedWarehouse.value?.level === 1) return 'success'
  if (selectedWarehouse.value?.level === 2) return 'warning'
  return 'info'
})

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style scoped>
.warehouse-page {
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.grid-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
}

.grid-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
}

.warehouse-management {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  background: #fff;
}

.warehouse-sidebar {
  width: 340px;
  flex-shrink: 0;
  min-height: 0;
}

.warehouse-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  padding: 0;
}

.warehouse-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 49px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: #f8f9fa;
}

.toolbar-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.warehouse-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.warehouse-title span {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 700;
  color: #303133;
}

.warehouse-title small {
  font-size: 12px;
  color: #909399;
}

.warehouse-view-switch {
  flex: 0 0 auto;
}

.warehouse-view-switch :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  line-height: 1;
}

.warehouse-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.info-panel {
  padding: 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: #fff;
}

.warehouse-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 960px) {
  .warehouse-page {
    padding: 14px;
  }

  .warehouse-management {
    flex-direction: column;
  }

  .warehouse-sidebar {
    width: 100%;
    height: 320px;
  }
}
</style>
