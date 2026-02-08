<template>
  <div class="config-center">
    <div class="config-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>应用配置中心</h2>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">新建应用</el-button>
      </div>
    </div>

    <div class="config-body">
      <div class="app-list">
        <el-input v-model="search" size="small" placeholder="搜索应用" clearable />
        <el-scrollbar class="app-list-scroll">
          <div
            v-for="app in filteredApps"
            :key="app.id"
            class="app-list-item"
            :class="{ active: app.id === selectedAppId }"
            @click="selectApp(app)"
          >
            <div class="app-list-title">{{ app.name }}</div>
            <div class="app-list-meta">{{ typeLabel(app.app_type) }}</div>
          </div>
        </el-scrollbar>
      </div>

      <div class="app-config-panel">
        <div v-if="!selectedApp" class="panel-empty">
          <el-empty description="请选择一个应用" />
        </div>
        <div v-else>
          <el-form :model="editForm" label-width="100px">
            <el-form-item label="应用名称">
              <el-input v-model="editForm.name" />
            </el-form-item>
            <el-form-item label="应用描述">
              <el-input v-model="editForm.description" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item label="应用类型">
              <el-select v-model="editForm.app_type" placeholder="选择类型">
                <el-option label="工作流应用" value="workflow" />
                <el-option label="数据应用" value="data" />
                <el-option label="闪念应用" value="flash" />
              </el-select>
            </el-form-item>
            <el-form-item label="图标">
              <el-select v-model="editForm.icon" placeholder="选择图标">
                <el-option
                  v-for="icon in iconOptions"
                  :key="icon.value"
                  :label="icon.label"
                  :value="icon.value"
                >
                  <span class="icon-option">
                    <el-icon><component :is="icon.component" /></el-icon>
                    <span>{{ icon.label }}</span>
                  </span>
                </el-option>
              </el-select>
            </el-form-item>
            <el-divider content-position="left">内核配置</el-divider>
            <el-form-item label="业务表">
              <el-input v-model="coreConfig.table" placeholder="如 hr.leave_requests / app_center_xxx" />
              <div class="form-hint">用于工作流/表单字段绑定来源（sys_field_acl）。</div>
            </el-form-item>
            <template v-if="editForm.app_type === 'data'">
              <el-form-item label="主键字段">
                <el-input v-model="coreConfig.primaryKey" placeholder="如: id" />
              </el-form-item>
              <el-form-item label="列配置">
                <div class="column-config">
                  <div class="column-actions">
                    <el-button type="primary" @click="addCoreColumn">新增列</el-button>
                  </div>
                  <el-table :data="coreColumns" size="small" border style="width: 100%">
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
                        <el-button type="danger" link @click="removeCoreColumn(scope.$index)">删除</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div class="form-hint">列类型与表格组件保持一致；普通文字可用于数字/日期，下拉/联动等可在表格内继续配置。</div>
                </div>
              </el-form-item>
            </template>
            <template v-else-if="editForm.app_type === 'workflow'">
              <el-alert title="工作流内核配置在流程设计器中维护" type="info" show-icon />
            </template>
            <template v-else-if="editForm.app_type === 'flash'">
              <el-alert title="闪念应用内核配置在快搭构建器中维护" type="info" show-icon />
            </template>
          </el-form>

          <div class="panel-actions">
            <el-button type="primary" :loading="saving" @click="saveApp">保存配置</el-button>
            <el-button @click="openBuilder">打开配置器</el-button>
            <el-button type="danger" :loading="deleting" @click="deleteApp">删除应用</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showCreateDialog" title="创建新应用" width="500px">
      <el-form :model="newAppForm" label-width="100px">
        <el-form-item label="应用名称">
          <el-input v-model="newAppForm.name" placeholder="输入应用名称" />
        </el-form-item>
        <el-form-item label="应用描述">
          <el-input v-model="newAppForm.description" type="textarea" :rows="3" placeholder="简要描述应用功能" />
        </el-form-item>
        <el-form-item label="应用类型">
          <el-select v-model="newAppForm.app_type" placeholder="选择类型">
            <el-option label="工作流应用" value="workflow" />
            <el-option label="数据应用" value="data" />
            <el-option label="闪念应用" value="flash" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标">
          <el-select v-model="newAppForm.icon" placeholder="选择图标">
            <el-option
              v-for="icon in iconOptions"
              :key="icon.value"
              :label="icon.label"
              :value="icon.value"
            >
              <span class="icon-option">
                <el-icon><component :is="icon.component" /></el-icon>
                <span>{{ icon.label }}</span>
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createApp">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Plus,
  Grid,
  Setting,
  Tools,
  Operation,
  Document,
  Collection,
  Tickets,
  DataAnalysis,
  TrendCharts,
  User,
  HomeFilled,
  Folder,
  Menu,
  Monitor,
  Notebook,
  Calendar,
  Message,
  Bell,
  Star,
  Edit,
  List,
  Picture,
  Promotion,
  Cpu,
  Coin,
  Goods,
  ShoppingCart,
  Suitcase,
  Wallet,
  Warning
} from '@element-plus/icons-vue'
import axios from 'axios'
import { ensureAppAclConfig, ensureAppPermissions, cleanupAppPermissions, resolveAppAclModule } from '@/utils/app-permissions'
import { DATA_APP_COLUMN_TYPES, normalizeColumnType } from '@/utils/data-app-columns'

const route = useRoute()
const router = useRouter()

const apps = ref([])
const search = ref('')
const selectedAppId = ref(null)
const selectedApp = ref(null)
const saving = ref(false)
const deleting = ref(false)
const creating = ref(false)
const showCreateDialog = ref(false)

const editForm = ref({
  name: '',
  description: '',
  app_type: 'workflow',
  icon: 'Grid'
})

const newAppForm = ref({
  name: '',
  description: '',
  app_type: 'workflow',
  icon: 'Grid'
})

const coreConfig = ref({
  table: '',
  primaryKey: 'id'
})
const coreColumns = ref([])
const columnTypeOptions = DATA_APP_COLUMN_TYPES

const iconOptions = [
  { label: 'Grid', value: 'Grid', component: Grid },
  { label: 'Setting', value: 'Setting', component: Setting },
  { label: 'Tools', value: 'Tools', component: Tools },
  { label: 'Operation', value: 'Operation', component: Operation },
  { label: 'Document', value: 'Document', component: Document },
  { label: 'Collection', value: 'Collection', component: Collection },
  { label: 'Tickets', value: 'Tickets', component: Tickets },
  { label: 'DataAnalysis', value: 'DataAnalysis', component: DataAnalysis },
  { label: 'TrendCharts', value: 'TrendCharts', component: TrendCharts },
  { label: 'User', value: 'User', component: User },
  { label: 'HomeFilled', value: 'HomeFilled', component: HomeFilled },
  { label: 'Folder', value: 'Folder', component: Folder },
  { label: 'Menu', value: 'Menu', component: Menu },
  { label: 'Monitor', value: 'Monitor', component: Monitor },
  { label: 'Notebook', value: 'Notebook', component: Notebook },
  { label: 'Calendar', value: 'Calendar', component: Calendar },
  { label: 'Message', value: 'Message', component: Message },
  { label: 'Bell', value: 'Bell', component: Bell },
  { label: 'Star', value: 'Star', component: Star },
  { label: 'Edit', value: 'Edit', component: Edit },
  { label: 'List', value: 'List', component: List },
  { label: 'Picture', value: 'Picture', component: Picture },
  { label: 'Promotion', value: 'Promotion', component: Promotion },
  { label: 'Cpu', value: 'Cpu', component: Cpu },
  { label: 'Coin', value: 'Coin', component: Coin },
  { label: 'Goods', value: 'Goods', component: Goods },
  { label: 'ShoppingCart', value: 'ShoppingCart', component: ShoppingCart },
  { label: 'Suitcase', value: 'Suitcase', component: Suitcase },
  { label: 'Wallet', value: 'Wallet', component: Wallet },
  { label: 'Warning', value: 'Warning', component: Warning }
]

const typeLabelMap = {
  workflow: '工作流应用',
  data: '数据应用',
  flash: '闪念应用'
}

const filteredApps = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return apps.value
  return apps.value.filter((app) => String(app.name || '').toLowerCase().includes(keyword))
})

const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})

const isCreateAppForbidden = (error) => {
  const status = error?.response?.status
  const code = error?.response?.data?.code
  const message = String(error?.response?.data?.message || '').toLowerCase()
  if (status !== 403) return false
  if (code === '42501') return true
  return message.includes('row-level security policy') && message.includes('apps')
}

const loadApps = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get('/api/apps', {
      headers: getAppCenterHeaders(token),
      params: { order: 'created_at.desc' }
    })
    apps.value = response.data || []

    const routeAppId = route.params.appId ? Number(route.params.appId) : null
    const initial = apps.value.find((item) => item.id === routeAppId) || apps.value[0] || null
    if (initial) {
      selectApp(initial)
    } else {
      selectedApp.value = null
      selectedAppId.value = null
    }
  } catch (error) {
    ElMessage.error('加载应用失败')
  }
}

const normalizeConfig = (raw) => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const normalizeColumns = (raw) => {
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

const normalizeColumn = (col) => {
  if (!col) return { field: '', label: '', type: 'text', isStatic: true }
  if (typeof col === 'string') {
    return { field: col, label: col, type: 'text', isStatic: true }
  }
  const field = col.field || col.prop || ''
  return {
    ...col,
    field,
    prop: col.prop || field,
    label: col.label || field,
    type: normalizeColumnType(col.type),
    isStatic: col.isStatic !== false
  }
}

const normalizeIcon = (icon) => {
  const valid = iconOptions.some((item) => item.value === icon)
  return valid ? icon : 'Grid'
}

const selectApp = (app) => {
  selectedAppId.value = app?.id || null
  selectedApp.value = app || null
  const config = normalizeConfig(app?.config)
  editForm.value = {
    name: app?.name || '',
    description: app?.description || '',
    app_type: app?.app_type || 'workflow',
    icon: normalizeIcon(app?.icon)
  }
  coreConfig.value = {
    table: config?.table || '',
    primaryKey: config?.primaryKey || 'id'
  }
  coreColumns.value = normalizeColumns(config?.columns)
  if (selectedAppId.value) {
    router.replace(`/config-center/${selectedAppId.value}`)
  }
}

const saveApp = async () => {
  if (!selectedAppId.value) return
  saving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const current = apps.value.find((item) => item.id === selectedAppId.value)
    const currentConfig = normalizeConfig(current?.config)

  let nextConfig = {
    ...currentConfig,
    table: coreConfig.value.table
  }
  if (editForm.value.app_type === 'data') {
    nextConfig.primaryKey = coreConfig.value.primaryKey || 'id'
    nextConfig.columns = coreColumns.value
    if (Object.prototype.hasOwnProperty.call(nextConfig, 'filters')) {
      delete nextConfig.filters
    }
    if (selectedApp.value?.id) {
      nextConfig = ensureAppAclConfig(nextConfig, selectedApp.value.id)
    }
  }

    const payload = {
      name: editForm.value.name,
      description: editForm.value.description,
      app_type: editForm.value.app_type,
      icon: editForm.value.icon,
      config: nextConfig
    }

    await axios.patch(`/api/apps?id=eq.${selectedAppId.value}`, payload, {
      headers: {
        ...getAppCenterHeaders(token),
        'Content-Type': 'application/json'
      }
    })

    ElMessage.success('配置已保存')
    await loadApps()
    if (selectedApp.value?.app_type === 'data') {
      ensureAppPermissions(selectedApp.value, { config: nextConfig, appId: selectedApp.value.id })
    }
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

const addCoreColumn = () => {
  coreColumns.value.push({ field: '', label: '', type: 'text', isStatic: true })
}

const removeCoreColumn = (index) => {
  coreColumns.value.splice(index, 1)
}

const deleteApp = async () => {
  if (!selectedAppId.value) return
  const targetApp = selectedApp.value
  const moduleKey = resolveAppAclModule(targetApp, targetApp?.config, targetApp?.id)
  try {
    await ElMessageBox.confirm(
      '确定要删除该应用吗？此操作不可恢复。',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  deleting.value = true
  try {
    const token = localStorage.getItem('auth_token')
    await axios.delete(`/api/apps?id=eq.${selectedAppId.value}`, {
      headers: getAppCenterHeaders(token)
    })
    if (moduleKey) {
      cleanupAppPermissions(moduleKey)
    }
    ElMessage.success('应用已删除')
    selectedAppId.value = null
    selectedApp.value = null
    await loadApps()
  } catch (error) {
    ElMessage.error('删除失败: ' + error.message)
  } finally {
    deleting.value = false
  }
}

const openBuilder = () => {
  if (!selectedApp.value) return
  navigateToBuilder(selectedApp.value)
}

const createApp = async () => {
  if (!newAppForm.value.name) {
    ElMessage.warning('请输入应用名称')
    return
  }
  creating.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const categoryMap = { workflow: 1, data: 2, flash: 3, custom: 4 }
    const payload = {
      ...newAppForm.value,
      category_id: categoryMap[newAppForm.value.app_type],
      status: 'draft'
    }
    const response = await axios.post('/api/apps', payload, {
      headers: {
        ...getAppCenterHeaders(token),
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }
    })
    ElMessage.success('应用创建成功')
    showCreateDialog.value = false
    await loadApps()
    const app = response.data?.[0]
    if (app) {
      if (app.app_type === 'data') {
        const config = ensureAppAclConfig(app.config || {}, app.id)
        try {
          await axios.patch(`/api/apps?id=eq.${app.id}`, { config }, {
            headers: {
              ...getAppCenterHeaders(token),
              'Content-Type': 'application/json'
            }
          })
          app.config = config
        } catch (e) {
          // ignore patch failures
        }
        ensureAppPermissions(app, { config, appId: app.id })
      }
      selectApp(app)
      navigateToBuilder(app)
    }
  } catch (error) {
    if (isCreateAppForbidden(error)) {
      ElMessage.error('只有超级管理员才能创建应用')
      return
    }
    ElMessage.error('创建失败: ' + error.message)
  } finally {
    creating.value = false
  }
}

const navigateToBuilder = (app) => {
  if (!app) return
  const map = {
    workflow: '/workflow-designer/',
    data: '/data-app/',
    flash: '/flash-builder/',
    custom: '/flash-builder/'
  }
  const path = map[app.app_type] || '/flash-builder/'
  router.push(path + app.id)
}

const typeLabel = (type) => typeLabelMap[type] || '未分类'

const goBack = () => {
  router.push('/')
}

onMounted(loadApps)

watch(() => route.params.appId, (value) => {
  if (!value || !apps.value.length) return
  const matched = apps.value.find((item) => item.id === Number(value))
  if (matched) selectApp(matched)
})
</script>

<style scoped>
.config-center {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.config-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.config-body {
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  padding: 16px 20px;
  overflow: hidden;
}

.app-list {
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-list-scroll {
  flex: 1;
}

.app-list-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}

.app-list-item:hover {
  background: #f5f7fa;
}

.app-list-item.active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.08);
}

.app-list-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.app-list-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.app-config-panel {
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 20px 24px;
  overflow: auto;
}

.panel-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}

.icon-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.column-config {
  width: 100%;
}

.column-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
