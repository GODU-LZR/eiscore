<template>
  <div class="app-dashboard" data-guide="app-list-page">
    <div class="dashboard-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>应用中心</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <div class="dashboard-content">
      <el-row :gutter="20" class="cards-row">
        <el-col
          v-for="entry in entryCards"
          :key="entry.key"
          :xs="24"
          :sm="12"
          :md="12"
          :lg="8"
          :xl="8"
        >
          <el-card
            class="app-card entry-card"
            data-guide="app-card"
            :data-guide-key="entry.key"
            :class="`attention-${entry.card.attentionLevel || 'normal'}`"
            shadow="hover"
            @click="openEntryCard(entry)"
          >
            <div class="app-card-body">
              <div class="app-icon" :class="`tone-${entry.tone}`">
                <el-icon><component :is="getIconComponent(entry.icon)" /></el-icon>
              </div>
              <div class="app-info">
                <div class="app-title-line">
                  <div class="app-name">{{ entry.name }}</div>
                  <span class="app-status" data-guide="app-card-status" :class="`status-${entry.card.status}`">{{ entry.card.statusText }}</span>
                </div>
                <div class="app-desc">{{ entry.desc }}</div>
              </div>
            </div>
            <div class="app-metrics" data-guide="app-card-metrics">
              <div v-for="metric in entry.card.metrics" :key="metric.label" class="metric-item">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
              </div>
            </div>
            <div class="app-actions" data-guide="app-card-enter">
              <span class="app-brief">{{ entry.card.brief }}</span>
              <span class="app-enter">进入</span>
            </div>
          </el-card>
        </el-col>
        <el-col
          v-for="app in attentionApps"
          :key="app.id"
          :xs="24"
          :sm="12"
          :md="12"
          :lg="8"
          :xl="8"
        >
          <el-card
            class="app-card"
            data-guide="app-card"
            :data-guide-key="app.id"
            :class="`attention-${app.card.attentionLevel || 'normal'}`"
            shadow="hover"
            @click="openApp(app)"
          >
            <div class="app-card-body">
              <div class="app-icon" :class="`tone-${getTone(app)}`">
                <el-icon><component :is="getIconComponent(app.icon)" /></el-icon>
              </div>
              <div class="app-info">
                <div class="app-title-line">
                  <div class="app-name">{{ getDisplayName(app) }}</div>
                  <span class="app-status" data-guide="app-card-status" :class="`status-${app.card.status}`">{{ app.card.statusText }}</span>
                </div>
                <div class="app-desc">{{ getDisplayDescription(app) }}</div>
              </div>
            </div>
            <div class="app-metrics" data-guide="app-card-metrics">
              <div v-for="metric in app.card.metrics" :key="metric.label" class="metric-item">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
              </div>
            </div>
            <div class="app-actions" data-guide="app-card-enter">
              <span class="app-brief">{{ app.card.brief }}</span>
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
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, computed, onMounted } from 'vue'
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
import { getToken } from '@/utils/auth'
import { cardFromScore, sortByAttention } from '@shared/app-card-attention'

const router = useRouter()

const showCreateDialog = ref(false)
const creating = ref(false)
const apps = ref([])
const canManage = computed(() => hasPerm('module:app') || hasPerm('module:apps'))

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

const statusTextMap = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档'
}

const typeTextMap = {
  workflow: '流程',
  data: '数据',
  flash: '闪念',
  custom: '自定义'
}

const ONTOLOGY_SYSTEM_APP = 'ontology_workbench'
const ONTOLOGY_READONLY_NAME = '本体关系工作台'
const ONTOLOGY_READONLY_DESC = '可视化查看系统表关系与影响范围'
const APP_RUNTIME_TITLE_STORAGE_KEY = 'eis_app_runtime_title_map_v1'

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
  const token = getToken()
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

const appStats = computed(() => {
  const list = apps.value || []
  return {
    total: list.length,
    draft: list.filter((app) => app.status === 'draft').length,
    published: list.filter((app) => app.status === 'published').length,
    archived: list.filter((app) => app.status === 'archived').length,
    workflow: list.filter((app) => app.app_type === 'workflow').length,
    data: list.filter((app) => app.app_type === 'data').length,
    flash: list.filter((app) => ['flash', 'custom'].includes(app.app_type)).length
  }
})

const entryCards = computed(() => {
  const stats = appStats.value
  return [
    {
      key: 'config',
      name: '配置中心',
      desc: '统一管理流程/表格/闪念配置',
      icon: 'Setting',
      tone: 'purple',
      card: cardFromScore({
        score: stats.draft > 0 ? 50 : 28,
        metrics: [
          { label: '应用数', value: `${stats.total}` },
          { label: '草稿/发布', value: `${stats.draft}/${stats.published}` }
        ],
        brief: stats.draft > 0 ? '优先完善草稿配置' : '配置状态稳定'
      })
    },
    {
      key: 'create',
      name: '新建应用',
      desc: '创建流程/表格/闪念应用',
      icon: 'Plus',
      tone: 'blue',
      visible: canManage.value,
      card: cardFromScore({
        score: stats.draft >= 5 ? 62 : 34,
        metrics: [
          { label: '草稿数', value: `${stats.draft}` },
          { label: '类型数', value: `${Number(stats.workflow > 0) + Number(stats.data > 0) + Number(stats.flash > 0)}` }
        ],
        brief: stats.draft >= 5 ? '先收敛草稿再新建' : '按业务场景创建'
      })
    },
    {
      key: 'approval',
      name: '审批中心',
      desc: '跨流程查看会签进度与审批意见',
      icon: 'List',
      tone: 'orange',
      visible: canManage.value,
      card: cardFromScore({
        score: stats.workflow > 0 ? 44 : 24,
        metrics: [
          { label: '流程应用', value: `${stats.workflow}` },
          { label: '已发布', value: `${stats.published}` }
        ],
        brief: stats.workflow > 0 ? '查看流程审批态势' : '暂无流程应用'
      })
    }
  ].filter((entry) => entry.visible !== false)
})

const getAppAttentionCard = (app) => {
  const status = String(app?.status || 'draft')
  const config = parseAppConfig(app?.config)
  const configKeys = config && typeof config === 'object' ? Object.keys(config).length : 0
  const isSystem = isOntologyReadonlyApp(app)
  const score = status === 'draft'
    ? 58
    : (status === 'archived' ? 12 : (configKeys === 0 && !isSystem ? 46 : 28))

  return cardFromScore({
    score,
    metrics: [
      { label: '类型', value: typeTextMap[app?.app_type] || '应用' },
      { label: '状态', value: statusTextMap[status] || status }
    ],
    brief: status === 'draft'
      ? '完善配置后发布'
      : (status === 'archived' ? '归档应用仅作追溯' : (isSystem ? '系统只读工作台' : '可进入运行'))
  })
}

const attentionApps = computed(() => apps.value
  .map((app) => ({
    ...app,
    card: getAppAttentionCard(app)
  }))
  .sort(sortByAttention))

const getAppTabTitle = (app) => String(getDisplayName(app) || app?.name || '').trim()

const rememberAppTabTitle = (app) => {
  const id = String(app?.id || '').trim()
  const title = getAppTabTitle(app)
  if (!id || !title || typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(APP_RUNTIME_TITLE_STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      map[id] = title
      localStorage.setItem(APP_RUNTIME_TITLE_STORAGE_KEY, JSON.stringify(map))
    }
  } catch {
    localStorage.setItem(APP_RUNTIME_TITLE_STORAGE_KEY, JSON.stringify({ [id]: title }))
  }
}

const buildAppRouteQuery = (app) => {
  const title = getAppTabTitle(app)
  return title ? { appName: title } : {}
}

const pushAppRoute = (path, app) => {
  const normalizedPath = String(path || '').trim()
  if (!normalizedPath) return
  rememberAppTabTitle(app)
  router.push({
    path: normalizedPath,
    query: buildAppRouteQuery(app)
  })
}

async function createApp() {
  if (!newAppForm.value.name) {
    ElMessage.warning('请输入应用名称')
    return
  }

  creating.value = true
  try {
    const token = getToken()
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

function openEntryCard(entry) {
  if (!entry) return
  if (entry.key === 'config') return goConfigCenter()
  if (entry.key === 'create') {
    showCreateDialog.value = true
    return
  }
  if (entry.key === 'approval') return goApprovalCenter()
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
  pushAppRoute(base + app.id, app)
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
        pushAppRoute(resolved || `/app/${app.id}`, app)
      } catch (error) {
        pushAppRoute(`/app/${app.id}`, app)
      }
      return
    }
    pushAppRoute(`/app/${app.id}`, app)
    return
  }
  navigateToBuilder(app)
}

async function loadApps() {
  try {
    const token = getToken()
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

function goApprovalCenter() {
  router.push('/workflow-approval-center')
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
  align-items: stretch;
}

.dashboard-content {
  flex: 1;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: hidden;
}

.cards-row :deep(.el-col) {
  display: flex;
}

.app-card {
  width: 100%;
  height: 168px;
  display: flex;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 20px;
  position: relative;
}

.app-card :deep(.el-card__body) {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  overflow: hidden;
  padding: 14px;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
}

.app-card-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  min-height: 48px;
}

.app-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 8px;
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
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.app-title-line {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-name {
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-desc {
  font-size: 12px;
  line-height: 18px;
  color: #909399;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.app-status {
  flex: 0 0 auto;
  min-width: 48px;
  max-width: 58px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  background: #eef2ff;
  color: #475569;
}

.status-ok {
  background: #dcfce7;
  color: #16a34a;
}

.status-warn {
  background: #fef3c7;
  color: #d97706;
}

.status-danger {
  background: #fee2e2;
  color: #dc2626;
}

.status-info {
  background: #e0f2fe;
  color: #0284c7;
}

.app-metrics {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-item {
  min-width: 0;
  height: 42px;
  padding: 0 10px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #f6f8fb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metric-item strong {
  min-width: 52px;
  overflow: visible;
  color: #303133;
  font-size: 17px;
  line-height: 1;
  font-weight: 800;
  text-align: right;
  white-space: nowrap;
}

.metric-item span {
  min-width: 0;
  flex: 1;
  color: #909399;
  font-size: 11px;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-actions {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.app-brief {
  min-width: 0;
  overflow: hidden;
  color: #909399;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-enter {
  flex: 0 0 auto;
  font-size: 12px;
  color: #409eff;
  cursor: pointer;
}

.attention-critical {
  border-color: rgba(239, 68, 68, 0.45);
}

.attention-warning {
  border-color: rgba(245, 158, 11, 0.42);
}

.attention-focus {
  border-color: rgba(14, 165, 233, 0.36);
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

:global(#app.dark) .metric-item {
  background: #0f172a;
}

:global(#app.dark) .metric-item strong,
:global(#app.dark) .app-brief {
  color: #f3f4f6;
}

:global(#app.dark) .metric-item span {
  color: #9ca3af;
}
</style>
