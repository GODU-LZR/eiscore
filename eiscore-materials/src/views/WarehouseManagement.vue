<template>
  <div class="warehouse-management">
    <div class="warehouse-sidebar">
      <WarehouseTree @select="handleWarehouseSelect" />
    </div>

    <div class="warehouse-main">
      <el-tabs v-model="activeTab" v-if="selectedWarehouse">
        <el-tab-pane label="基本信息" name="info">
          <el-card shadow="never">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="仓库编码">{{ selectedWarehouse.code }}</el-descriptions-item>
              <el-descriptions-item label="仓库名称">{{ selectedWarehouse.name }}</el-descriptions-item>
              <el-descriptions-item label="层级">
                <el-tag v-if="selectedWarehouse.level === 1" type="success">仓库</el-tag>
                <el-tag v-else-if="selectedWarehouse.level === 2" type="warning">库区</el-tag>
                <el-tag v-else type="info">库位</el-tag>
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
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="布局编辑" name="layout" v-if="selectedWarehouse.level === 1">
          <WarehouseLayoutEditor :warehouse-id="selectedWarehouse.id" @saved="handleLayoutSaved" />
        </el-tab-pane>
      </el-tabs>

      <el-empty v-else description="请选择仓库" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import WarehouseTree from '@/components/WarehouseTree.vue'
import WarehouseLayoutEditor from '@/components/WarehouseLayoutEditor.vue'

const selectedWarehouse = ref(null)
const activeTab = ref('info')

const handleWarehouseSelect = (warehouse) => {
  selectedWarehouse.value = warehouse
  activeTab.value = 'info'
}

const handleLayoutSaved = () => {
  // Child component handles its own toast.
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style scoped>
.warehouse-management {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  background: #f5f7fa;
}

.warehouse-sidebar {
  width: 360px;
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
  padding: 16px;
}

:deep(.el-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

:deep(.el-tab-pane) {
  height: 100%;
  overflow: auto;
  min-height: 0;
}
</style>
