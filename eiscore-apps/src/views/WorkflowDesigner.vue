<template>
  <div class="workflow-designer">
    <div class="designer-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>{{ appData?.name || '流程设计器' }}</h2>
      </div>
      <div class="header-right">
        <el-button @click="saveWorkflow" :loading="saving">保存</el-button>
        <el-button type="primary" @click="publishWorkflow">发布</el-button>
      </div>
    </div>

    <div class="designer-content">
      <div class="bpmn-canvas" ref="bpmnCanvasRef"></div>
      
      <div class="properties-panel">
        <h3>节点设置</h3>
        <el-form v-if="selectedElement" label-width="100px" size="small">
          <el-form-item label="节点编号">
            <el-input :value="selectedElement.id" disabled />
          </el-form-item>
          <el-form-item label="节点类型">
            <el-input :value="selectedElement.type" disabled />
          </el-form-item>
          
          <!-- State Mapping (for User Tasks) -->
          <template v-if="selectedElement.type === 'bpmn:UserTask'">
            <el-divider>表单绑定</el-divider>
            <el-form-item label="目标表">
              <el-input v-model="stateMapping.target_table" placeholder="例如：hr.leave_requests" />
            </el-form-item>
            <el-form-item label="状态字段">
              <el-input v-model="stateMapping.state_field" placeholder="例如：approval_status" />
            </el-form-item>
            <el-form-item label="状态值">
              <el-input v-model="stateMapping.state_value" placeholder="例如：PENDING_REVIEW" />
            </el-form-item>
            <el-button type="primary" size="small" @click="saveStateMapping">
              保存映射
            </el-button>
          </template>
        </el-form>
        <el-empty v-else description="请选择一个节点进行设置" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import axios from 'axios'
import Modeler from 'bpmn-js/lib/Modeler'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

const route = useRoute()
const router = useRouter()
const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})

const appId = computed(() => route.params.appId)
const appData = ref(null)
const bpmnCanvasRef = ref(null)
const selectedElement = ref(null)
const stateMapping = ref({
  target_table: '',
  state_field: '',
  state_value: ''
})
const saving = ref(false)

const defaultBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="156" y="81" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

// BPMN.js instance
let bpmnModeler = null

onMounted(async () => {
  await loadAppData()
  await initializeBpmnModeler()
})

onUnmounted(() => {
  if (bpmnModeler) {
    bpmnModeler.destroy()
    bpmnModeler = null
  }
})

async function loadAppData() {
  if (!appId.value) return

  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/apps?id=eq.${appId.value}`,
      {
        headers: getAppCenterHeaders(token)
      }
    )
    appData.value = response.data[0]
  } catch (error) {
    ElMessage.error('加载应用数据失败')
  }
}

async function initializeBpmnModeler() {
  if (!bpmnCanvasRef.value) return
  if (bpmnModeler) {
    bpmnModeler.destroy()
    bpmnModeler = null
  }
  bpmnModeler = new Modeler({ container: bpmnCanvasRef.value })
  const xml = appData.value?.bpmn_xml || defaultBpmnXml
  try {
    await bpmnModeler.importXML(xml)
  } catch (error) {
    console.error(error)
    ElMessage.error('流程初始化失败')
  }
  const eventBus = bpmnModeler.get('eventBus')
  eventBus.on('selection.changed', (event) => {
    const element = event?.newSelection?.[0]
    selectedElement.value = element ? { id: element.id, type: element.type } : null
  })
}

async function saveWorkflow() {
  saving.value = true
  try {
    if (!bpmnModeler) throw new Error('流程未初始化')
    const result = await bpmnModeler.saveXML({ format: true })
    const bpmnXml = result.xml

    const token = localStorage.getItem('auth_token')
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        bpmn_xml: bpmnXml,
        updated_at: new Date().toISOString()
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    ElMessage.success('工作流保存成功')
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

async function publishWorkflow() {
  try {
    await saveWorkflow()
    
    const token = localStorage.getItem('auth_token')
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        status: 'published'
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    ElMessage.success('工作流已发布')
  } catch (error) {
    ElMessage.error('发布失败: ' + error.message)
  }
}

async function saveStateMapping() {
  if (!selectedElement.value) return

  try {
    const token = localStorage.getItem('auth_token')
    await axios.post(
      '/api/workflow_state_mappings',
      {
        workflow_app_id: appId.value,
        bpmn_task_id: selectedElement.value.id,
        ...stateMapping.value
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        }
      }
    )
    ElMessage.success('状态映射已保存')
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  }
}

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.workflow-designer {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.designer-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.designer-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.bpmn-canvas {
  flex: 1;
  background: #fff;
}

.properties-panel {
  width: 320px;
  background: #fff;
  border-left: 1px solid var(--el-border-color-light);
  padding: 16px;
  overflow-y: auto;
}

.properties-panel h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}
</style>
