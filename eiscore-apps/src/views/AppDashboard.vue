<template>
  <div class="app-dashboard">
    <div class="dashboard-header">
      <div class="header-text">
        <h2>应用中心</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <div class="dashboard-content">
      <!-- Entry + Apps Cards -->
      <el-row :gutter="20" class="cards-row">
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="app-card entry-card" shadow="hover" @click="goConfigCenter()">
            <div class="app-card-body">
              <div class="app-icon tone-purple">
                <el-icon><Setting /></el-icon>
              </div>
              <div class="app-info">
                <div class="app-name">配置中心</div>
                <div class="app-desc">统一管理流程/表格/闪念配置</div>
              </div>
            </div>
            <div class="app-actions">
              <span class="app-enter">进入</span>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="app-card entry-card" shadow="hover" @click="showCreateDialog = true">
            <div class="app-card-body">
              <div class="app-icon tone-blue">
                <el-icon><Plus /></el-icon>
              </div>
              <div class="app-info">
                <div class="app-name">新建应用</div>
                <div class="app-desc">创建流程/表格/闪念应用</div>
              </div>
            </div>
            <div class="app-actions">
              <span class="app-enter">进入</span>
            </div>
          </el-card>
        </el-col>
        <el-col
          v-for="app in apps"
          :key="app.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <el-card class="app-card" shadow="hover" @click="openApp(app)">
            <div class="app-card-body">
              <div class="app-icon" :class="`tone-${getTone(app)}`">
                <el-icon><component :is="getIconComponent(app.icon)" /></el-icon>
              </div>
              <div class="app-info">
                <div class="app-name">{{ getDisplayName(app) }}</div>
                <div class="app-desc">{{ getDisplayDescription(app) }}</div>
              </div>
            </div>
            <div class="app-actions">
              <span class="app-enter">进入</span>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Create App Dialog -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建新应用"
      width="500px"
    >
      <el-form :model="newAppForm" label-width="100px">
        <el-form-item label="应用名称">
          <el-input v-model="newAppForm.name" placeholder="输入应用名称" />
        </el-form-item>
        <el-form-item label="应用描述">
          <el-input
            v-model="newAppForm.description"
            type="textarea"
            :rows="3"
            placeholder="简要描述应用功能"
          />
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
        <el-button type="primary" @click="createApp" :loading="creating">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Setting,
  Plus,
  Grid,
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
import { ensureAppAclConfig, ensureAppPermissions, resolveAppAclModule } from '@/utils/app-permissions'
import { hasPerm } from '@/utils/permission'
import { ensureSemanticConfig } from '@/utils/semantics-config'

const router = useRouter()

const showCreateDialog = ref(false)
const creating = ref(false)
const apps = ref([])

const newAppForm = ref({
  name: '',
  description: '',
  app_type: 'flash',
  icon: 'Grid'
})

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

const iconMap = iconOptions.reduce((acc, item) => {
  acc[item.value] = item.component
  return acc
}, {})

const ONTOLOGY_SYSTEM_APP = 'ontology_workbench'
const ONTOLOGY_READONLY_NAME = '本体关系工作台'
const ONTOLOGY_READONLY_DESC = '可视化查看系统表关系与影响范围'

const apiBase = '/api'
const toAbsoluteApiUrl = (path) => {
  const normalized = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`
  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location?.protocol || '')) {
    try {
      return new URL(normalized, window.location.origin).toString()
    } catch {
      // fallback
    }
  }
  return normalized
}
const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})

const toAppRouterPath = (routePath) => {
  const raw = String(routePath || '').trim()
  if (!raw) return ''
  if (raw === '/apps') return '/'
  if (raw.startsWith('/apps/')) return raw.slice('/apps'.length)
  return raw.startsWith('/') ? raw : `/${raw}`
}

const resolvePublishedRoutePath = async (app) => {
  if (!app?.id) return ''
  const token = localStorage.getItem('auth_token')
  const response = await axios.get(
    toAbsoluteApiUrl(`${apiBase}/published_routes?app_id=eq.${app.id}&is_active=eq.true&order=id.desc&limit=1`),
    { headers: getAppCenterHeaders(token) }
  )
  const row = Array.isArray(response.data) ? response.data[0] : null
  return row?.route_path || ''
}

const isCreateAppForbidden = (error) => {
  const status = error?.response?.status
  const code = error?.response?.data?.code
  const message = String(error?.response?.data?.message || '').toLowerCase()
  if (status !== 403) return false
  if (code === '42501') return true
  return message.includes('row-level security policy') && message.includes('apps')
}

const parseAppConfig = (raw) => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const isOntologyReadonlyApp = (app) => {
  if (!app) return false
  const config = parseAppConfig(app.config)
  if (config.systemApp === ONTOLOGY_SYSTEM_APP) return true
  const name = String(app.name || '')
  return name === 'Ontology Workbench' || name === '本体关系工作台' || name === '本体工作台'
}

async function createApp() {
  if (!newAppForm.value.name) {
    ElMessage.warning('请输入应用名称')
    return
  }

  creating.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const categoryMap = {
      workflow: 1,
      data: 2,
      flash: 3
    }

    const payload = {
      ...newAppForm.value,
      category_id: categoryMap[newAppForm.value.app_type],
      status: 'draft',
      config: ensureSemanticConfig({})
    }

    const response = await axios.post(toAbsoluteApiUrl(`${apiBase}/apps`), payload, {
      headers: {
        ...getAppCenterHeaders(token),
        'Content-Type': 'application/json'
      }
    })

    ElMessage.success('应用创建成功')
    showCreateDialog.value = false
    const app = response.data[0] || response.data
    if (app?.app_type === 'data') {
      const config = ensureSemanticConfig(ensureAppAclConfig(app.config || {}, app.id))
      try {
        await axios.patch(toAbsoluteApiUrl(`${apiBase}/apps?id=eq.${app.id}`), { config }, {
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
    await loadApps()
    if (app) {
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

function getIconComponent(icon) {
  return iconMap[icon] || Grid
}

function getDisplayName(app) {
  if (!app) return ''
  if (isOntologyReadonlyApp(app)) return ONTOLOGY_READONLY_NAME
  return app.name || ''
}

function getDisplayDescription(app) {
  if (!app) return '暂无描述'
  if (isOntologyReadonlyApp(app)) return ONTOLOGY_READONLY_DESC
  return app.description || '暂无描述'
}

function getTone(app) {
  const map = {
    workflow: 'blue',
    data: 'green',
    flash: 'orange'
  }
  return map[app?.app_type] || 'blue'
}

function navigateToBuilder(app) {
  if (!app) return
  const routeMap = {
    workflow: '/workflow-designer/',
    data: '/data-app/',
    flash: '/flash-builder/',
    custom: '/flash-builder/'
  }
  const base = routeMap[app.app_type] || '/workflow-designer/'
  router.push(base + app.id)
}

async function openApp(app) {
  if (!app) return
  const moduleKey = resolveAppAclModule(app, app?.config, app?.id)
  if (moduleKey && !hasPerm(`app:${moduleKey}`)) {
    ElMessage.warning('暂无权限进入该应用')
    return
  }
  if (app.status === 'published') {
    if (app.app_type === 'flash' || app.app_type === 'custom') {
      try {
        const publishedPath = await resolvePublishedRoutePath(app)
        const resolved = toAppRouterPath(publishedPath || '')
        router.push(resolved || `/app/${app.id}`)
      } catch (error) {
        router.push(`/app/${app.id}`)
      }
      return
    }
    router.push(`/app/${app.id}`)
    return
  }
  navigateToBuilder(app)
}

async function loadApps() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(toAbsoluteApiUrl(`${apiBase}/apps`), {
      headers: getAppCenterHeaders(token),
      params: { order: 'created_at.desc' }
    })
    const list = response.data || []
    apps.value = list.filter((app) => {
      const moduleKey = resolveAppAclModule(app, app?.config, app?.id)
      if (!moduleKey) return true
      return hasPerm(`app:${moduleKey}`)
    })
  } catch (error) {
    ElMessage.error('加载应用失败: ' + error.message)
  }
}

function goConfigCenter(id) {
  const path = id ? `/config-center/${id}` : '/config-center'
  router.push(path)
}

onMounted(loadApps)

</script>

<style scoped>
.app-dashboard {
  padding: 20px;
  min-height: 100vh;
  box-sizing: border-box;
  background-color: var(--el-bg-color-page);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
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

.cards-row {
  margin-bottom: 16px;
}

.dashboard-content {
  flex: 1;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: hidden;
}


.app-card {
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 20px;
  position: relative;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
}

.app-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
}

.icon-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tone-blue { background: #409eff; }
.tone-orange { background: #e6a23c; }
.tone-green { background: #67c23a; }
.tone-purple { background: #8b5cf6; }

.app-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.app-desc {
  font-size: 12px;
  color: #909399;
}

.app-actions {
  margin-top: 14px;
  display: flex;
  gap: 12px;
}

.app-enter {
  font-size: 12px;
  color: #409eff;
  cursor: pointer;
}


:global(#app.dark) .header-text h2,
:global(#app.dark) .header-text p {
  color: #f3f4f6;
}

:global(#app.dark) .app-card {
  background-color: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .app-name,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-enter {
  color: #f3f4f6;
}
</style>
