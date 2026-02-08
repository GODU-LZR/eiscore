<template>
  <div v-if="appData?.app_type === 'data'">
    <AppCenterGrid :app-data="appData" :app-id="appId" />
  </div>

  <div v-else class="app-container">
    <div class="app-header">
      <div class="header-text">
        <h2>{{ appData?.name || '应用' }}</h2>
        <p>{{ appData?.desc || appData?.description || '' }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="goBack">返回应用列表</el-button>
        <el-button v-if="appData?.app_type" @click="openBuilder">打开配置</el-button>
      </div>
    </div>

    <div class="runtime-content" v-loading="loading">
      <el-empty v-if="!appData" description="未找到应用" />

      <template v-else>

        <div v-if="appData.app_type === 'workflow'" class="workflow-runtime">
          <div class="bpmn-canvas" ref="bpmnCanvasRef"></div>
          <div class="workflow-side">
            <el-divider content-position="left">状态映射</el-divider>
            <el-table v-if="stateMappings.length" :data="stateMappings" size="small" border>
              <el-table-column prop="bpmn_task_id" label="任务ID" min-width="160" />
              <el-table-column prop="target_table" label="目标表" min-width="140" />
              <el-table-column prop="state_field" label="状态字段" min-width="120" />
              <el-table-column prop="state_value" label="状态值" min-width="120" />
            </el-table>
            <el-empty v-else description="暂无映射" />
          </div>
        </div>

        <div v-else-if="appData.app_type === 'flash'" class="flash-runtime">
          <el-alert
            title="闪念应用运行依赖构建产物，当前以预览模式展示"
            type="info"
            show-icon
            class="flash-alert"
          />
          <iframe
            v-if="appId"
            :src="`/__preview/${appId}`"
            class="flash-preview"
            sandbox="allow-scripts allow-same-origin"
          ></iframe>
        </div>

        <el-empty v-else description="暂不支持的应用类型" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import Viewer from 'bpmn-js/lib/Viewer'
import AppCenterGrid from '@/components/AppCenterGrid.vue'
import { hasPerm } from '@/utils/permission'
import { resolveAppAclModule } from '@/utils/app-permissions'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

const route = useRoute()
const router = useRouter()

const appId = computed(() => route.params.appId)
const appData = ref(null)
const loading = ref(false)

const stateMappings = ref([])
const bpmnCanvasRef = ref(null)
let bpmnViewer = null

const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})


onMounted(async () => {
  await loadAppData()
  await loadRuntimeData()
})

onUnmounted(() => {
  if (bpmnViewer) {
    bpmnViewer.destroy()
    bpmnViewer = null
  }
})


async function loadAppData() {
  if (!appId.value) return
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(`/api/apps?id=eq.${appId.value}`, {
      headers: getAppCenterHeaders(token)
    })
    appData.value = response.data?.[0] || null
    const moduleKey = resolveAppAclModule(appData.value, appData.value?.config, appId.value)
    if (moduleKey && !hasPerm(`app:${moduleKey}`)) {
      ElMessage.warning('暂无权限访问该应用')
      router.push('/')
      return
    }
  } catch (error) {
    ElMessage.error('加载应用数据失败')
  } finally {
    loading.value = false
  }
}

async function loadRuntimeData() {
  if (!appData.value) return
  if (appData.value.app_type === 'workflow') {
    await initializeBpmnViewer()
    await loadStateMappings()
  }
}


async function initializeBpmnViewer() {
  if (!bpmnCanvasRef.value) return
  if (bpmnViewer) {
    bpmnViewer.destroy()
    bpmnViewer = null
  }
  bpmnViewer = new Viewer({ container: bpmnCanvasRef.value })
  const xml = appData.value?.bpmn_xml
  if (!xml) return
  try {
    await bpmnViewer.importXML(xml)
  } catch (error) {
    console.error(error)
    ElMessage.error('流程加载失败')
  }
}

async function loadStateMappings() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/workflow_state_mappings?workflow_app_id=eq.${appId.value}`,
      {
        headers: getAppCenterHeaders(token)
      }
    )
    stateMappings.value = response.data || []
  } catch (error) {
    ElMessage.error('加载状态映射失败')
  }
}

function openBuilder() {
  if (!appData.value) return
  const map = {
    workflow: '/workflow-designer/',
    data: '/data-app/',
    flash: '/flash-builder/',
    custom: '/flash-builder/'
  }
  const path = map[appData.value.app_type] || '/flash-builder/'
  router.push(path + appData.value.id)
}

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.app-container {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.runtime-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.grid-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.workflow-runtime {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  height: 100%;
}

.bpmn-canvas {
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  height: 100%;
}

.workflow-side {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  overflow: auto;
}

.flash-runtime {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.flash-alert {
  margin-bottom: 8px;
}

.flash-preview {
  flex: 1;
  width: 100%;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: #fff;
}
</style>
