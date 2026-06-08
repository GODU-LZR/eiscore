<template>
  <el-container class="layout-container">
    <el-aside
      :width="isCollapse ? '64px' : '200px'"
      class="layout-aside"
      data-guide="layout-aside"
      :style="{ backgroundColor: asideTheme.menuBg }"
    >
      <div
        class="logo"
        data-guide="layout-logo"
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
        :router="false"
        :collapse="isCollapse"
        :collapse-transition="false"
        @select="handleMenuSelect"
        style="border-right: none;"
      >
        <el-menu-item v-if="canHome" index="/" data-guide="menu-home">
          <el-icon><House /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>
        <el-menu-item v-if="canMms" index="/materials" data-guide="menu-materials">
          <el-icon><Box /></el-icon>
          <template #title>仓储管理</template>
        </el-menu-item>
        <el-menu-item v-if="canHr" index="/hr" data-guide="menu-hr">
          <el-icon><User /></el-icon>
          <template #title>人事管理</template>
        </el-menu-item>
        <el-menu-item v-if="canApps" index="/apps/" data-guide="menu-apps">
          <el-icon><Grid /></el-icon>
          <template #title>应用中心</template>
        </el-menu-item>
        <el-menu-item v-if="canSales" index="/sales" data-guide="menu-sales">
          <el-icon><Sell /></el-icon>
          <template #title>销售管理</template>
        </el-menu-item>
        <el-menu-item v-if="canPurchase" index="/purchase" data-guide="menu-purchase">
          <el-icon><ShoppingCart /></el-icon>
          <template #title>采购管理</template>
        </el-menu-item>
        <el-menu-item v-if="canProduction" index="/production" data-guide="menu-production">
          <el-icon><Tools /></el-icon>
          <template #title>生产管理</template>
        </el-menu-item>
        <el-menu-item v-if="canQuality" index="/quality" data-guide="menu-quality">
          <el-icon><CircleCheck /></el-icon>
          <template #title>质量管理</template>
        </el-menu-item>
        <el-menu-item v-if="canEquipment" index="/equipment" data-guide="menu-equipment">
          <el-icon><Monitor /></el-icon>
          <template #title>设备管理</template>
        </el-menu-item>
        <el-menu-item v-if="canDecision" index="/decision" data-guide="menu-decision">
          <el-icon><DataBoard /></el-icon>
          <template #title>决策支持</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="main-container">
      <el-header
        class="layout-header"
        :style="{ backgroundColor: asideTheme.headerBg }"
      >
        <div class="header-left">
          <div class="collapse-btn" data-guide="collapse-button" @click="toggleCollapse">
            <el-icon size="20" :color="isDark ? '#fff' : '#333'">
              <component :is="isCollapse ? 'Expand' : 'Fold'" />
            </el-icon>
          </div>
          <div class="host-tabs-wrap" data-guide="host-tabs">
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

        <div class="header-right" data-guide="header-actions">
          <el-switch
            v-if="showThemeToggle"
            v-model="isDark"
            inline-prompt
            active-icon="Moon"
            inactive-icon="Sunny"
            @change="toggleDark"
            style="margin-right: 15px"
          />
          <el-popover
            v-model:visible="guideCenterVisible"
            placement="bottom-end"
            trigger="click"
            width="380"
            popper-class="guide-center-popper"
            @show="refreshGuideDom"
          >
            <template #reference>
              <el-button
                circle
                icon="QuestionFilled"
                class="guide-entry-btn"
                data-guide="guide-entry"
                style="margin-right: 15px"
              />
            </template>
            <div class="guide-center">
              <div class="guide-center__header">
                <div>
                  <strong>全局引导中心</strong>
                  <p>按当前页面和角色提供可执行的操作指引。</p>
                </div>
                <el-tag size="small" type="info">{{ availableGuides.length }} 项</el-tag>
              </div>
              <div class="guide-center__actions">
                <el-button size="small" type="primary" @click="runRecommendedGuide">开始推荐指引</el-button>
                <el-button size="small" @click="resetGuideProgress">重置已读</el-button>
              </div>
              <div class="guide-center__list">
                <button
                  v-for="guide in availableGuides"
                  :key="guide.id"
                  type="button"
                  class="guide-card"
                  @click="runGuide(guide)"
                >
                  <span class="guide-card__title">{{ guide.title }}</span>
                  <span class="guide-card__desc">{{ guide.description }}</span>
                  <span class="guide-card__meta">
                    <span class="guide-card__tags">
                      <el-tag size="small" :type="guide.type === 'sop' ? 'warning' : 'primary'">
                        {{ guide.type === 'sop' ? 'SOP' : '指引' }}
                      </el-tag>
                      <el-tag size="small" :type="hasSeenGuide(guide.id) ? 'info' : 'success'">
                        {{ hasSeenGuide(guide.id) ? '已看过' : '推荐' }}
                      </el-tag>
                    </span>
                    <span>{{ guide.steps.length }} 步</span>
                  </span>
                </button>
              </div>
            </div>
          </el-popover>
          <el-dropdown @command="handleCommand">
            <span class="el-dropdown-link" data-guide="user-menu" style="display: flex; align-items: center; cursor: pointer;">
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

      <el-main class="layout-main" data-guide="layout-main" :class="{ 'colorful-mode': !isDark }">
        <router-view v-slot="{ Component }">
           <transition name="fade" mode="out-in">
             <keep-alive>
               <component :is="Component" />
             </keep-alive>
           </transition>
        </router-view>

        <div id="subapp-viewport" class="subapp-viewport" data-guide="subapp-viewport"></div>
      </el-main>
    </el-container>

    <AiCopilot v-if="showWorkerAssistant" mode="worker" data-guide="worker-assistant" />

    <el-dialog
      v-model="guideWelcomeVisible"
      title="新手指引"
      width="430px"
      append-to-body
      class="guide-welcome-dialog"
    >
      <div class="guide-welcome">
        <strong>需要按 SOP 了解当前页面怎么操作吗？</strong>
        <p>系统会按步骤标出模块入口、应用卡片、表格工具栏、表单填写和提交位置。你也可以稍后从右上角问号按钮再次打开。</p>
      </div>
      <template #footer>
        <el-button @click="skipGuideWelcome">稍后再说</el-button>
        <el-button type="primary" @click="startWelcomeGuide">开始指引</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { mix } from '@/utils/theme'
import { hasPerm } from '@/utils/permission'
import { canonicalizeMicroChainPath, ensureAbsoluteHostPath } from '@/utils/micro-path'
import { House, Box, User, Grid, Sell, ShoppingCart, Tools, CircleCheck, Monitor, DataBoard, Expand, Fold, Moon, Sunny, QuestionFilled, ArrowDown, Close } from '@element-plus/icons-vue'
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
const GUIDE_PROGRESS_VERSION = 'v1'
const GUIDE_PROGRESS_PREFIX = `eis_guide_progress_${GUIDE_PROGRESS_VERSION}`
const GUIDE_WELCOME_PREFIX = `eis_guide_welcome_${GUIDE_PROGRESS_VERSION}`
const guideCenterVisible = ref(false)
const guideWelcomeVisible = ref(false)
const customGuides = ref([])
const guideProgress = ref({})
const guideDomTick = ref(0)
let guideDomObserver = null
let guideDomRefreshTimer = null
const userThemeKey = computed(() => {
  const username = userStore.userInfo?.username || userStore.userInfo?.id || 'guest'
  return `eis_theme_${String(username).toLowerCase()}`
})

const guideUserKey = computed(() => {
  const username = userStore.userInfo?.username || userStore.userInfo?.id || 'guest'
  return String(username || 'guest').toLowerCase()
})

const guideProgressKey = computed(() => `${GUIDE_PROGRESS_PREFIX}_${guideUserKey.value}`)
const guideWelcomeKey = computed(() => `${GUIDE_WELCOME_PREFIX}_${guideUserKey.value}`)

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

const WORKER_ASSISTANT_HIDDEN_ROUTES = [
  '/materials/inventory-dashboard',
  '/sales/cockpit',
  '/purchase/dashboard',
  '/quality/dashboard',
  '/equipment/dashboard'
]

const isPathInRouteGroup = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`)

const showWorkerAssistant = computed(() => {
  const path = route.path || '/'
  if (path === '/' || path.startsWith('/ai/enterprise')) return false
  return !WORKER_ASSISTANT_HIDDEN_ROUTES.some((item) => isPathInRouteGroup(path, item))
})

const getAuthHeader = () => {
  const tokenStr = localStorage.getItem('auth_token') || ''
  if (!tokenStr) return {}
  let token = tokenStr
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed?.token) token = parsed.token
  } catch (e) {}
  if (token && token.length > 8192) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    return {}
  }
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
  window.addEventListener('message', handleGuideRegisterMessage)
  window.addEventListener('eis:register-guide', handleGuideRegisterEvent)
  window.addEventListener('storage', handleUserInfoStorage)
  applyUserTheme()
  loadGuideProgress()
  refreshUserInfo()
  ensureSuperAdminScopes()
  scheduleSuperScopeRetry()
  maybeOpenWelcomeGuide()
  scheduleGuideDomRefresh()
  if (typeof MutationObserver !== 'undefined') {
    const target = document.querySelector('[data-guide="layout-main"]') || document.body
    guideDomObserver = new MutationObserver(scheduleGuideDomRefresh)
    guideDomObserver.observe(target, { childList: true, subtree: true })
  }
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
  window.removeEventListener('message', handleGuideRegisterMessage)
  window.removeEventListener('eis:register-guide', handleGuideRegisterEvent)
  window.removeEventListener('storage', handleUserInfoStorage)
  if (userInfoPoller) {
    window.clearInterval(userInfoPoller)
    userInfoPoller = null
  }
  if (superScopeRetryTimer) {
    window.clearTimeout(superScopeRetryTimer)
    superScopeRetryTimer = null
  }
  if (guideDomObserver) {
    guideDomObserver.disconnect()
    guideDomObserver = null
  }
  if (guideDomRefreshTimer) {
    window.clearTimeout(guideDomRefreshTimer)
    guideDomRefreshTimer = null
  }
})

watch(userThemeKey, () => {
  applyUserTheme()
})

watch(guideUserKey, () => {
  loadGuideProgress()
  maybeOpenWelcomeGuide()
})

watch(() => route.fullPath, () => {
  scheduleGuideDomRefresh()
  window.setTimeout(scheduleGuideDomRefresh, 500)
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
  if (route.path.startsWith('/quality')) return '/quality'
  if (route.path.startsWith('/equipment')) return '/equipment'
  if (route.path.startsWith('/decision')) return '/decision'
  return route.path
})

const canHome = computed(() => hasPerm('module:home'))
const canHr = computed(() => hasPerm('module:hr'))
const canMms = computed(() => hasPerm('module:mms'))
const isSuperAdmin = computed(() => userStore.userInfo?.role === 'super_admin')
const canSales = computed(() => hasPerm('module:sales') || isSuperAdmin.value)
const canPurchase = computed(() => hasPerm('module:purchase') || isSuperAdmin.value)
const canProduction = computed(() => hasPerm('module:production') || isSuperAdmin.value)
const canQuality = computed(() => hasPerm('module:quality') || isSuperAdmin.value)
const canEquipment = computed(() => hasPerm('module:equipment') || isSuperAdmin.value)
const canDecision = computed(() =>
  hasPerm('module:decision') ||
  hasPerm('module:sales') ||
  hasPerm('module:mms') ||
  hasPerm('module:purchase') ||
  hasPerm('module:production') ||
  hasPerm('module:quality') ||
  hasPerm('module:equipment') ||
  isSuperAdmin.value
)
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

const refreshGuideDom = () => {
  guideDomTick.value += 1
}

const scheduleGuideDomRefresh = () => {
  if (typeof window === 'undefined') return
  if (guideDomRefreshTimer) return
  guideDomRefreshTimer = window.setTimeout(() => {
    guideDomRefreshTimer = null
    refreshGuideDom()
  }, 120)
}

const resolveGuideElement = (selector) => {
  if (!selector || typeof document === 'undefined') return null
  return document.querySelector(selector)
}

const createGuideStep = ({ selector, title, description, side = 'bottom', align = 'start' }) => ({
  element: selector,
  popover: { title, description, side, align }
})

const MODULE_SOP_TITLES = {
  '/materials': '仓储管理',
  '/hr': '人事管理',
  '/apps': '应用中心',
  '/sales': '销售管理',
  '/purchase': '采购管理',
  '/production': '生产管理',
  '/quality': '质量管理',
  '/equipment': '设备管理',
  '/decision': '决策支持'
}

const currentSopModule = computed(() => {
  const path = route.path || '/'
  const match = Object.keys(MODULE_SOP_TITLES)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  return match ? MODULE_SOP_TITLES[match] : '当前页面'
})

const hasGuideElement = (selector) => Boolean(resolveGuideElement(selector))

const normalizeGuideText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeGuideId = (value) => normalizeGuideText(value)
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
  .replace(/^-+|-+$/g, '') || 'current'

const escapeGuideAttr = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')

const queryGuideElements = (selector) => {
  if (!selector || typeof document === 'undefined') return []
  try {
    return Array.from(document.querySelectorAll(selector))
  } catch (e) {
    return []
  }
}

const isGuideElementVisible = (element) => {
  if (!element || typeof window === 'undefined') return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
}

const readGuideText = (root, selector, fallback = '') => {
  const target = selector ? root?.querySelector(selector) : root
  return normalizeGuideText(target?.textContent || fallback)
}

const getVisibleAppCardInfos = () => {
  guideDomTick.value
  const seen = new Set()
  return queryGuideElements('[data-guide="app-card"], .app-card')
    .filter((card) => {
      if (!isGuideElementVisible(card) || seen.has(card)) return false
      seen.add(card)
      return true
    })
    .map((card, index) => {
      const key = card.getAttribute('data-guide-key') || `card-${index + 1}`
      const selector = card.getAttribute('data-guide-key')
        ? `[data-guide="app-card"][data-guide-key="${escapeGuideAttr(key)}"]`
        : '.app-card'
      return {
        key,
        selector,
        name: readGuideText(card, '.app-name', `应用卡片 ${index + 1}`),
        desc: readGuideText(card, '.app-desc', ''),
        status: readGuideText(card, '[data-guide="app-card-status"], .app-status', ''),
        metrics: readGuideText(card, '[data-guide="app-card-metrics"], .app-metrics', '')
      }
    })
    .filter((card) => card.name)
}

const parseSopStepTexts = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((item) => normalizeGuideText(item)).filter(Boolean)
  } catch (e) {}
  return raw
    .split('|')
    .map((item) => normalizeGuideText(item))
    .filter(Boolean)
}

const getVisibleSopActionInfos = () => {
  guideDomTick.value
  const seen = new Set()
  return queryGuideElements('[data-sop-action]')
    .filter((element) => {
      if (!isGuideElementVisible(element)) return false
      const action = element.getAttribute('data-sop-action') || ''
      if (!action || seen.has(action)) return false
      seen.add(action)
      return true
    })
    .map((element, index) => {
      const action = element.getAttribute('data-sop-action') || `action-${index + 1}`
      const title = normalizeGuideText(element.getAttribute('data-sop-title') || element.textContent || '业务动作')
      const desc = normalizeGuideText(element.getAttribute('data-sop-desc') || '')
      const risk = normalizeGuideText(element.getAttribute('data-sop-risk') || '')
      const steps = parseSopStepTexts(element.getAttribute('data-sop-steps'))
      return {
        action,
        selector: `[data-sop-action="${escapeGuideAttr(action)}"]`,
        title,
        desc,
        risk,
        steps
      }
    })
    .filter((item) => item.title)
}

const canUseGuide = (guide) => {
  guideDomTick.value
  if (!guide || typeof guide !== 'object') return false
  if (Array.isArray(guide.routes) && guide.routes.length) {
    const path = route.path || '/'
    const matched = guide.routes.some((item) => {
      const prefix = String(item || '').trim()
      return prefix && (path === prefix || path.startsWith(`${prefix}/`))
    })
    if (!matched) return false
  }
  if (typeof guide.when === 'function' && !guide.when()) return false
  return Array.isArray(guide.steps) && guide.steps.some((step) => resolveGuideElement(step.element))
}

const baseGuide = computed(() => ({
  id: 'base-overview',
  title: '系统基础导航',
  description: '了解左侧模块、顶部页签、右上角用户菜单和工作区。',
  type: 'guide',
  priority: 100,
  steps: [
    createGuideStep({
      selector: '[data-guide="layout-logo"]',
      title: '系统名称',
      description: '这里显示系统标题，管理员可以在系统设置中修改。'
    }),
    createGuideStep({
      selector: '[data-guide="layout-aside"]',
      title: '左侧模块导航',
      description: '业务模块集中在这里。不同角色看到的模块会根据权限自动变化。',
      side: 'right'
    }),
    createGuideStep({
      selector: '[data-guide="host-tabs"]',
      title: '顶部页签',
      description: '进入模块或应用后会生成页签，便于在多个业务页面之间切换。',
      side: 'bottom'
    }),
    createGuideStep({
      selector: '[data-guide="layout-main"]',
      title: '业务工作区',
      description: '表格、表单、驾驶舱和子模块页面都会在这里显示。',
      side: 'left'
    }),
    createGuideStep({
      selector: '[data-guide="guide-entry"]',
      title: '全局引导中心',
      description: '以后可以从这里重新查看基础指引，也可以启动当前模块的专属指引。',
      side: 'bottom'
    }),
    createGuideStep({
      selector: '[data-guide="user-menu"]',
      title: '用户菜单',
      description: '系统设置、退出登录等账号相关操作都在这里。',
      side: 'bottom'
    })
  ]
}))

const moduleGuideMap = computed(() => ([
  {
    id: 'module-materials',
    title: '仓储管理入口',
    description: '进入仓储管理，处理物料、仓库、库存台账和出入库。',
    type: 'guide',
    routes: ['/materials'],
    when: () => canMms.value,
    priority: 80,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-materials"]', title: '仓储管理', description: '点击这里进入仓储管理模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '仓储工作区', description: '仓储模块的应用卡片、表格和详情页会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-hr',
    title: '人事管理入口',
    description: '进入人事管理，处理档案、组织、考勤和用户权限。',
    type: 'guide',
    routes: ['/hr'],
    when: () => canHr.value,
    priority: 70,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-hr"]', title: '人事管理', description: '点击这里进入人事管理模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '人事工作区', description: '人事模块的表格、表单和组织页面会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-sales',
    title: '销售管理入口',
    description: '进入销售管理，处理客户、商机、订单、回款和销售驾驶舱。',
    type: 'guide',
    routes: ['/sales'],
    when: () => canSales.value,
    priority: 70,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-sales"]', title: '销售管理', description: '点击这里进入销售管理模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '销售工作区', description: '销售应用卡片、订单表格和销售驾驶舱会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-purchase',
    title: '采购管理入口',
    description: '进入采购管理，处理供应商、采购需求、采购订单和到货跟踪。',
    type: 'guide',
    routes: ['/purchase'],
    when: () => canPurchase.value,
    priority: 70,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-purchase"]', title: '采购管理', description: '点击这里进入采购管理模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '采购工作区', description: '采购应用卡片、采购表格和采购驾驶舱会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-production',
    title: '生产管理入口',
    description: '进入生产管理，处理配方、生产计划、工单和领料跟进。',
    type: 'guide',
    routes: ['/production'],
    when: () => canProduction.value,
    priority: 70,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-production"]', title: '生产管理', description: '点击这里进入生产管理模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '生产工作区', description: '生产应用卡片、生产工单和生产总览会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-quality',
    title: '质量管理入口',
    description: '进入质量管理，处理质检、NCR、整改任务和质量总览。',
    type: 'guide',
    routes: ['/quality'],
    when: () => canQuality.value,
    priority: 70,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-quality"]', title: '质量管理', description: '点击这里进入质量管理模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '质量工作区', description: '质量应用卡片、质检表格和质量大屏会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-equipment',
    title: '设备管理入口',
    description: '进入设备管理，处理设备台账、点检、异常和维保工单。',
    type: 'guide',
    routes: ['/equipment'],
    when: () => canEquipment.value,
    priority: 70,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-equipment"]', title: '设备管理', description: '点击这里进入设备管理模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '设备工作区', description: '设备应用卡片、设备表格和设备大屏会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-apps',
    title: '应用中心入口',
    description: '进入应用中心，管理低代码应用、流程和配置。',
    type: 'guide',
    routes: ['/apps'],
    when: () => canApps.value,
    priority: 60,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-apps"]', title: '应用中心', description: '点击这里进入应用中心。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '应用工作区', description: '应用配置、运行页和流程设计器会显示在这里。', side: 'left' })
    ]
  },
  {
    id: 'module-decision',
    title: '决策支持入口',
    description: '进入决策支持，查看跨模块经营态势和驾驶舱。',
    type: 'guide',
    routes: ['/decision'],
    when: () => canDecision.value,
    priority: 60,
    steps: [
      createGuideStep({ selector: '[data-guide="menu-decision"]', title: '决策支持', description: '点击这里进入决策支持模块。', side: 'right' }),
      createGuideStep({ selector: '[data-guide="subapp-viewport"]', title: '决策工作区', description: '跨模块驾驶舱和经营态势页面会显示在这里。', side: 'left' })
    ]
  }
]))

const sopGuideMap = computed(() => {
  guideDomTick.value
  const moduleTitle = currentSopModule.value
  const routeId = normalizeGuideId(route.path || 'current')
  const appCardGuides = getVisibleAppCardInfos().map((card, index) => ({
    id: `sop-${routeId}-card-${normalizeGuideId(card.key)}`,
    title: `${card.name} SOP`,
    description: card.desc
      ? `按标准步骤进入并处理“${card.name}”：${card.desc}`
      : `按标准步骤进入并处理“${card.name}”。`,
    type: 'sop',
    category: '应用卡片',
    priority: 89 - Math.min(index, 20),
    when: () => hasGuideElement(card.selector),
    steps: [
      createGuideStep({
        selector: card.selector,
        title: `第 1 步：确认要处理“${card.name}”`,
        description: `先确认当前卡片是否对应你手头的工作。${card.desc ? `用途：${card.desc}` : '如果不确定，先返回模块入口确认。'}`,
        side: 'right'
      }),
      createGuideStep({
        selector: `${card.selector} [data-guide="app-card-status"], ${card.selector} .app-status`,
        title: '第 2 步：判断处理优先级',
        description: card.status
          ? `当前卡片状态是“${card.status}”。紧急、预警和待处理事项要优先处理；正常状态可以按日常节奏处理。`
          : '先看卡片状态，紧急、预警和待处理事项要优先处理；正常状态可以按日常节奏处理。',
        side: 'bottom'
      }),
      createGuideStep({
        selector: `${card.selector} [data-guide="app-card-metrics"], ${card.selector} .app-metrics`,
        title: '第 3 步：读取关键业务数量',
        description: card.metrics
          ? `这里显示关键数量：${card.metrics}。数量异常时，进入后先用紧急、预警、重点或待处理筛选定位数据。`
          : '这里显示当前应用的关键数量。数量异常时，进入后先用紧急、预警、重点或待处理筛选定位数据。',
        side: 'top'
      }),
      createGuideStep({
        selector: `${card.selector} [data-guide="app-card-enter"], ${card.selector} .app-enter, ${card.selector} .app-actions, ${card.selector} .app-card-footer`,
        title: '第 4 步：进入应用并按表格 SOP 处理',
        description: '点击进入后，先筛选异常或待处理数据，再搜索目标记录；新增、编辑、删除和导出都要按表格工具栏 SOP 执行。',
        side: 'top'
      })
    ]
  }))
  const actionGuides = getVisibleSopActionInfos().map((action, index) => ({
    id: `sop-${routeId}-action-${normalizeGuideId(action.action)}`,
    title: `${action.title} SOP`,
    description: action.desc || `按标准步骤执行“${action.title}”。`,
    type: 'sop',
    category: '业务动作',
    priority: 93 - Math.min(index, 20),
    when: () => hasGuideElement(action.selector),
    steps: [
      createGuideStep({
        selector: '[data-guide="grid-business-actions"], .toolbar-business-row',
        title: '第 1 步：先筛出待处理数据',
        description: '先用“紧急、预警、重点、待处理”等筛选按钮缩小范围，再确认当前表格里确实有需要执行该动作的数据。',
        side: 'bottom'
      }),
      createGuideStep({
        selector: action.selector,
        title: `第 2 步：执行“${action.title}”`,
        description: action.desc || '点击前确认权限、选中记录和当前筛选条件，避免生成错误单据或重复流转。',
        side: 'bottom'
      }),
      ...action.steps.map((step, stepIndex) => createGuideStep({
        selector: action.selector,
        title: `操作要点 ${stepIndex + 1}`,
        description: step,
        side: 'bottom'
      })),
      createGuideStep({
        selector: '[data-guide="grid-search"], .toolbar-search',
        title: '最后一步：搜索结果并复核',
        description: action.risk || '动作完成后搜索新生成或已关联的单号，确认状态、来源、数量、责任人和下一环节都正确。',
        side: 'bottom'
      })
    ]
  }))

  return [
    {
      id: `sop-${route.path || 'current'}-app-cards`,
      title: `${moduleTitle}应用卡片 SOP`,
      description: '按“确认模块 - 找卡片 - 看状态 - 看指标 - 进入应用”的顺序选择业务入口。',
      type: 'sop',
      category: '应用卡片',
      priority: 95,
      when: () => hasGuideElement('[data-guide="app-list-page"], .app-card'),
      steps: [
        createGuideStep({
          selector: '[data-guide="app-list-header"], .apps-header',
          title: '第 1 步：确认当前模块',
          description: '先确认页面标题是否是你要处理的业务模块。业务做错模块会造成单据、库存、质检或设备记录串错。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 2 步：选择应用卡片',
          description: '一张卡片就是一个业务应用。先找与你手头任务一致的卡片，例如台账、单据、异常、工单或总览。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="app-card-status"], .app-card .app-status',
          title: '第 3 步：先看关注状态',
          description: '状态会提示紧急、预警、重点或正常。优先处理紧急和预警，避免超期、漏检、缺料、未维修等风险继续扩大。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="app-card-metrics"], .app-card .app-metrics',
          title: '第 4 步：再看关键数量',
          description: '这些数量用于判断当前工作量和风险规模。数字异常时，进入应用后先用筛选按钮定位异常数据。',
          side: 'top'
        }),
        createGuideStep({
          selector: '[data-guide="app-card-enter"], .app-card .app-enter',
          title: '第 5 步：进入应用处理',
          description: '确认卡片后点击进入。进入后按表格 SOP 执行“筛选、查找、新增或编辑、保存、导出”。',
          side: 'top'
        })
      ]
    },
    {
      id: `sop-${route.path || 'current'}-grid`,
      title: `${moduleTitle}表格操作 SOP`,
      description: '按“看筛选 - 查数据 - 新增/编辑 - 删除/导出 - 复核结果”的顺序处理业务表格。',
      type: 'sop',
      category: '表格',
      priority: 94,
      when: () => hasGuideElement('[data-guide="grid-wrapper"], .eis-grid-wrapper, .ag-theme-alpine'),
      steps: [
        createGuideStep({
          selector: '[data-guide="grid-business-actions"], .toolbar-business-row',
          title: '第 1 步：先看业务筛选和快捷动作',
          description: '这里通常放“全部、紧急、预警、重点、待处理”等业务筛选，以及一键生成异常单、工单等快捷动作。先筛出当前需要处理的数据。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search',
          title: '第 2 步：搜索目标记录',
          description: '输入单号、物料、客户、设备、员工或批次等关键字。搜索前先确认筛选条件，避免漏查。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '.attention-filter, [data-guide="grid-table-tools"], .toolbar-table-extra',
          title: '第 3 步：使用表格筛选和视图工具',
          description: '这里放关注等级筛选、表格视图切换等工具。中小企业现场操作时，建议先看异常和待处理，再看全部。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-sop-action]',
          title: '业务动作：按 SOP 执行联动',
          description: '这里的按钮会生成下游单据或打开处理面板，例如生成 NCR、生成工单、采购下推、生产领料。点击前先确认选中记录和权限。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-create"]',
          title: '操作步骤：新增业务数据',
          description: '需要录入新客户、物料、质检单、设备工单等记录时点这里。新增后从左到右填写关键字段，保存前复核状态、数量、日期和负责人。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-config"]',
          title: '操作步骤：调整表格列',
          description: '字段太多或看不到关键列时点这里。常用列、关注列、状态列、数量列和日期列应优先显示，低频字段可以隐藏。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-recalculate"]',
          title: '操作步骤：重算公式',
          description: '修改基础数据、数量或金额后，如果页面有公式列，使用重算公式刷新结果。处于筛选范围时要先确认是否需要切回全部数据。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-delete"]',
          title: '操作步骤：删除选中数据',
          description: '删除前必须确认已勾选的是正确记录。删除会影响业务追溯，异常单、工单、审批中记录不要随意删除。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-export"]',
          title: '操作步骤：导出复核或留档',
          description: '需要线下复核、对账或留档时导出。导出前先确认当前筛选条件，避免把未筛选的全部数据发给不相关人员。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-actions"], .table-actions',
          title: '第 4 步：理解表格动作区',
          description: '这一排是表格动作区。新增、列管理、重算、删除、导出都在这里，权限不足时按钮会隐藏或不可用。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-body"], .eis-grid-container, .ag-theme-alpine',
          title: '第 5 步：在表格中编辑和复核',
          description: '先确认关注列、状态列和关键字段，再编辑数量、日期、负责人等信息。保存或提交前检查异常提示，避免把错误数据流转到下一环节。',
          side: 'top'
        })
      ]
    },
    ...actionGuides,
    ...appCardGuides,
    {
      id: `sop-${route.path || 'current'}-form`,
      title: `${moduleTitle}表单填写 SOP`,
      description: '按“确认对象 - 填必填项 - 检查风险 - 保存/提交”的顺序完成表单。',
      type: 'sop',
      category: '表单',
      priority: 92,
      when: () => hasGuideElement('[data-guide="form-wrapper"], .el-dialog__body, .el-drawer__body, .eis-document-engine'),
      steps: [
        createGuideStep({
          selector: '[data-guide="form-wrapper"], .el-dialog__body, .el-drawer__body, .eis-document-engine',
          title: '第 1 步：确认正在填写的业务对象',
          description: '先确认当前表单对应的是正确的客户、物料、设备、员工、质检单或工单。对象错误时不要继续保存。',
          side: 'left'
        }),
        createGuideStep({
          selector: '.el-form, [data-guide="form-fields"]',
          title: '第 2 步：从上到下填写必填项',
          description: '优先填写单号、名称、数量、日期、负责人、状态等必填字段。字段不确定时先向主管确认，不要随意填默认值。',
          side: 'right'
        }),
        createGuideStep({
          selector: '.el-form-item.is-error, [data-guide="form-risk"]',
          title: '第 3 步：处理校验和风险提示',
          description: '红色校验、库存不足、质检不合格、设备异常、权限不足等提示必须先处理，再继续提交。',
          side: 'right'
        }),
        createGuideStep({
          selector: '.el-dialog__footer, .el-drawer__footer, [data-guide="form-actions"]',
          title: '第 4 步：保存或提交',
          description: '保存前复核关键字段和附件；提交会进入下一业务环节或审批，提交后不要再口头通知替代系统记录。',
          side: 'top'
        })
      ]
    }
  ]
})

const normalizeExternalGuide = (input) => {
  if (!input || typeof input !== 'object') return null
  const id = String(input.id || '').trim()
  const title = String(input.title || '').trim()
  const steps = Array.isArray(input.steps) ? input.steps : []
  if (!id || !title || !steps.length) return null
  return {
    id,
    title,
    description: String(input.description || ''),
    type: input.type === 'sop' ? 'sop' : 'guide',
    category: String(input.category || ''),
    routes: Array.isArray(input.routes) ? input.routes.map((item) => String(item || '').trim()).filter(Boolean) : [],
    priority: Number(input.priority || 30),
    steps: steps
      .map((step) => {
        const selector = String(step?.selector || step?.element || '').trim()
        if (!selector) return null
        return createGuideStep({
          selector,
          title: String(step?.title || '操作提示'),
          description: String(step?.description || ''),
          side: String(step?.side || 'bottom'),
          align: String(step?.align || 'start')
        })
      })
      .filter(Boolean)
  }
}

const availableGuides = computed(() => {
  guideDomTick.value
  const list = [
    baseGuide.value,
    ...moduleGuideMap.value,
    ...sopGuideMap.value,
    ...customGuides.value
  ]
  const map = new Map()
  list.forEach((guide) => {
    if (!canUseGuide(guide)) return
    map.set(guide.id, guide)
  })
  return Array.from(map.values()).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
})

const recommendedGuide = computed(() => {
  const unseen = availableGuides.value.find((guide) => !hasSeenGuide(guide.id))
  return unseen || availableGuides.value[0] || baseGuide.value
})

const loadGuideProgress = () => {
  try {
    const raw = localStorage.getItem(guideProgressKey.value)
    const parsed = raw ? JSON.parse(raw) : {}
    guideProgress.value = parsed && typeof parsed === 'object' ? parsed : {}
  } catch (e) {
    guideProgress.value = {}
  }
}

const saveGuideProgress = () => {
  try {
    localStorage.setItem(guideProgressKey.value, JSON.stringify(guideProgress.value || {}))
  } catch (e) {}
}

const hasSeenGuide = (guideId) => Boolean(guideProgress.value?.[guideId])

const markGuideSeen = (guideId) => {
  if (!guideId) return
  guideProgress.value = {
    ...(guideProgress.value || {}),
    [guideId]: new Date().toISOString()
  }
  saveGuideProgress()
}

const getVisibleSteps = (guide) => (Array.isArray(guide?.steps) ? guide.steps : [])
  .filter((step) => resolveGuideElement(step.element))

const runGuide = async (guide) => {
  const target = guide || recommendedGuide.value
  if (!target) return
  guideCenterVisible.value = false
  guideWelcomeVisible.value = false
  await nextTick()
  const steps = getVisibleSteps(target)
  if (!steps.length) return
  driver({
    showProgress: true,
    allowClose: true,
    stagePadding: 8,
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '完成',
    closeBtnText: '关闭',
    steps,
    onDestroyed: () => markGuideSeen(target.id)
  }).drive()
}

const runRecommendedGuide = () => {
  runGuide(recommendedGuide.value)
}

const startGuide = () => {
  guideCenterVisible.value = true
}

const resetGuideProgress = () => {
  guideProgress.value = {}
  saveGuideProgress()
}

const shouldShowWelcomeGuide = () => {
  try {
    return localStorage.getItem(guideWelcomeKey.value) !== '1'
  } catch (e) {
    return false
  }
}

const closeWelcomeGuide = () => {
  try {
    localStorage.setItem(guideWelcomeKey.value, '1')
  } catch (e) {}
  guideWelcomeVisible.value = false
}

const skipGuideWelcome = () => {
  closeWelcomeGuide()
}

const startWelcomeGuide = () => {
  closeWelcomeGuide()
  runRecommendedGuide()
}

const maybeOpenWelcomeGuide = () => {
  if (!shouldShowWelcomeGuide()) return
  window.setTimeout(() => {
    if (!shouldShowWelcomeGuide()) return
    if (route.path === '/login') return
    if (!availableGuides.value.length) return
    guideWelcomeVisible.value = true
  }, 700)
}

const handleGuideRegisterEvent = (event) => {
  const guide = normalizeExternalGuide(event?.detail)
  if (!guide) return
  customGuides.value = [
    ...customGuides.value.filter((item) => item.id !== guide.id),
    guide
  ]
}

const handleGuideRegisterMessage = (event) => {
  const data = event?.data || {}
  if (data?.type !== 'eis:register-guide') return
  const guide = normalizeExternalGuide(data?.detail)
  if (!guide) return
  customGuides.value = [
    ...customGuides.value.filter((item) => item.id !== guide.id),
    guide
  ]
}

const HOST_TABS_STORAGE_KEY = 'eis_host_nav_tabs_v1'
const APP_RUNTIME_TITLE_STORAGE_KEY = 'eis_app_runtime_title_map_v1'
const hostOpenTabAliasMap = new Map()
const hostTabs = ref([{ key: '/', path: '/', query: {}, title: '首页', closable: false, dot: 'home', routeId: '/' }])
const activeHostTabKey = ref('/')

const ENTRY_TAB_KEY = '/'
const MODULE_ENTRY_TITLES = {
  '/': '首页',
  '/materials': '仓储管理',
  '/hr': '人事管理',
  '/apps/': '应用中心',
  '/sales': '销售管理',
  '/purchase': '采购管理',
  '/production': '生产管理',
  '/quality': '质量管理',
  '/equipment': '设备管理',
  '/decision': '决策支持'
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
  },
  quality: {
    inspections: '检验台账',
    inspection_orders: '检验单',
    production_inspections: '生产检验',
    ncr: '质量异常',
    actions: '整改任务',
    audits: '质量审核',
    standards: '检验标准',
    dashboard: '质量总览'
  },
  equipment: {
    assets: '设备台账',
    checks: '点检记录',
    equipment_patrols: '设备巡检',
    issues: '设备异常',
    work_orders: '维保工单',
    plans: '巡检计划',
    standards: '保养标准',
    dashboard: '设备总览'
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
  { path: '/purchase/dashboard', title: '采购驾驶舱' },
  { path: '/production/overview', title: '生产总览' },
  { path: '/production/bom', title: '产品配方' },
  { path: '/quality/dashboard', title: '质量总览' },
  { path: '/equipment/dashboard', title: '设备总览' }
]

const normalizeHostPath = (value) => {
  const raw = canonicalizeMicroChainPath(ensureAbsoluteHostPath(value))
  if (raw === '/apps' || raw === '/apps/index.html') return '/apps/'
  if (raw === '/materials/' || raw === '/materials/index.html' || raw === '/materials/apps' || raw === '/materials/apps/') return '/materials'
  if (raw === '/hr/' || raw === '/hr/index.html' || raw === '/hr/apps' || raw === '/hr/apps/') return '/hr'
  if (raw === '/sales/' || raw === '/sales/index.html' || raw === '/sales/apps' || raw === '/sales/apps/') return '/sales'
  if (raw === '/purchase/' || raw === '/purchase/index.html' || raw === '/purchase/apps' || raw === '/purchase/apps/') return '/purchase'
  if (raw === '/production/' || raw === '/production/index.html' || raw === '/production/apps' || raw === '/production/apps/') return '/production'
  if (raw === '/quality/' || raw === '/quality/index.html' || raw === '/quality/apps' || raw === '/quality/apps/') return '/quality'
  if (raw === '/equipment/' || raw === '/equipment/index.html' || raw === '/equipment/apps' || raw === '/equipment/apps/') return '/equipment'
  if (raw === '/decision/' || raw === '/decision/index.html' || raw === '/decision/apps' || raw === '/decision/apps/') return '/decision'
  // Keep full child route for micro-app deep links (e.g. /materials/inventory-stock-in).
  if (raw === '/materials' || raw.startsWith('/materials/')) return raw
  if (raw === '/hr' || raw.startsWith('/hr/')) return raw
  if (raw === '/sales' || raw.startsWith('/sales/')) return raw
  if (raw === '/purchase' || raw.startsWith('/purchase/')) return raw
  if (raw === '/production' || raw.startsWith('/production/')) return raw
  if (raw === '/quality' || raw.startsWith('/quality/')) return raw
  if (raw === '/equipment' || raw.startsWith('/equipment/')) return raw
  if (raw === '/decision' || raw.startsWith('/decision/')) return raw
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
  if (path.startsWith('/quality')) return 'quality'
  if (path.startsWith('/equipment')) return 'equipment'
  if (path.startsWith('/decision')) return 'decision'
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
    path === '/production' ||
    path === '/quality' ||
    path === '/equipment' ||
    path === '/decision'
}

const getModuleAppKeyTitle = (path) => {
  const match = String(path || '').match(/^\/(materials|hr|sales|purchase|production|quality|equipment)\/app\/([^/?#]+)/)
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
    const match = String(path || '').match(/^\/(materials|hr|sales|purchase|production|quality|equipment)\/app\/([^/?#]+)/)
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

const handleMenuSelect = (index) => {
  const path = normalizeHostPath(index)
  if (!path) return
  const currentPath = normalizeHostPath(route.path)
  if (path === currentPath) return
  router.push({ path }).catch(() => {})
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
      .host-tab-dot.dot-quality { background: #0ea5e9; }
      .host-tab-dot.dot-equipment { background: #14b8a6; }

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

    .guide-entry-btn {
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .guide-entry-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
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

:global(.guide-center-popper) {
  padding: 0 !important;
  border-radius: 8px !important;
  overflow: hidden;
}

.guide-center {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.guide-center__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.guide-center__header strong {
  display: block;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.guide-center__header p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.guide-center__actions {
  display: flex;
  gap: 8px;
}

.guide-center__list {
  display: grid;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.guide-card {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 10px;
  text-align: left;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.guide-card:hover {
  border-color: var(--el-color-primary-light-5);
  background: color-mix(in srgb, var(--el-color-primary) 6%, #ffffff);
  transform: translateY(-1px);
}

.guide-card__title {
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.guide-card__desc {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.guide-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.guide-card__tags {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.guide-welcome {
  display: grid;
  gap: 8px;
}

.guide-welcome strong {
  color: var(--el-text-color-primary);
}

.guide-welcome p {
  margin: 0;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}

:global(.driver-popover) {
  border-radius: 8px !important;
}

:global(.driver-popover-title) {
  font-size: 15px !important;
}
</style>
