<template>
  <div class="materials-layout">
    <div class="page-header">
      <div class="header-text">
        <h2>{{ app.name }}</h2>
        <p>{{ app.desc }}</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <div class="content-area">
      <div class="left-panel">
        <MaterialCategoryTree @select="handleCategorySelect" />
      </div>
      <div class="right-panel">
        <MaterialAppGrid
          ref="gridRef"
          :key="`${app.key}-${selectedCategoryKey}`"
          :app-key="app.key"
          :app-config="appOverride"
          :category="selectedCategoryLabel"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MaterialCategoryTree from '@/components/MaterialCategoryTree.vue'
import MaterialAppGrid from '@/components/MaterialAppGrid.vue'
import { findMaterialApp, MATERIAL_APPS } from '@/utils/material-apps'

const props = defineProps({
  appKey: { type: String, default: 'a' }
})

const router = useRouter()
const gridRef = ref(null)
const selectedCategory = ref(null)

const app = computed(() => findMaterialApp(props.appKey) || MATERIAL_APPS[0])

const selectedCategoryLabel = computed(() => selectedCategory.value?.label || '')
const selectedCategoryKey = computed(() => selectedCategoryLabel.value || 'all')

const appOverride = computed(() => {
  const base = app.value || {}
  const apiUrl = base.apiUrl || '/raw_materials'
  const writeUrl = apiUrl.split('?')[0]
  if (!selectedCategoryLabel.value) {
    return { ...base, apiUrl, writeUrl }
  }
  const filter = `category=eq.${encodeURIComponent(selectedCategoryLabel.value)}`
  return {
    ...base,
    apiUrl: apiUrl.includes('?') ? `${apiUrl}&${filter}` : `${apiUrl}?${filter}`,
    writeUrl
  }
})

const handleCategorySelect = (node) => {
  selectedCategory.value = node
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
}

.left-panel {
  width: 280px;
  flex-shrink: 0;
}

.right-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
</style>
