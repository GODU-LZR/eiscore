<template>
  <div class="data-app">
    <div class="app-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>{{ appData?.name || '数据应用配置' }}</h2>
      </div>
      <div class="header-right">
        <el-button @click="saveConfig" :loading="saving">保存</el-button>
        <el-button type="primary" @click="publishApp">发布</el-button>
      </div>
    </div>

    <div class="app-content">
      <el-form :model="config" label-width="120px">
        <el-form-item label="数据表">
          <el-input v-model="config.table" placeholder="如: hr.employees" />
        </el-form-item>
        <el-form-item label="主键字段">
          <el-input v-model="config.primaryKey" placeholder="如: id" />
        </el-form-item>
        <el-form-item label="显示列">
          <el-input
            v-model="config.columns"
            type="textarea"
            :rows="5"
            placeholder="JSON 数组格式，如: [&quot;name&quot;, &quot;email&quot;, &quot;department&quot;]"
          />
        </el-form-item>
        <el-form-item label="过滤条件">
          <el-input
            v-model="config.filters"
            type="textarea"
            :rows="3"
            placeholder="PostgREST 查询参数，如: status=eq.active"
          />
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})

const appId = computed(() => route.params.appId)
const appData = ref(null)
const saving = ref(false)

const config = ref({
  table: '',
  primaryKey: 'id',
  columns: '[]',
  filters: ''
})

onMounted(async () => {
  await loadAppData()
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
    
    if (appData.value.config) {
      config.value = {
        ...config.value,
        ...appData.value.config
      }
    }
  } catch (error) {
    ElMessage.error('加载应用数据失败')
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        config: config.value,
        updated_at: new Date().toISOString()
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    ElMessage.success('配置保存成功')
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

async function publishApp() {
  try {
    await saveConfig()
    
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
    ElMessage.success('应用已发布')
  } catch (error) {
    ElMessage.error('发布失败: ' + error.message)
  }
}

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.data-app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.app-header {
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

.app-content {
  flex: 1;
  padding: 24px;
  background: #fff;
  margin: 16px;
  border-radius: 8px;
  overflow-y: auto;
}
</style>
