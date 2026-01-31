<template>
  <div class="materials-layout">
    <div class="page-header">
      <div class="header-text">
        <h2>{{ app.name }}</h2>
        <p>{{ app.desc }}</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <div class="content-area" :style="{ '--sidebar-width': sidebarCollapsed ? '0px' : '280px' }">
      <div class="left-panel" :class="{ collapsed: sidebarCollapsed }">
        <MaterialCategoryTree v-show="!sidebarCollapsed" @select="handleCategorySelect" />
      </div>
      <div class="right-panel">
        <MaterialAppGrid
          ref="gridRef"
          :key="`${app.key}-${selectedCategoryKey}`"
          :app-key="app.key"
          :app-config="appOverride"
          :category="selectedCategoryCode"
        />
      </div>
      <div class="sidebar-toggle" @click="toggleSidebar">
        <el-icon><component :is="sidebarCollapsed ? ArrowRight : ArrowLeft" /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import MaterialCategoryTree from '@/components/MaterialCategoryTree.vue'
import MaterialAppGrid from '@/components/MaterialAppGrid.vue'
import { findMaterialApp, MATERIAL_APPS } from '@/utils/material-apps'

const props = defineProps({
  appKey: { type: String, default: 'a' }
})

const router = useRouter()
const gridRef = ref(null)
const selectedCategory = ref(null)
const sidebarCollapsed = ref(false)

const app = computed(() => findMaterialApp(props.appKey) || MATERIAL_APPS[0])

const selectedCategoryCode = computed(() => selectedCategory.value?.id || '')
const selectedCategoryKey = computed(() => selectedCategoryCode.value || 'all')

const appOverride = computed(() => {
  const base = app.value || {}
  const apiUrl = base.apiUrl || '/raw_materials'
  const writeUrl = apiUrl.split('?')[0]
  if (!selectedCategoryCode.value) {
    return { ...base, apiUrl, writeUrl }
  }
  const filter = `category=eq.${encodeURIComponent(selectedCategoryCode.value)}`
  return {
    ...base,
    apiUrl: apiUrl.includes('?') ? `${apiUrl}&${filter}` : `${apiUrl}?${filter}`,
    writeUrl
  }
})

const handleCategorySelect = (node) => {
  selectedCategory.value = node
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const goApps = () => {
  router.push('/apps')
}
</script>

<style scoped>
.materials-layout {
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #f5f7fa;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  background: #fff;
  padding: 12px 16px;
  border-radius: 6px;
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

.content-area {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
  position: relative;
}

.left-panel {
  width: 280px;
  flex-shrink: 0;
  position: relative;
  transition: width 0.2s ease;
  overflow: visible;
}

.left-panel.collapsed {
  width: 0;
  overflow: hidden;
}

 .sidebar-toggle {
  position: absolute;
  top: 12px;
  left: calc(var(--sidebar-width) + 8px);
  width: 28px;
  height: 28px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  z-index: 5;
}

.right-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
</style>
