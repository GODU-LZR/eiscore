<template>
  <el-container class="layout-container">
    <el-aside
      :width="isCollapse ? '64px' : '200px'"
      class="layout-aside"
      :style="{ backgroundColor: asideTheme.menuBg }"
    >
      <div
        class="logo"
        :style="{ backgroundColor: asideTheme.logoBg, color: asideTheme.menuText }"
      >
        <span v-if="!isCollapse" class="logo-text">{{ config?.title || '管理系统' }}</span>
        <span v-else class="logo-text">EIS</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical"
        :background-color="asideTheme.menuBg"
        :text-color="asideTheme.menuText"
        :active-text-color="asideTheme.menuActiveText"
        :router="true"
        :collapse="isCollapse"
        :collapse-transition="false"
        style="border-right: none;"
      >
        <el-menu-item v-if="canHome" index="/">
          <el-icon><House /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>
        <el-menu-item v-if="canMms" index="/materials">
          <el-icon><Box /></el-icon>
          <template #title>物料管理</template>
        </el-menu-item>
        <el-menu-item v-if="canHr" index="/hr">
          <el-icon><User /></el-icon>
          <template #title>人事管理</template>
        </el-menu-item>
        <el-menu-item v-if="canApps" index="/apps/">
          <el-icon><Grid /></el-icon>
          <template #title>应用中心</template>
        </el-menu-item>
        <el-menu-item v-if="canSales" index="/sales">
          <el-icon><Sell /></el-icon>
          <template #title>销售模块</template>
        </el-menu-item>
        <el-menu-item v-if="canPurchase" index="/purchase">
          <el-icon><ShoppingCart /></el-icon>
          <template #title>采购模块</template>
        </el-menu-item>
        <el-menu-item v-if="canProduction" index="/production">
          <el-icon><Tools /></el-icon>
          <template #title>生产模块</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="main-container">
      <el-header
        class="layout-header"
        :style="{ backgroundColor: asideTheme.headerBg }"
      >
        <div class="header-left">
          <div class="collapse-btn" @click="toggleCollapse">
            <el-icon size="20" :color="isDark ? '#fff' : '#333'">
              <component :is="isCollapse ? 'Expand' : 'Fold'" />
            </el-icon>
          </div>
          <div class="host-tabs-wrap">
            <div class="host-tabs-scroll">
              <button
                v-for="tab in hostTabs"
                :key="tab.key"
                type="button"
                class="host-tab"
                :class="{ active: activeHostTabKey === tab.key }"
                @click="switchHostTab(tab)"
              >
                <span class="host-tab-dot" :class="`dot-${tab.dot || 'default'}`"></span>
                <span class="host-tab-label">{{ tab.title }}</span>
                <el-icon
                  v-if="tab.closable"
                  class="host-tab-close"
                  @click.stop="closeHostTab(tab.key)"
                >
                  <Close />
                </el-icon>
              </button>
            </div>
          </div>
        </div>

        <div class="header-right">
          <el-switch
            v-if="showThemeToggle"
            v-model="isDark"
            inline-prompt
            active-icon="Moon"
            inactive-icon="Sunny"
            @change="toggleDark"
            style="margin-right: 15px"
          />
          <el-tooltip content="新手指引" placement="bottom">
            <el-button circle icon="QuestionFilled" @click="startGuide" style="margin-right: 15px" />
          </el-tooltip>
          <el-dropdown @command="handleCommand">
            <span class="el-dropdown-link" style="display: flex; align-items: center; cursor: pointer;">
              <el-avatar :key="avatarTick" :size="32" :src="avatarRenderSrc" />
              <span style="margin-left: 8px; font-weight: 500;">{{ userStore.userInfo?.username || 'Admin' }}</span>
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="settings">系统设置</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout-main" :class="{ 'colorful-mode': !isDark }">
        <router-view v-slot="{ Component }">
           <transition name="fade" mode="out-in">
             <keep-alive>
               <component :is="Component" />
             </keep-alive>
           </transition>
        </router-view>

        <div id="subapp-viewport" class="subapp-viewport"></div>
      </el-main>
    </el-container>

    <AiCopilot v-if="showWorkerAssistant" mode="worker" />
  </el-container>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { mix } from '@/utils/theme'
import { hasPerm } from '@/utils/permission'
import { House, Box, User, Grid, Sell, ShoppingCart, Tools, Expand, Fold, Moon, Sunny, QuestionFilled, ArrowDown, Close } from '@element-plus/icons-vue'
import AiCopilot from '@/components/AiCopilot.vue'

const isCollapse = ref(false)
const router = useRouter()
const route = useRoute()
let userInfoPoller = null
let lastUserInfoStr = ''
const avatarTick = ref(0)
const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
const avatarSrc = computed(() => userStore.userInfo?.avatar || defaultAvatar)
const avatarRenderSrc = computed(() => {
  const src = avatarSrc.value || defaultAvatar
  if (!src) return defaultAvatar
  if (src.startsWith('data:')) return `${src}#t=${avatarTick.value}`
  if (src.startsWith('http')) {
    const joiner = src.includes('?') ? '&' : '?'
    return `${src}${joiner}t=${avatarTick.value}`
  }
  return src
})
const systemStore = useSystemStore()
const userStore = useUserStore()
const { config } = storeToRefs(systemStore)
const isDark = useDark({ storageKey: 'eis_theme_global' })
const toggleDark = useToggle(isDark)
const showThemeToggle = false
const userThemeKey = computed(() => {
  const username = userStore.userInfo?.username || userStore.userInfo?.id || 'guest'
  return `eis_theme_${String(username).toLowerCase()}`
})

const applyUserTheme = () => {
  try {
    const raw = localStorage.getItem(userThemeKey.value)
    if (raw === null || raw === undefined || raw === '') return
    if (raw === 'dark' || raw === '1' || raw === 'true') isDark.value = true
    if (raw === 'light' || raw === '0' || raw === 'false') isDark.value = false
  } catch (e) {}
}

const asideTheme = computed(() => {
  const primaryColor = config.value?.themeColor || '#409EFF'

  if (isDark.value) {
    return {
      menuBg: '#001529',
      menuText: '#fff',
      menuActiveText: primaryColor,
      logoBg: '#002140',
      headerBg: '#001529'
    }
  } else {
    return {
      menuBg: primaryColor,
      menuText: '#ffffff',
      menuActiveText: '#ffffff',
      logoBg: mix(primaryColor, '#000000', 0.1),
      headerBg: mix(primaryColor, '#ffffff', 0.85)
    }
  }
})

const showWorkerAssistant = computed(() => {
  return route.path !== '/' && !route.path.startsWith('/ai/enterprise')
})

const getAuthHeader = () => {
  const tokenStr = localStorage.getItem('auth_token') || ''
  if (!tokenStr) return {}
  let token = tokenStr
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed?.token) token = parsed.token
  } catch (e) {}
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const superScopeSynced = ref(false)
const superScopeRetryCount = ref(0)
let superScopeRetryTimer = null

const scheduleSuperScopeRetry = () => {
  if (superScopeRetryTimer || superScopeSynced.value) return
  if (superScopeRetryCount.value >= 3) return
  superScopeRetryTimer = window.setTimeout(() => {
    superScopeRetryTimer = null
    superScopeRetryCount.value += 1
    ensureSuperAdminScopes()
  }, 2000 * (superScopeRetryCount.value + 1))
}

const ensureSuperAdminScopes = async () => {
  const info = userStore.userInfo || {}
  const isSuper = info.role === 'super_admin' || info.dbRole === 'super_admin'
  if (!isSuper || superScopeSynced.value) return
  let roleId = info.role_id || ''
  if (!roleId) {
    try {
      const res = await fetch('/api/roles?code=eq.super_admin', {
        method: 'GET',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', ...getAuthHeader() }
      })
      if (res.ok) {
        const list = await res.json()
        if (Array.isArray(list) && list.length > 0) {
          roleId = list[0].id
        }
      }
    } catch (e) {}
  }
  if (!roleId) return
  const modules = ['hr_employee', 'hr_org', 'hr_attendance', 'hr_change', 'hr_user', 'mms_ledger']
  const payload = modules.map((module) => ({
    role_id: roleId,
    module,
    scope_type: 'all',
    dept_id: null
  }))
  try {
    await fetch('/api/role_data_scopes?on_conflict=role_id,module', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Prefer': 'resolution=merge-duplicates',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    superScopeSynced.value = true
    if (superScopeRetryTimer) {
      window.clearTimeout(superScopeRetryTimer)
      superScopeRetryTimer = null
    }
  } catch (e) {}
}

const resolveAvatarUrl = async (info) => {
  if (!info?.avatar || typeof info.avatar !== 'string') return info
  if (!info.avatar.startsWith('file:')) return info
  const fileId = info.avatar.replace('file:', '')
  try {
    const res = await fetch(`/api/files?id=eq.${fileId}&select=content_base64,mime_type`, {
      headers: { 'Accept-Profile': 'public', ...getAuthHeader() }
    })
    if (!res.ok) return { ...info, avatar: '' }
    const list = await res.json()
    const row = Array.isArray(list) ? list[0] : null
    if (!row?.content_base64) return { ...info, avatar: '' }
    const mime = row.mime_type || 'application/octet-stream'
    return { ...info, avatar: `data:${mime};base64,${row.content_base64}` }
  } catch (e) {
    return { ...info, avatar: '' }
  }
}

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    return {}
  }
}

const fetchUserInfoByToken = async (token) => {
  if (!token) return null
  const payload = parseJwt(token)
  const username = payload?.username || payload?.sub || ''
  if (!username) return null
  try {
    const userRes = await fetch(`/api/v_users_manage?username=eq.${username}&select=username,full_name,avatar,role_id`, {
      method: 'GET',
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        Authorization: `Bearer ${token}`
      }
    })
    if (!userRes.ok) return null
    const list = await userRes.json()
    let row = Array.isArray(list) ? list[0] : null
    if (!row) {
      const fallbackRes = await fetch(`/api/users?username=eq.${username}&select=username,full_name,avatar,role`, {
        method: 'GET',
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public',
          Authorization: `Bearer ${token}`
        }
      })
      if (fallbackRes.ok) {
        const fallbackList = await fallbackRes.json()
        row = Array.isArray(fallbackList) ? fallbackList[0] : null
      }
    }
    if (!row) return null
    return {
      id: row.username || username,
      name: row.full_name || row.username || username,
      username: row.username || username,
      role: payload.app_role || payload.role || row.role || 'user',
      role_id: row.role_id || row.roleId || '',
      dbRole: payload.role || 'web_user',
      permissions: payload.permissions || [],
      avatar: row.avatar || ''
    }
  } catch (e) {
    return null
  }
}

const refreshUserInfo = async () => {
  try {
    let info = JSON.parse(localStorage.getItem('user_info') || '{}')
    const token = localStorage.getItem('auth_token') || ''
    if ((!info || !info.username) && token) {
      const fetched = await fetchUserInfoByToken(token)
      if (fetched) info = fetched
    }
    const resolved = await resolveAvatarUrl(info)
    userStore.userInfo = resolved || info
    avatarTick.value += 1
    if ((resolved || info) && typeof (resolved || info) === 'object') {
      const next = { ...(resolved || info), avatar: resolved?.avatar || info?.avatar || '' }
      localStorage.setItem('user_info', JSON.stringify(next))
    }
  } catch (e) {
    userStore.userInfo = {}
  }
}

const handleUserInfoMessage = (event) => {
  const data = event?.data || {}
  if (data?.type !== 'user-info-updated') return
  const next = data.user_info || data.user
  if (!next || typeof next !== 'object') return
  try {
    localStorage.setItem('user_info', JSON.stringify(next))
    refreshUserInfo()
  } catch (e) {}
}

const handleUserInfoStorage = (event) => {
  if (!event || event.key !== 'user_info') return
  refreshUserInfo()
}

onMounted(() => {
  window.addEventListener('user-info-updated', refreshUserInfo)
  window.addEventListener('message', handleUserInfoMessage)
  window.addEventListener('storage', handleUserInfoStorage)
  applyUserTheme()
  refreshUserInfo()
  ensureSuperAdminScopes()
  scheduleSuperScopeRetry()
  lastUserInfoStr = localStorage.getItem('user_info') || ''
  // 兜底：同窗口 localStorage 变更不会触发 storage 事件，用轮询确保头像即时刷新
  userInfoPoller = window.setInterval(() => {
    const current = localStorage.getItem('user_info') || ''
    if (current !== lastUserInfoStr) {
      lastUserInfoStr = current
      refreshUserInfo()
    }
  }, 500)
})
onUnmounted(() => {
  window.removeEventListener('user-info-updated', refreshUserInfo)
  window.removeEventListener('message', handleUserInfoMessage)
  window.removeEventListener('storage', handleUserInfoStorage)
  if (userInfoPoller) {
    window.clearInterval(userInfoPoller)
    userInfoPoller = null
  }
  if (superScopeRetryTimer) {
    window.clearTimeout(superScopeRetryTimer)
    superScopeRetryTimer = null
  }
})

watch(userThemeKey, () => {
  applyUserTheme()
})

watch(() => userStore.userInfo, () => {
  ensureSuperAdminScopes()
  scheduleSuperScopeRetry()
}, { deep: true })

watch(isDark, (val) => {
  try {
    localStorage.setItem(userThemeKey.value, val ? 'dark' : 'light')
  } catch (e) {}
})

const activeMenu = computed(() => {
  if (route.path.startsWith('/materials')) return '/materials'
  if (route.path.startsWith('/hr')) return '/hr'
  if (route.path.startsWith('/apps')) return '/apps/'
  if (route.path.startsWith('/sales')) return '/sales'
  if (route.path.startsWith('/purchase')) return '/purchase'
  if (route.path.startsWith('/production')) return '/production'
  return route.path
})

const canHome = computed(() => hasPerm('module:home'))
const canHr = computed(() => hasPerm('module:hr'))
const canMms = computed(() => hasPerm('module:mms'))
const isSuperAdmin = computed(() => userStore.userInfo?.role === 'super_admin')
const canSales = computed(() => hasPerm('module:sales') || isSuperAdmin.value)
const canPurchase = computed(() => hasPerm('module:purchase') || isSuperAdmin.value)
const canProduction = computed(() => hasPerm('module:production') || isSuperAdmin.value)
const hasAnyAppCenterEntryPerm = computed(() => {
  const perms = Array.isArray(userStore.userInfo?.permissions) ? userStore.userInfo.permissions : []
  return perms.some((perm) => typeof perm === 'string' && perm.startsWith('app:app_'))
})
const canApps = computed(() =>
  hasPerm('module:app') ||
  hasPerm('module:apps') ||
  hasAnyAppCenterEntryPerm.value ||
  isSuperAdmin.value
)

const HOST_TABS_STORAGE_KEY = 'eis_host_nav_tabs_v1'
const APP_RUNTIME_TITLE_STORAGE_KEY = 'eis_app_runtime_title_map_v1'
const hostOpenTabAliasMap = new Map()
const hostTabs = ref([{ key: '/', path: '/', query: {}, title: '首页', closable: false, dot: 'home', routeId: '/' }])
const activeHostTabKey = ref('/')

const ENTRY_TAB_KEY = '/'
const MODULE_ENTRY_TITLES = {
  '/': '首页',
  '/materials': '物料管理',
  '/hr': '人事管理',
  '/apps/': '应用中心',
  '/sales': '销售模块',
  '/purchase': '采购模块',
  '/production': '生产模块'
}

const MODULE_APP_KEY_TITLES = {
  materials: {
    a: '物料'
  },
  hr: {
    b: '调岗记录',
    c: '考勤管理'
  },
  sales: {
    customers: '客户档案',
    follow_ups: '客户跟进',
    opportunities: '销售商机',
    orders: '销售订单',
    payments: '回款记录'
  },
  purchase: {
    suppliers: '供应商档案',
    demands: '采购需求',
    orders: '采购订单',
    arrivals: '到货跟踪'
  },
  production: {
    bom_list: '配方清单',
    plans: '生产建议',
    work_orders: '生产工单',
    work_order_items: '领料跟进'
  }
}

const MODULE_DIRECT_APP_ROUTES = [
  { path: '/materials/batch-rules', title: '批次号规则' },
  { path: '/materials/warehouses', title: '仓库管理' },
  { path: '/materials/inventory-ledger', title: '库存台账' },
  { path: '/materials/inventory-stock-in', title: '入库' },
  { path: '/materials/inventory-stock-out', title: '出库' },
  { path: '/materials/inventory-current', title: '库存查询' },
  { path: '/materials/inventory-dashboard', title: '库存大屏' },
  { path: '/materials/material/detail', title: '物料', tabKey: '/materials/app/a' },
  { path: '/materials/material/label', title: '物料', tabKey: '/materials/app/a' },
  { path: '/materials/inventory-draft/detail', title: '库存台账', tabKey: '/materials/inventory-ledger' },
  { path: '/hr/employee', title: '人事花名册' },
  { path: '/hr/org', title: '部门架构图' },
  { path: '/hr/acl', title: '权限管理' },
  { path: '/hr/users', title: '用户管理' },
  { path: '/sales/cockpit', title: '销售驾驶舱' },
  { path: '/sales/dashboard', title: '销售看板' },
  { path: '/purchase/dashboard', title: '采购驾驶舱' },
  { path: '/production/overview', title: '生产总览' },
  { path: '/production/bom', title: '产品配方' }
]

const normalizeHostPath = (value) => {
  const raw = String(value || '').trim() || '/'
  if (raw === '/apps' || raw === '/apps/index.html') return '/apps/'
  if (raw === '/materials/' || raw === '/materials/index.html' || raw === '/materials/apps' || raw === '/materials/apps/') return '/materials'
  if (raw === '/hr/' || raw === '/hr/index.html' || raw === '/hr/apps' || raw === '/hr/apps/') return '/hr'
  if (raw === '/sales/' || raw === '/sales/index.html' || raw === '/sales/apps' || raw === '/sales/apps/') return '/sales'
  if (raw === '/purchase/' || raw === '/purchase/index.html' || raw === '/purchase/apps' || raw === '/purchase/apps/') return '/purchase'
  if (raw === '/production/' || raw === '/production/index.html' || raw === '/production/apps' || raw === '/production/apps/') return '/production'
  // Keep full child route for micro-app deep links (e.g. /materials/inventory-stock-in).
  if (raw === '/materials' || raw.startsWith('/materials/')) return raw
  if (raw === '/hr' || raw.startsWith('/hr/')) return raw
  if (raw === '/sales' || raw.startsWith('/sales/')) return raw
  if (raw === '/purchase' || raw.startsWith('/purchase/')) return raw
  if (raw === '/production' || raw.startsWith('/production/')) return raw
  if (raw.startsWith('/apps/config-center')) return '/apps/config-center'
  if (raw.startsWith('/apps/')) return raw
  if (raw === '/settings') return '/settings'
  if (raw.startsWith('/ai/enterprise')) return '/ai/enterprise'
  return raw
}

const normalizeHostQuery = (value) => {
  if (!value || typeof value !== 'object') return {}
  const next = {}
  Object.keys(value).sort().forEach((key) => {
    const current = value[key]
    if (current === null || current === undefined) return
    if (Array.isArray(current)) {
      const list = current.map((item) => String(item || '').trim()).filter(Boolean)
      if (list.length) next[key] = list.join(',')
      return
    }
    const text = String(current).trim()
    if (text) next[key] = text
  })
  return next
}

const serializeHostQuery = (query = {}) => {
  const params = new URLSearchParams()
  Object.keys(query).sort().forEach((key) => params.set(key, query[key]))
  return params.toString()
}

const buildHostRouteId = (path, query = {}) => {
  const qs = serializeHostQuery(query)
  return qs ? `${path}?${qs}` : path
}

const resolveHostTabDot = (path) => {
  if (path === '/') return 'home'
  if (path.startsWith('/materials')) return 'materials'
  if (path.startsWith('/hr')) return 'hr'
  if (path.startsWith('/apps')) return 'apps'
  if (path.startsWith('/sales')) return 'sales'
  if (path.startsWith('/purchase')) return 'purchase'
  if (path.startsWith('/production')) return 'production'
  return 'default'
}

const getEntryTitle = (path) => MODULE_ENTRY_TITLES[path] || '首页'

const isModuleEntryPath = (path) => {
  return path === '/' ||
    path === '/materials' ||
    path === '/hr' ||
    path === '/apps/' ||
    path === '/apps' ||
    path === '/sales' ||
    path === '/purchase' ||
    path === '/production'
}

const getModuleAppKeyTitle = (path) => {
  const match = String(path || '').match(/^\/(materials|hr|sales|purchase|production)\/app\/([^/?#]+)/)
  if (!match) return ''
  const moduleName = match[1]
  const appKey = decodeURIComponent(match[2] || '')
  return MODULE_APP_KEY_TITLES[moduleName]?.[appKey] || ''
}

const getDirectAppRoute = (path) => {
  return MODULE_DIRECT_APP_ROUTES.find((item) => path === item.path || path.startsWith(`${item.path}/`)) || null
}

const getPurchaseDocumentAppKey = (path, query = {}) => {
  if (!String(path || '').startsWith('/purchase/document/')) return ''
  const key = String(query.appKey || '').trim()
  return key || 'suppliers'
}

const isModuleAppPath = (path, query = {}) => {
  if (getPurchaseDocumentAppKey(path, query)) return true
  if (getModuleAppKeyTitle(path)) return true
  if (getDirectAppRoute(path)) return true
  return false
}

const getAppRuntimeIdFromPath = (path) => {
  const match = String(path || '').match(/^\/apps\/app\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

const readStoredAppRuntimeTitle = (appId) => {
  const key = String(appId || '').trim()
  if (!key) return ''
  try {
    const raw = localStorage.getItem(APP_RUNTIME_TITLE_STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    return String(map?.[key] || '').trim()
  } catch {
    return ''
  }
}

const normalizeFallbackTitle = (title) => {
  const text = String(title || '').trim()
  if (!text || text === '页面' || text === '应用运行') return ''
  return text
}

const getQueryAppTitle = (query = {}) => String(query.appName || query.name || '').trim()

const resolveHostTabTitle = (path, query = {}, fallback = '') => {
  const preferred = normalizeFallbackTitle(fallback)
  const purchaseDocumentAppKey = getPurchaseDocumentAppKey(path, query)
  if (purchaseDocumentAppKey) return MODULE_APP_KEY_TITLES.purchase?.[purchaseDocumentAppKey] || '采购单据'
  if (isModuleEntryPath(path)) return getEntryTitle(path === '/apps' ? '/apps/' : path)
  const moduleAppKeyTitle = getModuleAppKeyTitle(path)
  if (moduleAppKeyTitle) return moduleAppKeyTitle
  const directAppRoute = getDirectAppRoute(path)
  if (directAppRoute?.title) return directAppRoute.title
  if (path === '/apps/config-center') return '应用配置中心'
  if (path.startsWith('/apps/workflow-designer/')) return preferred || getQueryAppTitle(query) || '流程应用'
  if (path.startsWith('/apps/flash-builder/')) return preferred || getQueryAppTitle(query) || '闪念应用'
  if (path.startsWith('/apps/data-app/')) return preferred || getQueryAppTitle(query) || '数据表格应用'
  if (path.startsWith('/apps/ontology-relations/')) return '本体关系工作台'
  if (path.startsWith('/apps/app/')) {
    const queryTitle = getQueryAppTitle(query)
    return preferred || queryTitle || readStoredAppRuntimeTitle(getAppRuntimeIdFromPath(path)) || '应用运行'
  }
  if (path === '/settings') return '系统设置'
  if (path.startsWith('/ai/enterprise')) return '企业助手'
  if (preferred) return preferred
  return '页面'
}

const buildDefaultTabKey = (path, query = {}) => {
  if (isModuleEntryPath(path)) return ENTRY_TAB_KEY
  const purchaseDocumentAppKey = getPurchaseDocumentAppKey(path, query)
  if (purchaseDocumentAppKey) return `/purchase/app/${purchaseDocumentAppKey}`
  const directAppRoute = getDirectAppRoute(path)
  if (directAppRoute?.tabKey) return directAppRoute.tabKey
  if (directAppRoute) return directAppRoute.path
  if (isModuleAppPath(path, query)) {
    const match = String(path || '').match(/^\/(materials|hr|sales|purchase|production)\/app\/([^/?#]+)/)
    if (match) return `/${match[1]}/app/${decodeURIComponent(match[2] || '')}`
  }
  if (path === '/apps/config-center') return '/apps/config-center'
  if (path === '/settings') return '/settings'
  if (path.startsWith('/ai/enterprise')) return '/ai/enterprise'
  return path
}

const persistHostTabs = () => {
  try {
    const payload = hostTabs.value.map((tab) => ({
      key: tab.key,
      path: tab.path,
      query: tab.query || {},
      title: tab.title,
      closable: tab.key !== '/',
      dot: tab.dot || resolveHostTabDot(tab.path)
    }))
    localStorage.setItem(HOST_TABS_STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {}
}

const restoreHostTabs = () => {
  try {
    const raw = localStorage.getItem(HOST_TABS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    let entryTab = { key: ENTRY_TAB_KEY, path: '/', query: {}, title: '首页', closable: false, dot: 'home', routeId: '/' }
    const next = []
    const seen = new Set()
    const seenRouteIds = new Set()
    parsed.forEach((item) => {
      if (!item || typeof item !== 'object') return
      const path = normalizeHostPath(item.path)
      const query = normalizeHostQuery(item.query)
      const defaultKey = buildDefaultTabKey(path, query)
      const forceDefaultKey = isModuleEntryPath(path) ||
        isModuleAppPath(path, query) ||
        path === '/apps/config-center' ||
        path === '/settings' ||
        path.startsWith('/ai/enterprise')
      const key = String(forceDefaultKey ? defaultKey : (item.key || defaultKey)).trim()
      const routeId = buildHostRouteId(path, query)
      if (!key) return
      if (key === ENTRY_TAB_KEY) {
        entryTab = {
          key: ENTRY_TAB_KEY,
          path,
          query,
          title: resolveHostTabTitle(path, query, item.title),
          closable: false,
          dot: resolveHostTabDot(path),
          routeId
        }
        return
      }
      if (seen.has(key) || seenRouteIds.has(routeId)) return
      const title = resolveHostTabTitle(path, query, item.title)
      if (title === '页面') return
      seen.add(key)
      seenRouteIds.add(routeId)
      next.push({
        key,
        path,
        query,
        title,
        closable: key !== '/',
        dot: item.dot || resolveHostTabDot(path),
        routeId
      })
    })
    hostTabs.value = [entryTab, ...next]
  } catch (e) {}
}

const upsertHostTab = ({ key, path, query = {}, title = '' }) => {
  const normalizedPath = normalizeHostPath(path)
  const normalizedQuery = normalizeHostQuery(query)
  const tabKey = String(key || buildDefaultTabKey(normalizedPath, normalizedQuery)).trim()
  const routeId = buildHostRouteId(normalizedPath, normalizedQuery)
  const next = {
    key: tabKey,
    path: normalizedPath,
    query: normalizedQuery,
    title: resolveHostTabTitle(normalizedPath, normalizedQuery, title),
    closable: tabKey !== '/',
    dot: resolveHostTabDot(normalizedPath),
    routeId
  }
  const index = hostTabs.value.findIndex((tab) => tab.key === tabKey)
  if (index >= 0) hostTabs.value[index] = { ...hostTabs.value[index], ...next }
  else hostTabs.value.push(next)
  persistHostTabs()
  return next
}

const resolveTabByRoute = (path, query) => {
  const routeId = buildHostRouteId(path, query)
  return hostTabs.value.find((tab) => tab.routeId === routeId)
    || hostTabs.value.find((tab) => tab.key === buildDefaultTabKey(path, query))
}

const syncHostTabsWithRoute = () => {
  if (route.path === '/login') return
  const path = normalizeHostPath(route.path)
  const query = normalizeHostQuery(route.query)
  const routeId = buildHostRouteId(path, query)
  const alias = hostOpenTabAliasMap.get(routeId)
  const existing = resolveTabByRoute(path, query)
  const resolvedTitle = alias?.title || resolveHostTabTitle(path, query, existing?.title)
  const tab = existing || upsertHostTab({
    key: alias?.key || buildDefaultTabKey(path, query),
    path,
    query,
    title: resolvedTitle
  })
  if (existing) {
    const nextRouteId = buildHostRouteId(path, query)
    Object.assign(existing, {
      path,
      query,
      title: resolvedTitle,
      closable: existing.key !== ENTRY_TAB_KEY,
      dot: resolveHostTabDot(path),
      routeId: nextRouteId
    })
  }
  activeHostTabKey.value = tab.key
  persistHostTabs()
}

const switchHostTab = (tab) => {
  if (!tab) return
  activeHostTabKey.value = tab.key
  const currentRouteId = buildHostRouteId(
    normalizeHostPath(route.path),
    normalizeHostQuery(route.query)
  )
  if (currentRouteId === tab.routeId) return
  router.push({ path: tab.path, query: tab.query || {} }).catch(() => {})
}

const closeHostTab = (key) => {
  if (!key || key === '/') return
  const index = hostTabs.value.findIndex((tab) => tab.key === key)
  if (index < 0) return
  const closingActive = activeHostTabKey.value === key
  hostTabs.value.splice(index, 1)
  persistHostTabs()
  if (!closingActive) return
  const fallback = hostTabs.value[index - 1] || hostTabs.value[index] || hostTabs.value[0]
  if (fallback) switchHostTab(fallback)
}

const handleOpenHostTab = (payload) => {
  const detail = payload && typeof payload === 'object' ? payload : {}
  const path = normalizeHostPath(detail.path)
  if (!path) return
  const query = normalizeHostQuery(detail.query)
  const key = String(detail.tabKey || buildDefaultTabKey(path, query)).trim()
  const title = resolveHostTabTitle(path, query, detail.tabTitle)
  const routeId = buildHostRouteId(path, query)
  hostOpenTabAliasMap.set(routeId, { key, title })
  upsertHostTab({ key, path, query, title })
  activeHostTabKey.value = key
  router.push({ path, query }).catch(() => {})
}

const handleOpenHostTabEvent = (event) => {
  handleOpenHostTab(event?.detail || {})
}

const handleOpenHostTabMessage = (event) => {
  const data = event?.data || {}
  if (data?.type !== 'eis:open-host-tab') return
  handleOpenHostTab(data?.detail || {})
}

restoreHostTabs()
watch(() => route.fullPath, syncHostTabsWithRoute, { immediate: true })
onMounted(() => {
  window.addEventListener('eis:open-host-tab', handleOpenHostTabEvent)
  window.addEventListener('message', handleOpenHostTabMessage)
})
onUnmounted(() => {
  window.removeEventListener('eis:open-host-tab', handleOpenHostTabEvent)
  window.removeEventListener('message', handleOpenHostTabMessage)
})

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

const handleCommand = (command) => {
  if (command === 'settings') { router.push('/settings') }
  else if (command === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}

const driverObj = driver({
  showProgress: true,
  steps: [{ element: '.layout-aside', popover: { title: '提示', description: '侧边栏现在是纯粹的主题色！' } }]
});
const startGuide = () => { driverObj.drive(); }
</script>

<style scoped lang="scss">
.layout-container {
  height: 100vh;

  .layout-aside {
    transition: width 0.3s;
    overflow-x: hidden;

    .logo {
      height: 60px; line-height: 60px; text-align: center;
      font-size: 18px; font-weight: 600; color: white;
      transition: background-color 0.3s;
      white-space: nowrap;
    }
    .el-menu { border-right: none; }

    .el-menu-vertical:not(.el-menu--collapse) {
      width: 200px;
    }
  }

  .layout-header {
    border-bottom: 1px solid rgba(0,0,0,0.05);
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 20px;
    transition: background-color 0.3s;

    .header-left {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;

      .collapse-btn {
        margin-right: 15px;
        cursor: pointer;
        display: flex;
        align-items: center;
        &:hover { opacity: 0.7; }
      }

      .host-tabs-wrap {
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }

      .host-tabs-scroll {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        overflow-y: hidden;
        white-space: nowrap;
        padding-bottom: 2px;
      }

      .host-tab {
        height: 34px;
        max-width: 240px;
        border-radius: 10px 10px 0 0;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.68);
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #2c3e50;
        transition: all .2s ease;
      }

      .host-tab.active {
        background: #ffffff;
        border-color: rgba(64, 158, 255, 0.45);
        box-shadow: 0 6px 14px rgba(64, 158, 255, 0.14);
      }

      .host-tab-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 16px;
        font-weight: 600;
      }

      .host-tab-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        flex-shrink: 0;
        background: #95a5a6;
      }

      .host-tab-dot.dot-home { background: #67c23a; }
      .host-tab-dot.dot-materials { background: #409eff; }
      .host-tab-dot.dot-hr { background: #e6a23c; }
      .host-tab-dot.dot-apps { background: #8b5cf6; }
      .host-tab-dot.dot-sales { background: #f56c6c; }
      .host-tab-dot.dot-purchase { background: #10b981; }
      .host-tab-dot.dot-production { background: #22c55e; }

      .host-tab-close {
        color: #909399;
        opacity: 0;
        transition: opacity .2s ease;
      }

      .host-tab:hover .host-tab-close,
      .host-tab.active .host-tab-close {
        opacity: 1;
      }
    }

    .header-right {
      margin-left: 12px;
      flex-shrink: 0;
    }
  }

  .main-container {
    min-height: 0;      /* 关键：阻止 flex 子元素 min-height:auto 撑开容器 */
    overflow: hidden;
  }

  .layout-main {
    background-color: var(--el-bg-color-page);
    padding: 0;
    position: relative;
    transition: background-color 0.3s;
    overflow: hidden !important; /* 覆盖 el-main 默认 overflow:auto */

    #subapp-viewport {
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .subapp-viewport {
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
    }
  }

  .colorful-mode {
    background-color: var(--page-bg-tint) !important;
  }

  .colorful-mode :deep(.el-card) {
    background-color: var(--card-bg-tint) !important;
    border: 1px solid var(--el-color-primary-light-8);
  }
}

:deep(.el-menu-item.is-active) {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-right: 4px solid #fff;
  font-weight: 700;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
