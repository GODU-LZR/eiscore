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
          <el-input v-model="config.table" placeholder="如: app_data.data_app_xxxx（可留空自动生成）" />
        </el-form-item>
        <el-form-item label="主键字段">
          <el-input v-model="config.primaryKey" placeholder="如: id" />
        </el-form-item>
        <el-form-item label="列配置">
          <div class="column-config">
            <div class="column-actions">
              <el-button type="primary" @click="addColumn">新增列</el-button>
            </div>
            <el-table :data="columns" size="small" border style="width: 100%">
              <el-table-column label="字段" min-width="140">
                <template #default="scope">
                  <el-input v-model="scope.row.field" placeholder="如: customer_name" />
                </template>
              </el-table-column>
              <el-table-column label="显示名" min-width="140">
                <template #default="scope">
                  <el-input v-model="scope.row.label" placeholder="如: 客户名称" />
                </template>
              </el-table-column>
              <el-table-column label="类型" width="160">
                <template #default="scope">
                  <el-select v-model="scope.row.type" placeholder="类型">
                    <el-option
                      v-for="option in columnTypeOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120">
                <template #default="scope">
                  <el-button type="danger" link @click="removeColumn(scope.$index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="form-hint">列类型与表格组件一致；下拉/联动等可在表格内继续配置。</div>
          </div>
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
import { DATA_APP_COLUMN_TYPES, normalizeColumnType } from '@/utils/data-app-columns'

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

const columns = ref([])
const columnTypeOptions = DATA_APP_COLUMN_TYPES

const config = ref({
  table: '',
  primaryKey: 'id',
  columns: []
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
    columns.value = normalizeColumns(config.value.columns)
  } catch (error) {
    ElMessage.error('加载应用数据失败')
  }
}

function normalizeColumns(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(normalizeColumn)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(normalizeColumn)
    } catch {
      return []
    }
  }
  return []
}

function normalizeColumn(col) {
  if (!col) return { field: '', label: '', type: 'text' }
  if (typeof col === 'string') {
    return { field: col, label: col, type: 'text', isStatic: true }
  }
  return {
    field: col.field || '',
    label: col.label || col.field || '',
    type: normalizeColumnType(col.type),
    isStatic: true
  }
}

function addColumn() {
  columns.value.push({ field: '', label: '', type: 'text' })
}

function removeColumn(index) {
  columns.value.splice(index, 1)
}

async function saveConfig() {
  saving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const nextConfig = { ...config.value, columns: columns.value }
    if (Object.prototype.hasOwnProperty.call(nextConfig, 'filters')) {
      delete nextConfig.filters
    }
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        config: {
          ...nextConfig
        },
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
    const tableName = await ensureDataTable()
    config.value.table = tableName
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
    router.push(`/app/${appId.value}`)
  } catch (error) {
    ElMessage.error('发布失败: ' + error.message)
  }
}

async function ensureDataTable() {
  const token = localStorage.getItem('auth_token')
  const current = config.value.table?.trim()
  const fallback = `data_app_${String(appId.value).replace(/-/g, '').slice(0, 8)}`
  const tableName = current ? current.split('.').pop() : fallback

  const response = await axios.post(
    '/api/rpc/create_data_app_table',
    {
      app_id: appId.value,
      table_name: tableName,
      columns: columns.value
    },
    {
      headers: {
        ...getAppCenterHeaders(token),
        'Content-Type': 'application/json'
      }
    }
  )

  return response.data || `app_data.${tableName}`
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

.column-config {
  width: 100%;
}

.column-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}
</style>
