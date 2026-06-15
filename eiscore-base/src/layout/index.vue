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
        <el-menu-item v-if="canMms" index="/materials" data-guide="menu-materials" @mouseenter="warmMicroApp('materials')" @focus="warmMicroApp('materials')">
          <el-icon><Box /></el-icon>
          <template #title>仓储管理</template>
        </el-menu-item>
        <el-menu-item v-if="canHr" index="/hr" data-guide="menu-hr" @mouseenter="warmMicroApp('hr')" @focus="warmMicroApp('hr')">
          <el-icon><User /></el-icon>
          <template #title>人事管理</template>
        </el-menu-item>
        <el-menu-item v-if="canApps" index="/apps/" data-guide="menu-apps" @mouseenter="warmMicroApp('apps')" @focus="warmMicroApp('apps')">
          <el-icon><Grid /></el-icon>
          <template #title>应用中心</template>
        </el-menu-item>
        <el-menu-item v-if="canSales" index="/sales" data-guide="menu-sales" @mouseenter="warmMicroApp('sales')" @focus="warmMicroApp('sales')">
          <el-icon><Sell /></el-icon>
          <template #title>销售管理</template>
        </el-menu-item>
        <el-menu-item v-if="canPurchase" index="/purchase" data-guide="menu-purchase" @mouseenter="warmMicroApp('purchase')" @focus="warmMicroApp('purchase')">
          <el-icon><ShoppingCart /></el-icon>
          <template #title>采购管理</template>
        </el-menu-item>
        <el-menu-item v-if="canProduction" index="/production" data-guide="menu-production" @mouseenter="warmMicroApp('production')" @focus="warmMicroApp('production')">
          <el-icon><Tools /></el-icon>
          <template #title>生产管理</template>
        </el-menu-item>
        <el-menu-item v-if="canQuality" index="/quality" data-guide="menu-quality" @mouseenter="warmMicroApp('quality')" @focus="warmMicroApp('quality')">
          <el-icon><CircleCheck /></el-icon>
          <template #title>质量管理</template>
        </el-menu-item>
        <el-menu-item v-if="canEquipment" index="/equipment" data-guide="menu-equipment" @mouseenter="warmMicroApp('equipment')" @focus="warmMicroApp('equipment')">
          <el-icon><Monitor /></el-icon>
          <template #title>设备管理</template>
        </el-menu-item>
        <el-menu-item v-if="canDecision" index="/decision" data-guide="menu-decision" @mouseenter="warmMicroApp('decision')" @focus="warmMicroApp('decision')">
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
            width="440"
            popper-class="guide-center-popper"
            @show="handleGuideCenterShow"
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
              <div class="guide-progress-panel">
                <div class="guide-progress-panel__text">
                  <span>本页 SOP 完成进度</span>
                  <span class="guide-progress-panel__status">
                    <el-tag size="small" :type="guideProgressSyncTagType">{{ guideProgressSyncLabel }}</el-tag>
                    <strong>{{ guideCompletionSummary.completed }}/{{ guideCompletionSummary.total }}</strong>
                  </span>
                </div>
                <el-progress
                  :percentage="guideCompletionSummary.percent"
                  :stroke-width="8"
                  :show-text="false"
                />
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
                      <el-tag v-if="guide.category" size="small" type="info">
                        {{ guide.category }}
                      </el-tag>
                      <el-tag size="small" :type="hasSeenGuide(guide.id) ? 'info' : 'success'">
                        {{ hasSeenGuide(guide.id) ? '已看过' : '推荐' }}
                      </el-tag>
                      <el-tag
                        v-if="guide.type === 'sop'"
                        size="small"
                        :type="isGuideCompleted(guide.id) ? 'success' : 'info'"
                      >
                        {{ isGuideCompleted(guide.id) ? '已完成' : '未完成' }}
                      </el-tag>
                    </span>
                    <span>{{ getGuideVisibleStepCount(guide) }} 步</span>
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
                <el-dropdown-item v-if="isSuperAdmin" command="settings">系统设置</el-dropdown-item>
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
        <div v-if="microAppLoadingVisible" class="module-loading-mask" role="status" aria-live="polite">
          <span class="module-loading-ring"></span>
          <span>{{ microAppLoadingText }}</span>
        </div>
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

import { defineAsyncComponent, ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
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
import { ElMessage } from 'element-plus'
import { House, Box, User, Grid, Sell, ShoppingCart, Tools, CircleCheck, Monitor, DataBoard, Expand, Fold, Moon, Sunny, QuestionFilled, ArrowDown, Close } from '@element-plus/icons-vue'
import { isModuleVisible, useDisplayVisibility } from '@shared/eis-display-control'

const AiCopilot = defineAsyncComponent(() => import('@/components/AiCopilot.vue'))
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
const { visibility: displayVisibility } = useDisplayVisibility()
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
const guideProgressSyncState = ref('local')
const guideDomTick = ref(0)
const microAppLoading = ref(false)
const microAppLoadingVisible = ref(false)
const microAppLoadingText = ref('正在加载')
let guideDomObserver = null
let guideDomRefreshTimer = null
let microAppLoadingShowTimer = null
let microAppLoadingFallbackTimer = null
let microAppLoadingRouteTimer = null
let welcomeGuideTimer = null
let microAppManifestPromise = null
let idleWarmTimer = null
let deferredWarmTimer = null
const warmedMicroApps = new Set()
const warmingMicroApps = new Set()
const MICRO_APP_KEYS = ['materials', 'hr', 'apps', 'sales', 'purchase', 'production', 'quality', 'equipment', 'decision']
const MICRO_APP_ENTRY_PREFIX = {
  materials: '/materials/',
  hr: '/hr/',
  apps: '/apps/',
  sales: '/sales/',
  purchase: '/purchase/',
  production: '/production/',
  quality: '/quality/',
  equipment: '/equipment/',
  decision: '/decision/'
}
const MICRO_APP_WARM_CONCURRENCY = 4
const microAppWarmMode = new Map()
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
const guideProgressSyncLabel = computed(() => {
  if (guideProgressSyncState.value === 'syncing') return '同步中'
  if (guideProgressSyncState.value === 'synced') return '已同步'
  return '本地记录'
})
const guideProgressSyncTagType = computed(() => {
  if (guideProgressSyncState.value === 'syncing') return 'warning'
  if (guideProgressSyncState.value === 'synced') return 'success'
  return 'info'
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

const clearMicroAppLoadingFallback = () => {
  if (microAppLoadingShowTimer) {
    window.clearTimeout(microAppLoadingShowTimer)
    microAppLoadingShowTimer = null
  }
  if (microAppLoadingRouteTimer) {
    window.clearTimeout(microAppLoadingRouteTimer)
    microAppLoadingRouteTimer = null
  }
  if (!microAppLoadingFallbackTimer) return
  window.clearTimeout(microAppLoadingFallbackTimer)
  microAppLoadingFallbackTimer = null
}

const getModuleLoadingTitle = (moduleKey) => {
  const map = {
    materials: '仓储管理',
    hr: '人事管理',
    apps: '应用中心',
    sales: '销售管理',
    purchase: '采购管理',
    production: '生产管理',
    quality: '质量管理',
    equipment: '设备管理',
    decision: '决策支持'
  }
  return map[moduleKey] || '模块'
}

const showMicroAppLoading = (moduleKey = '') => {
  clearMicroAppLoadingFallback()
  microAppLoadingText.value = `正在加载${getModuleLoadingTitle(moduleKey)}`
  microAppLoading.value = true
  microAppLoadingVisible.value = true
  microAppLoadingFallbackTimer = window.setTimeout(() => {
    microAppLoading.value = false
    microAppLoadingVisible.value = false
    microAppLoadingFallbackTimer = null
  }, 8000)
}

const hideMicroAppLoadingSoon = (delay = 120) => {
  if (microAppLoadingRouteTimer) window.clearTimeout(microAppLoadingRouteTimer)
  microAppLoadingRouteTimer = window.setTimeout(() => {
    microAppLoading.value = false
    microAppLoadingVisible.value = false
    clearMicroAppLoadingFallback()
  }, delay)
}

const handleMicroLoading = (event) => {
  const loading = !!event?.detail?.loading
  clearMicroAppLoadingFallback()
  microAppLoading.value = loading
  if (loading) {
    const appName = String(event?.detail?.app || '')
    const moduleKey = appName.replace(/^eiscore-/, '')
    microAppLoadingText.value = `正在加载${getModuleLoadingTitle(moduleKey)}`
    microAppLoadingShowTimer = window.setTimeout(() => {
      microAppLoadingVisible.value = microAppLoading.value
      microAppLoadingShowTimer = null
    }, 60)
    microAppLoadingFallbackTimer = window.setTimeout(() => {
      microAppLoading.value = false
      microAppLoadingVisible.value = false
      microAppLoadingFallbackTimer = null
    }, 8000)
  } else {
    hideMicroAppLoadingSoon(120)
  }
}

const runWhenIdle = (callback, timeout = 1800) => {
  if (typeof window === 'undefined') return
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout })
    return
  }
  window.setTimeout(callback, Math.min(timeout, 1200))
}

const getMicroAppManifest = async () => {
  if (microAppManifestPromise) return microAppManifestPromise
  microAppManifestPromise = fetch(`/asset-manifest.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
  return microAppManifestPromise
}

const sortWarmUrls = (urls) => [...urls].sort((a, b) => {
  const rank = (url) => {
    if (url.endsWith('/index.html')) return 0
    if (/\/assets\/(?:runtime|vue-runtime|index|micro-app|request|utils)-/.test(url)) return 1
    if (/\/assets\/(?:bpmn|maps-canvas|ag-grid)-/.test(url)) return 8
    if (/\/apps\/assets\/AppDashboard-/.test(url)) return 2
    if (/\/(?:materials|hr|sales|purchase|production|quality|equipment|decision)\/assets\/.*(?:AppView|AppGrid|Apps|Dashboard|Cockpit|Overview|Inventory|Home)-/.test(url)) return 2
    if (/\/assets\/element-plus-/.test(url)) return 2
    if (/\/assets\/(?:vendor-misc)-/.test(url)) return 3
    if (/\/apps\/assets\/(?:AppRuntime|DataApp|AppConfigCenter|AppRecordDetail|WorkflowApprovalCenter|FlowDesigner|FlashBuilder|OntologyWorkbench)-/.test(url)) return 6
    if (/\/apps\/assets\/(?:AppCenterGrid|AppRuntime|DataApp|AppConfigCenter|AppRecordDetail|WorkflowApprovalCenter|FlowDesigner|FlashBuilder|OntologyWorkbench)-.*\.css$/.test(url)) return 7
    if (/\/assets\/style-/.test(url) || url.endsWith('.css')) return 4
    if (/\/assets\/(?:charts|documents)-/.test(url)) return 8
    return 5
  }
  const delta = rank(a) - rank(b)
  if (delta) return delta
  return a.localeCompare(b)
})

const pickMicroAppWarmUrls = (moduleKey, manifest) => {
  const prefix = MICRO_APP_ENTRY_PREFIX[moduleKey]
  const urls = Array.isArray(manifest?.urls) ? manifest.urls : []
  if (!prefix) return []
  return sortWarmUrls(urls.filter((url) => url === `${prefix}index.html` || url.startsWith(`${prefix}assets/`)))
}

const moduleKeyFromPath = (path) => {
  const first = String(path || '').split('?')[0].split('#')[0].split('/').filter(Boolean)[0]
  return MICRO_APP_KEYS.includes(first) ? first : ''
}

const warmUrls = async (urls, limit = MICRO_APP_WARM_CONCURRENCY) => {
  let cursor = 0
  const worker = async () => {
    while (cursor < urls.length) {
      const url = urls[cursor]
      cursor += 1
      try {
        await fetch(url, { cache: 'force-cache', credentials: 'same-origin' })
      } catch (e) {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker))
}

const warmMicroApp = async (moduleKey, options = {}) => {
  const key = String(moduleKey || '').trim()
  const full = !!options.full
  if (!key || warmedMicroApps.has(key)) return
  if (warmingMicroApps.has(key)) {
    if (full) microAppWarmMode.set(key, 'full')
    return
  }
  warmingMicroApps.add(key)
  if (full) microAppWarmMode.set(key, 'full')
  try {
    const manifest = await getMicroAppManifest()
    const urls = pickMicroAppWarmUrls(key, manifest)
    if (!urls.length) return
    const initialMaxUrls = full ? urls.length : Math.min(urls.length, key === 'apps' ? 14 : 18)
    await warmUrls(urls.slice(0, initialMaxUrls), full ? 5 : 4)
    if (!full && microAppWarmMode.get(key) === 'full' && initialMaxUrls < urls.length) {
      await warmUrls(urls.slice(initialMaxUrls), 5)
    }
    warmedMicroApps.add(key)
  } finally {
    warmingMicroApps.delete(key)
    microAppWarmMode.delete(key)
  }
}

const scheduleVisibleMicroAppWarmup = () => {
  if (idleWarmTimer) window.clearTimeout(idleWarmTimer)
  if (deferredWarmTimer) window.clearTimeout(deferredWarmTimer)
  idleWarmTimer = window.setTimeout(() => {
    idleWarmTimer = null
    runWhenIdle(async () => {
      const candidates = [
        ['materials', canMms.value],
        ['hr', canHr.value],
        ['apps', canApps.value],
        ['sales', canSales.value],
        ['purchase', canPurchase.value],
        ['production', canProduction.value],
        ['quality', canQuality.value],
        ['equipment', canEquipment.value],
        ['decision', canDecision.value]
      ]
        .filter(([, allowed]) => allowed)
        .map(([key]) => key)

      if (canApps.value) {
        await warmMicroApp('apps')
      } else if (candidates.length) {
        await warmMicroApp(candidates[0])
      }
    }, 3500)
  }, 2200)

  deferredWarmTimer = window.setTimeout(() => {
    deferredWarmTimer = null
    runWhenIdle(async () => {
      const candidates = [
        ['materials', canMms.value],
        ['hr', canHr.value],
        ['apps', canApps.value],
        ['sales', canSales.value],
        ['purchase', canPurchase.value],
        ['production', canProduction.value],
        ['quality', canQuality.value],
        ['equipment', canEquipment.value],
        ['decision', canDecision.value]
      ]
        .filter(([, allowed]) => allowed)
        .map(([key]) => key)

      for (const key of candidates.filter((item) => item !== 'apps').slice(0, 4)) {
        await warmMicroApp(key)
      }
    }, 15000)
  }, 18000)
}

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
    const encodedUsername = encodeURIComponent(username)
    const headers = {
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      Authorization: `Bearer ${token}`
    }
    const urls = [
      `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id,sop_role`,
      `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id`,
      `/api/users?username=eq.${encodedUsername}&select=username,full_name,avatar,role,sop_role`,
      `/api/users?username=eq.${encodedUsername}&select=username,full_name,avatar,role`
    ]
    let row = null
    for (const url of urls) {
      const res = await fetch(url, {
        method: 'GET',
        headers
      })
      if (!res.ok) continue
      const list = await res.json()
      row = Array.isArray(list) ? list[0] : null
      if (row) break
    }
    if (!row) return null
    const sopRole = row.sop_role || row.sopRole || payload.sop_role || payload.sopRole || ''
    return {
      id: row.username || username,
      name: row.full_name || row.username || username,
      username: row.username || username,
      role: payload.app_role || payload.role || row.role || 'user',
      role_id: row.role_id || row.roleId || '',
      dbRole: payload.role || 'web_user',
      permissions: payload.permissions || [],
      avatar: row.avatar || '',
      sop_role: sopRole,
      sopRole
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
  window.addEventListener('eis:micro-loading', handleMicroLoading)
  window.addEventListener('storage', handleUserInfoStorage)
  applyUserTheme()
  loadGuideProgress()
  fetchSopLearningRecords()
  refreshUserInfo()
  ensureSuperAdminScopes()
  scheduleSuperScopeRetry()
  maybeOpenWelcomeGuide()
  scheduleVisibleMicroAppWarmup()
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
  window.removeEventListener('eis:micro-loading', handleMicroLoading)
  window.removeEventListener('storage', handleUserInfoStorage)
  clearMicroAppLoadingFallback()
  if (userInfoPoller) {
    window.clearInterval(userInfoPoller)
    userInfoPoller = null
  }
  if (superScopeRetryTimer) {
    window.clearTimeout(superScopeRetryTimer)
    superScopeRetryTimer = null
  }
  if (welcomeGuideTimer) {
    window.clearTimeout(welcomeGuideTimer)
    welcomeGuideTimer = null
  }
  if (idleWarmTimer) {
    window.clearTimeout(idleWarmTimer)
    idleWarmTimer = null
  }
  if (deferredWarmTimer) {
    window.clearTimeout(deferredWarmTimer)
    deferredWarmTimer = null
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
  fetchSopLearningRecords()
  maybeOpenWelcomeGuide()
  scheduleVisibleMicroAppWarmup()
})

watch(() => route.fullPath, () => {
  scheduleGuideDomRefresh()
  window.setTimeout(scheduleGuideDomRefresh, 500)
  scheduleVisibleMicroAppWarmup()
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

const canShowModule = (moduleKey) => isModuleVisible(displayVisibility.value, moduleKey)
const canHome = computed(() => canShowModule('home') && hasPerm('module:home'))
const canHr = computed(() => canShowModule('hr') && hasPerm('module:hr'))
const canMms = computed(() => canShowModule('materials') && hasPerm('module:mms'))
const isSuperAdmin = computed(() => {
  const info = userStore.userInfo || {}
  const roleValues = [
    info.app_role,
    info.appRole,
    info.role,
    info.role_code,
    info.roleCode,
    info.dbRole,
    info.db_role
  ].map((value) => String(value || '').trim().toLowerCase())
  return roleValues.includes('super_admin') || roleValues.includes('超级管理员')
})
const canSales = computed(() => canShowModule('sales') && (hasPerm('module:sales') || isSuperAdmin.value))
const canPurchase = computed(() => canShowModule('purchase') && (hasPerm('module:purchase') || isSuperAdmin.value))
const canProduction = computed(() => canShowModule('production') && (hasPerm('module:production') || isSuperAdmin.value))
const canQuality = computed(() => canShowModule('quality') && (hasPerm('module:quality') || isSuperAdmin.value))
const canEquipment = computed(() => canShowModule('equipment') && (hasPerm('module:equipment') || isSuperAdmin.value))
const canDecision = computed(() =>
  canShowModule('decision') && (
  hasPerm('module:decision') ||
  hasPerm('module:sales') ||
  hasPerm('module:mms') ||
  hasPerm('module:purchase') ||
  hasPerm('module:production') ||
  hasPerm('module:quality') ||
  hasPerm('module:equipment') ||
  isSuperAdmin.value
  )
)
const hasAnyAppCenterEntryPerm = computed(() => {
  const perms = Array.isArray(userStore.userInfo?.permissions) ? userStore.userInfo.permissions : []
  return perms.some((perm) => typeof perm === 'string' && perm.startsWith('app:app_'))
})
const canApps = computed(() =>
  canShowModule('apps') && (
  hasPerm('module:app') ||
  hasPerm('module:apps') ||
  hasAnyAppCenterEntryPerm.value ||
  isSuperAdmin.value
  )
)

const SOP_ROLE_ALIASES = {
  warehouse: 'warehouse',
  warehouse_keeper: 'warehouse',
  storekeeper: 'warehouse',
  mms: 'warehouse',
  materials: 'warehouse',
  sales: 'sales',
  salesperson: 'sales',
  sale: 'sales',
  purchase: 'purchase',
  procurement: 'purchase',
  buyer: 'purchase',
  production: 'production',
  pmc: 'production',
  production_supervisor: 'production',
  quality: 'quality',
  qc: 'quality',
  qa: 'quality',
  inspector: 'quality',
  equipment: 'equipment',
  maintenance: 'equipment',
  equipment_admin: 'equipment',
  hr: 'hr_admin',
  hr_admin: 'hr_admin',
  human_resource: 'hr_admin',
  manager: 'manager',
  management: 'manager',
  decision: 'manager',
  boss: 'manager'
}

const normalizeSopRole = (value) => {
  const key = String(value || '').trim().toLowerCase()
  return SOP_ROLE_ALIASES[key] || key
}

const currentSopRole = computed(() => normalizeSopRole(
  userStore.userInfo?.sop_role ||
  userStore.userInfo?.sopRole ||
  userStore.userInfo?.job_role ||
  userStore.userInfo?.jobRole ||
  ''
))

const shouldUseRoleTaskGuide = (roleKey, fallbackVisible) => {
  const configuredRole = currentSopRole.value
  if (configuredRole) return configuredRole === roleKey && fallbackVisible
  return fallbackVisible
}

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

const SOP_MODULE_INFO = {
  materials: {
    purpose: '管理物料资料、仓库库位、库存台账、入库、出库和库存预警。',
    focus: '批次、库位、可用数量、出入库来源和库存异常。',
    risk: '物料、批次或库位选错会影响库存准确性和后续生产、销售发货。'
  },
  hr: {
    purpose: '管理员工档案、组织架构、系统账号、权限和考勤调岗记录。',
    focus: '员工身份、部门岗位、账号权限、考勤状态和审批留痕。',
    risk: '人员信息或权限配置错误会造成数据越权、流程找不到处理人。'
  },
  apps: {
    purpose: '管理低代码应用、流程应用、数据应用、闪念应用和审批入口。',
    focus: '应用状态、草稿配置、发布状态、流程绑定和运行权限。',
    risk: '未发布或配置不完整的应用会影响业务人员录入和流程流转。'
  },
  sales: {
    purpose: '管理客户、跟进、商机、销售订单、出货申请和回款记录。',
    focus: '客户状态、订单交期、销售金额、出货进度和回款核销。',
    risk: '订单、交期或回款状态不准确会影响交付计划和财务对账。'
  },
  purchase: {
    purpose: '管理供应商、采购需求、采购订单、到货跟踪和采购驾驶舱。',
    focus: '需求来源、供应商、交期风险、到货数量、IQC结果和入库状态。',
    risk: '采购状态或到货信息错误会影响库存、质检和生产齐套。'
  },
  production: {
    purpose: '管理产品配方、生产建议、生产工单、报工和领料跟进。',
    focus: 'BOM版本、计划数量、工单状态、缺料、领料进度和完工风险。',
    risk: '配方、数量或领料状态错误会造成生产停线、错料或库存不准。'
  },
  quality: {
    purpose: '管理检验、质量异常、NCR、整改任务、审核和检验标准。',
    focus: '待检、不合格、异常严重度、整改期限、验证关闭和标准版本。',
    risk: '不合格未闭环会影响放行、交付、追溯和客户质量风险。'
  },
  equipment: {
    purpose: '管理设备台账、点检、巡检、设备异常、维保工单和保养标准。',
    focus: '运行状态、健康评分、点检异常、停机、维保计划和验收结果。',
    risk: '设备异常未及时处理会影响生产安全、产能和质量稳定性。'
  },
  decision: {
    purpose: '查看跨模块经营态势、业务风险、驾驶舱和管理巡检信息。',
    focus: '销售、采购、生产、质量、设备和库存的异常趋势。',
    risk: '只看汇总不追溯明细，容易遗漏真正阻塞业务的单据。'
  }
}

const SOP_MODULE_WORKFLOW_INFO = {
  materials: {
    sequence: '一般按“先查库存风险，再处理入库/出库，最后回到台账复核”的顺序工作。',
    done: '完成后库存台账、当前库存、批次和来源单据要能互相对应。'
  },
  hr: {
    sequence: '一般按“先确认人员或账号对象，再维护档案/组织/权限，最后检查生效状态”的顺序工作。',
    done: '完成后员工、部门、岗位、账号和角色权限要保持一致。'
  },
  apps: {
    sequence: '一般按“先确认业务场景，再配置应用字段/流程/权限，最后发布并运行验证”的顺序工作。',
    done: '完成后应用应能被目标岗位访问，并能完成真实数据录入或流程流转。'
  },
  sales: {
    sequence: '一般按“先维护客户和商机，再确认订单交付，最后跟踪出货和回款”的顺序工作。',
    done: '完成后订单、出货、采购需求或回款记录要能按单号追溯。'
  },
  purchase: {
    sequence: '一般按“先看采购需求，再生成订单，随后跟踪到货、质检和入库”的顺序工作。',
    done: '完成后需求、订单、到货、质检和入库状态要闭环。'
  },
  production: {
    sequence: '一般按“先确认配方和生产建议，再生成工单，随后跟进领料、报工、质检和入库”的顺序工作。',
    done: '完成后工单状态、领料状态、质检结果和库存变化要能对应。'
  },
  quality: {
    sequence: '一般按“先处理待检，再判定结果，不合格生成 NCR，随后跟进整改和验证关闭”的顺序工作。',
    done: '完成后检验记录、NCR、整改任务、验证结论和证据附件要闭环。'
  },
  equipment: {
    sequence: '一般按“先看运行和点检异常，再登记设备异常，随后生成工单并验收”的顺序工作。',
    done: '完成后异常、工单、维修结果、停机时长和下次保养计划要清楚。'
  },
  decision: {
    sequence: '一般按“先看跨模块异常，再进入来源模块追溯单据，最后确认责任人和处理结果”的顺序工作。',
    done: '完成后管理视图中的异常应能追溯到具体业务单据和责任动作。'
  }
}

const SOP_MODULE_APP_COMPLETE = {
  materials: '处理完成后回到库存台账或库存查询，用物料、批次、仓库和来源单号复核库存变化。',
  hr: '处理完成后回到人员、组织或用户列表，确认员工状态、岗位、账号和权限已经生效。',
  apps: '处理完成后用目标用户角色试运行应用，确认字段、权限、流程和发布状态都正确。',
  sales: '处理完成后用客户、订单号或回款单号搜索，确认下游出货、采购需求或回款状态已经回写。',
  purchase: '处理完成后用需求号、订单号或到货单号复核，确认采购、质检和入库链路没有断点。',
  production: '处理完成后按工单号复核，确认领料、报工、质检、入库或缺料状态已经同步。',
  quality: '处理完成后按检验单号或 NCR 单号复核，确认整改责任、期限、验证结论和附件证据完整。',
  equipment: '处理完成后按设备编号、异常单号或工单号复核，确认维修状态、验收结果和保养计划已更新。',
  decision: '处理完成后返回驾驶舱或来源模块，确认异常数量减少或责任动作已经明确。'
}

const SOP_APP_TITLES = {
  materials: {
    a: '物料',
    'batch-rules': '批次号规则',
    warehouses: '仓库管理',
    'inventory-ledger': '库存台账',
    'inventory-stock-in': '入库',
    'production-stock-in': '生产入库单',
    'inventory-stock-out': '出库',
    'production-picking': '生产领料单',
    'sales-stock-out': '销售出库单',
    'inventory-current': '库存查询',
    'inventory-dashboard': '库存大屏'
  },
  hr: {
    a: '人事花名册',
    org: '部门架构图',
    acl: '权限管理',
    user: '用户管理',
    b: '调岗记录',
    c: '考勤管理'
  },
  apps: {
    config: '配置中心',
    create: '新建应用',
    approval: '审批中心'
  },
  sales: {
    customers: '客户档案',
    follow_ups: '客户跟进',
    opportunities: '销售商机',
    orders: '销售订单',
    shipment_requests: '销售出货申请',
    payments: '回款记录',
    cockpit: '销售驾驶舱'
  },
  purchase: {
    dashboard: '采购驾驶舱',
    suppliers: '供应商档案',
    demands: '采购需求',
    orders: '采购订单',
    arrivals: '到货跟踪'
  },
  production: {
    overview: '生产总览',
    bom: '产品配方',
    process_templates: '工艺模板',
    bom_list: '配方清单',
    plans: '生产建议',
    work_orders: '生产工单',
    work_reports: '订单/工单报工',
    picking_orders: '生产领料单',
    work_order_items: '领料跟进'
  },
  quality: {
    dashboard: '质量总览',
    inspections: '检验台账',
    inspection_orders: '检验单',
    production_inspections: '生产检验',
    ncr: '质量异常',
    actions: '整改任务',
    audits: '质量审核',
    standards: '检验标准'
  },
  equipment: {
    dashboard: '设备总览',
    assets: '设备台账',
    checks: '点检记录',
    equipment_patrols: '设备巡检',
    issues: '设备异常',
    work_orders: '维保工单',
    plans: '巡检计划',
    standards: '保养标准'
  }
}

const DEFAULT_CURRENT_APP_SELECTORS = {
  header: '[data-guide="detail-header"], .view-header, .page-header, [data-guide="grid-toolbar"], [data-guide="subapp-viewport"]',
  primary: '[data-guide="grid-wrapper"], .eis-grid-wrapper, .ag-theme-alpine, [data-guide="document-paper"], .eis-document-paper, .diagram-card, .org-body, [data-guide="subapp-viewport"]',
  actions: '[data-guide="grid-business-actions"], .toolbar-business-row, .header-actions, .side-actions, [data-guide="form-actions"], [data-guide="detail-actions"]',
  secondary: '[data-guide="grid-search"], .toolbar-search, .side-card, .dept-form, [data-guide="form-wrapper"], .el-form, [data-guide="grid-body"]'
}

const SOP_DIRECT_APP_ROUTE_CONTEXTS = [
  { path: '/hr/employee', moduleKey: 'hr', appKey: 'a' },
  {
    path: '/hr/org',
    moduleKey: 'hr',
    appKey: 'org',
    selectors: {
      header: '[data-guide="detail-header"], .org-view .view-header',
      primary: '[data-guide="org-diagram"], .org-body .diagram-card, .org-svg',
      actions: '[data-guide="detail-actions"], .org-view .header-actions, [data-guide="form-actions"], .side-actions',
      secondary: '[data-guide="form-wrapper"], .side-card, [data-guide="form-fields"], .dept-form'
    }
  },
  { path: '/hr/acl', moduleKey: 'hr', appKey: 'acl' },
  { path: '/hr/users', moduleKey: 'hr', appKey: 'user' },
  { path: '/materials/batch-rules', moduleKey: 'materials', appKey: 'batch-rules' },
  { path: '/materials/warehouses', moduleKey: 'materials', appKey: 'warehouses' },
  { path: '/materials/inventory-ledger', moduleKey: 'materials', appKey: 'inventory-ledger' },
  { path: '/materials/inventory-stock-in', moduleKey: 'materials', appKey: 'inventory-stock-in' },
  { path: '/materials/inventory-stock-out', moduleKey: 'materials', appKey: 'inventory-stock-out' },
  { path: '/materials/inventory-current', moduleKey: 'materials', appKey: 'inventory-current' },
  { path: '/materials/inventory-dashboard', moduleKey: 'materials', appKey: 'inventory-dashboard' },
  { path: '/sales/cockpit', moduleKey: 'sales', appKey: 'cockpit' },
  { path: '/purchase/dashboard', moduleKey: 'purchase', appKey: 'dashboard' },
  { path: '/production/overview', moduleKey: 'production', appKey: 'overview' },
  { path: '/production/bom', moduleKey: 'production', appKey: 'bom' },
  { path: '/quality/dashboard', moduleKey: 'quality', appKey: 'dashboard' },
  { path: '/equipment/dashboard', moduleKey: 'equipment', appKey: 'dashboard' }
]

const SOP_APP_FUNCTIONS = {
  materials: {
    a: {
      purpose: '维护物料编码、名称、类别和基础属性。',
      scenario: '新增物料、修改物料资料或核对物料主数据时使用。',
      action: '进入后重点检查物料编码、批次规则、分类和启用状态。'
    },
    'batch-rules': {
      purpose: '配置批次号生成规则。',
      scenario: '需要统一来料、生产、出库批次编码时使用。',
      action: '进入后维护规则前缀、日期段、流水号和适用物料范围。'
    },
    warehouses: {
      purpose: '维护仓库、库区和库位。',
      scenario: '新增库位、调整库区或核对物料存放位置时使用。',
      action: '进入后确认仓库层级、库位编码、状态和责任人。'
    },
    'inventory-ledger': {
      purpose: '查看和追溯入库、出库、调拨等库存流水。',
      scenario: '库存数量异常、需要查来源单据或做批次追溯时使用。',
      action: '进入后按物料、批次、库位和业务类型筛选流水。'
    },
    'inventory-stock-in': {
      purpose: '登记物料入库和批次信息。',
      scenario: '采购到货、生产完工或其他物料需要增加库存时使用。',
      action: '进入后填写物料、批次、库位、数量和来源单据。'
    },
    'production-stock-in': {
      purpose: '处理生产完工后的成品入库。',
      scenario: '生产工单完工，需要把成品入到指定仓库时使用。',
      action: '进入后核对工单、成品、批次、入库数量和库位。'
    },
    'inventory-stock-out': {
      purpose: '登记批次出库并扣减库存。',
      scenario: '领料、发货、退料或其他库存减少场景使用。',
      action: '进入后先确认可用库存，再填写批次、库位、数量和去向。'
    },
    'production-picking': {
      purpose: '按生产工单办理领料出库。',
      scenario: '车间按工单领用原辅料时使用。',
      action: '进入后核对工单用料、缺料数量、领料批次和出库库位。'
    },
    'sales-stock-out': {
      purpose: '按销售发货办理成品出库。',
      scenario: '销售订单需要发货并扣减成品库存时使用。',
      action: '进入后核对销售订单、客户、产品、批次和发货数量。'
    },
    'inventory-current': {
      purpose: '查看当前实时库存汇总。',
      scenario: '确认可用量、找库存不足或核对批次余额时使用。',
      action: '进入后按物料、仓库、批次和预警状态筛选。'
    },
    'inventory-dashboard': {
      purpose: '用大屏方式监控库存态势。',
      scenario: '仓库主管巡检库存风险、低库存和库位状态时使用。',
      action: '进入后先看预警、周转、异常批次和实时滚动明细。'
    }
  },
  hr: {
    a: {
      purpose: '维护员工花名册和基础档案。',
      scenario: '入职、离职、调档或核对员工资料时使用。',
      action: '进入后重点检查姓名、工号、部门、岗位、联系方式和状态。'
    },
    org: {
      purpose: '查看和维护多级部门组织结构。',
      scenario: '调整部门、查看上下级关系或分配成员时使用。',
      action: '进入后确认部门层级、负责人和成员归属。'
    },
    acl: {
      purpose: '配置角色、权限和数据范围。',
      scenario: '新增岗位权限、调整模块访问或排查越权时使用。',
      action: '进入后按角色核对模块权限、操作权限和数据范围。'
    },
    user: {
      purpose: '管理系统用户、角色绑定和 SOP 岗位。',
      scenario: '开通账号、停用账号或配置岗位推荐 SOP 时使用。',
      action: '进入后确认账号状态、绑定角色、员工关系和 SOP 岗位。'
    },
    b: {
      purpose: '记录岗位、部门或职务变动。',
      scenario: '员工调岗、晋升、降级或跨部门变动时使用。',
      action: '进入后填写原岗位、新岗位、生效日期、原因和审批信息。'
    },
    c: {
      purpose: '维护签到签退和出勤台账。',
      scenario: '查看迟到、早退、缺勤、请假或加班情况时使用。',
      action: '进入后按日期、部门、员工和考勤状态筛选处理。'
    }
  },
  apps: {
    config: {
      purpose: '统一管理应用配置、字段、流程和发布状态。',
      scenario: '需要调整低代码应用、完善草稿或发布应用时使用。',
      action: '进入后先选择应用，再检查类型、字段、流程绑定和权限。'
    },
    create: {
      purpose: '创建新的流程、表格或闪念应用。',
      scenario: '现有模块无法覆盖新业务表单或流程时使用。',
      action: '进入后先明确业务对象、字段、权限和后续维护人。'
    },
    approval: {
      purpose: '集中查看流程审批和会签处理状态。',
      scenario: '需要追踪跨应用审批进度或处理待办审批时使用。',
      action: '进入后按流程、发起人、状态和时间筛选待处理事项。'
    }
  },
  sales: {
    customers: {
      purpose: '维护客户资料、等级、负责人和信用信息。',
      scenario: '新增客户、分配负责人或核对应收风险时使用。',
      action: '进入后检查客户状态、联系人、信用额度和应收余额。'
    },
    follow_ups: {
      purpose: '记录客户拜访、沟通纪要和下次行动。',
      scenario: '销售跟进客户、安排回访或沉淀沟通记录时使用。',
      action: '进入后按客户、跟进人、日期和跟进结果筛选。'
    },
    opportunities: {
      purpose: '管理客户需求、预计金额、阶段和成交概率。',
      scenario: '跟踪潜在订单、评估销售漏斗和预测成交时使用。',
      action: '进入后维护阶段、赢率、预计成交日和下一步动作。'
    },
    orders: {
      purpose: '管理销售订单、交付计划、数量和金额。',
      scenario: '接单、排交期、跟踪订单状态或准备发货时使用。',
      action: '进入后核对客户、产品、数量、交期、金额和订单状态。'
    },
    shipment_requests: {
      purpose: '从销售订单推进出货申请。',
      scenario: '订单满足发货条件，需要通知仓储备货出库时使用。',
      action: '进入后确认订单、客户、发货数量和下推出库状态。'
    },
    payments: {
      purpose: '记录订单回款、核销状态和到账信息。',
      scenario: '财务或销售核对客户付款、逾期回款时使用。',
      action: '进入后按客户、订单、金额、到账日期和核销状态筛选。'
    },
    cockpit: {
      purpose: '查看销售指标、漏斗、订单和回款风险。',
      scenario: '销售负责人做每日经营巡检时使用。',
      action: '进入后先看异常订单、交付风险和回款缺口。'
    }
  },
  purchase: {
    dashboard: {
      purpose: '查看采购态势、履约风险和到货节奏。',
      scenario: '采购负责人巡检延期、待到货和供应商风险时使用。',
      action: '进入后先看逾期、临期到货、待检和异常供应商。'
    },
    suppliers: {
      purpose: '维护供应商资料、等级、付款条件和交期。',
      scenario: '新增供应商、评审供应商或暂停供应商时使用。',
      action: '进入后检查供应商状态、联系人、账期、交期和分类。'
    },
    demands: {
      purpose: '管理采购需求、物料、数量和需求日期。',
      scenario: '生产、仓储或业务部门提出采购需求时使用。',
      action: '进入后核对物料、数量、需求日期、申请人和建议供应商。'
    },
    orders: {
      purpose: '管理采购订单、供应商、金额和预计到货。',
      scenario: '采购需求确认后生成订单并跟进履约时使用。',
      action: '进入后关注交期风险、到货状态、订单金额和采购员。'
    },
    arrivals: {
      purpose: '跟踪采购到货、IQC结果、入库单和异常。',
      scenario: '供应商送货后需要质检、收货或入库时使用。',
      action: '进入后核对到货数量、合格数量、检验状态和入库单号。'
    }
  },
  production: {
    overview: {
      purpose: '查看生产建议、工单进度、齐套和缺料风险。',
      scenario: '生产主管每日排产巡检或异常协调时使用。',
      action: '进入后先看待排产、缺料、延期和质量阻塞。'
    },
    bom: {
      purpose: '维护产品生产所需物料和用量关系。',
      scenario: '新增产品、变更配方或排查用料异常时使用。',
      action: '进入后检查父项物料、组件、损耗、版本和生效状态。'
    },
    process_templates: {
      purpose: '维护工艺与配方模板入口。',
      scenario: '需要沉淀标准工艺、复用生产路线时使用。',
      action: '进入后确认模板版本、适用产品和关键工序。'
    },
    bom_list: {
      purpose: '用表格快速维护配方主信息。',
      scenario: '批量查看 BOM 编号、版本、类型和状态时使用。',
      action: '进入后按产品、版本、状态筛选并复核配方完整性。'
    },
    plans: {
      purpose: '根据销售需求和库存生成生产建议。',
      scenario: '需要判断还要生产多少成品时使用。',
      action: '进入后关注销售数量、成品可用量和建议生产量。'
    },
    work_orders: {
      purpose: '把生产建议转成可排产、可跟进的生产任务。',
      scenario: '确认生产计划后安排车间执行时使用。',
      action: '进入后核对产品、BOM版本、计划数量、优先级和状态。'
    },
    work_reports: {
      purpose: '通过工单跟进生产进度和完工信息。',
      scenario: '车间报工、更新进度或确认完工时使用。',
      action: '进入后按工单状态、产品和日期筛选处理。'
    },
    picking_orders: {
      purpose: '进入工单用料清单处理生产领料。',
      scenario: '车间按工单领料或仓库确认缺料时使用。',
      action: '进入后重点看应领、已领、缺料和领料状态。'
    },
    work_order_items: {
      purpose: '跟踪每张工单的组件用料和缺料情况。',
      scenario: '排查齐套、补料、领料进度时使用。',
      action: '进入后按工单、物料、缺料数量和领料状态筛选。'
    }
  },
  quality: {
    dashboard: {
      purpose: '查看待检、合格率、异常和整改闭环。',
      scenario: '质量负责人巡检质量风险和处理优先级时使用。',
      action: '进入后先看待判定、不合格、未关闭 NCR 和逾期整改。'
    },
    inspections: {
      purpose: '记录来料、过程、首件和成品检验结果。',
      scenario: 'IQC、IPQC、FQC 做检验判定和批次追溯时使用。',
      action: '进入后核对来源单号、物料、批次、抽检数、不良数和结果。'
    },
    inspection_orders: {
      purpose: '进入检验台账处理各类检验单。',
      scenario: '收到来料、过程或成品检验任务时使用。',
      action: '进入后先筛选待判定和不合格记录，再补齐检验结果。'
    },
    production_inspections: {
      purpose: '处理生产过程和成品放行检验。',
      scenario: '生产线首件、巡检或成品抽检时使用。',
      action: '进入后关注产线、工单、批次、不良数和处置建议。'
    },
    ncr: {
      purpose: '管理不合格、责任归属、整改和验证关闭。',
      scenario: '检验不合格或客户/过程异常需要闭环时使用。',
      action: '进入后确认严重度、责任部门、整改期限、措施和验证结论。'
    },
    actions: {
      purpose: '跟踪质量异常的纠正、预防和验证任务。',
      scenario: 'NCR 已发起，需要责任人整改或质量验证时使用。',
      action: '进入后关注任务状态、到期日期、责任人和完成证据。'
    },
    audits: {
      purpose: '管理体系、过程、供应商和客户审核。',
      scenario: '计划审核、记录发现项或跟踪审核整改时使用。',
      action: '进入后维护审核范围、计划日期、发现项数、状态和结论。'
    },
    standards: {
      purpose: '维护检验标准、版本、生效日期和关键指标。',
      scenario: '新增品类、标准修订或检验依据不清时使用。',
      action: '进入后确认适用品类、版本、状态、关键指标和附件。'
    }
  },
  equipment: {
    dashboard: {
      purpose: '查看设备运行、点检异常、维保工单和计划达成。',
      scenario: '设备负责人巡检停机、异常和保养风险时使用。',
      action: '进入后先看停机、低健康评分、逾期点检和未完成工单。'
    },
    assets: {
      purpose: '维护设备档案、责任人、运行状态和保养周期。',
      scenario: '新增设备、变更责任人或核对保养日期时使用。',
      action: '进入后检查设备编号、位置、等级、状态、健康评分和下次保养。'
    },
    checks: {
      purpose: '记录班前点检、日常巡检和专项检查结果。',
      scenario: '操作员或设备员做点检并记录异常时使用。',
      action: '进入后核对设备、点检项、异常项、结果、点检人和照片。'
    },
    equipment_patrols: {
      purpose: '进入点检记录处理巡检、班前点检和专项检查。',
      scenario: '现场巡检发现异常或补录点检记录时使用。',
      action: '进入后先筛选异常和待处理点检，再补齐记录和照片。'
    },
    issues: {
      purpose: '登记设备故障、异常来源、责任归属和处理状态。',
      scenario: '点检异常、故障停机或设备隐患需要跟踪时使用。',
      action: '进入后确认设备、异常描述、紧急程度、责任人和处理期限。'
    },
    work_orders: {
      purpose: '跟踪维修派工、停机时长、备件更换和验收。',
      scenario: '设备异常需要维修、保养或验收时使用。',
      action: '进入后关注工单状态、维修人员、计划日期、停机时长和验收结果。'
    },
    plans: {
      purpose: '维护设备巡检、保养和大修计划。',
      scenario: '制定周期保养、专项巡检或年度大修计划时使用。',
      action: '进入后确认设备范围、周期、下次执行、负责人和完成率。'
    },
    standards: {
      purpose: '维护设备点检标准、保养规范和关键项目。',
      scenario: '新增设备类型或修订保养要求时使用。',
      action: '进入后确认适用设备、版本、生效日期、关键项目和附件。'
    }
  }
}

const resolveSopModuleKey = (path = route.path || '/') => {
  if (path.startsWith('/materials')) return 'materials'
  if (path.startsWith('/hr')) return 'hr'
  if (path.startsWith('/apps')) return 'apps'
  if (path.startsWith('/sales')) return 'sales'
  if (path.startsWith('/purchase')) return 'purchase'
  if (path.startsWith('/production')) return 'production'
  if (path.startsWith('/quality')) return 'quality'
  if (path.startsWith('/equipment')) return 'equipment'
  if (path.startsWith('/decision')) return 'decision'
  return ''
}

const currentSopModuleKey = computed(() => resolveSopModuleKey(route.path || '/'))

const currentSopModule = computed(() => {
  const path = route.path || '/'
  const match = Object.keys(MODULE_SOP_TITLES)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  return match ? MODULE_SOP_TITLES[match] : '当前页面'
})

const getCurrentModuleSopInfo = () => SOP_MODULE_INFO[currentSopModuleKey.value] || {
  purpose: '处理当前页面可见的业务数据和操作入口。',
  focus: '当前页面标题、应用卡片、状态、关键数量和可执行动作。',
  risk: '操作前要确认当前模块和业务对象，避免处理错页面。'
}

const getCurrentModuleWorkflowInfo = () => SOP_MODULE_WORKFLOW_INFO[currentSopModuleKey.value] || {
  sequence: '一般按“确认页面 - 选择应用 - 筛选数据 - 执行业务动作 - 复核结果”的顺序工作。',
  done: '完成后要能通过单号、名称或关键字段查回刚处理的记录。'
}

const getCurrentModuleCompleteText = () => SOP_MODULE_APP_COMPLETE[currentSopModuleKey.value] ||
  '处理完成后回到列表或详情页，用单号、名称或关键字段复核保存结果。'

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

const getAppCardFunctionGuide = (card) => {
  const moduleKey = currentSopModuleKey.value
  const key = String(card?.key || '').trim()
  const configured = SOP_APP_FUNCTIONS[moduleKey]?.[key]
  if (configured) return {
    ...configured,
    complete: configured.complete || getCurrentModuleCompleteText()
  }
  const name = card?.name || '当前应用'
  const desc = card?.desc || ''
  if (moduleKey === 'apps') {
    return {
      purpose: desc || `运行或维护“${name}”。`,
      scenario: '需要进入低代码应用、流程应用或配置工作台时使用。',
      action: '进入后根据应用类型完成配置、数据维护、流程处理或运行复核。',
      complete: getCurrentModuleCompleteText()
    }
  }
  return {
    purpose: desc || `处理“${name}”相关业务数据。`,
    scenario: `需要处理${name}相关记录、异常或查询时使用。`,
    action: '进入后按表格 SOP 完成筛选、查找、新增、编辑、保存、导出和结果复核。',
    complete: getCurrentModuleCompleteText()
  }
}

const resolveCurrentAppRouteContext = () => {
  const path = route.path || '/'
  const moduleKey = currentSopModuleKey.value
  const directContext = SOP_DIRECT_APP_ROUTE_CONTEXTS.find((item) => path === item.path || path.startsWith(`${item.path}/`))
  if (directContext) {
    return {
      ...directContext,
      selectors: {
        ...DEFAULT_CURRENT_APP_SELECTORS,
        ...(directContext.selectors || {})
      }
    }
  }

  const appMatch = path.match(/^\/(materials|hr|sales|purchase|production|quality|equipment)\/app\/([^/?#]+)/)
  if (appMatch) {
    return {
      moduleKey: appMatch[1],
      appKey: decodeURIComponent(appMatch[2] || ''),
      selectors: DEFAULT_CURRENT_APP_SELECTORS
    }
  }

  if (moduleKey === 'apps') {
    if (path.startsWith('/apps/config-center')) {
      return { moduleKey: 'apps', appKey: 'config', selectors: DEFAULT_CURRENT_APP_SELECTORS }
    }
    if (path.startsWith('/apps/workflow-approval-center')) {
      return { moduleKey: 'apps', appKey: 'approval', selectors: DEFAULT_CURRENT_APP_SELECTORS }
    }
  }

  return null
}

const buildCurrentAppCardInfo = () => {
  const context = resolveCurrentAppRouteContext()
  if (!context?.moduleKey || !context?.appKey) return null
  const appName = SOP_APP_TITLES[context.moduleKey]?.[context.appKey] || '当前应用'
  const configured = SOP_APP_FUNCTIONS[context.moduleKey]?.[context.appKey]
  const guide = configured
    ? {
      ...configured,
      complete: configured.complete || SOP_MODULE_APP_COMPLETE[context.moduleKey] || getCurrentModuleCompleteText()
    }
    : getAppCardFunctionGuide({ key: context.appKey, name: appName })
  const selectors = {
    ...DEFAULT_CURRENT_APP_SELECTORS,
    ...(context.selectors || {})
  }
  return {
    key: context.appKey,
    moduleKey: context.moduleKey,
    name: appName,
    selector: selectors.primary,
    headerSelector: selectors.header,
    actionsSelector: selectors.actions,
    secondarySelector: selectors.secondary,
    guide
  }
}

const buildModuleFunctionText = () => {
  const info = getCurrentModuleSopInfo()
  const workflow = getCurrentModuleWorkflowInfo()
  return `模块功能：${info.purpose}关注重点：${info.focus}工作顺序：${workflow.sequence}完成标准：${workflow.done}注意：${info.risk}`
}

const buildAppCardFunctionText = (card, guide = getAppCardFunctionGuide(card)) => {
  const purpose = normalizeGuideText(guide.purpose)
  const scenario = normalizeGuideText(guide.scenario)
  const action = normalizeGuideText(guide.action)
  const complete = normalizeGuideText(guide.complete)
  const risk = normalizeGuideText(guide.risk)
  return [
    purpose ? `功能：${purpose}` : '',
    scenario ? `适用：${scenario}` : '',
    action ? `进入后：${action}` : '',
    complete ? `完成后：${complete}` : '',
    risk ? `注意：${risk}` : ''
  ].filter(Boolean).join(' ')
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

const getVisibleSopFlowInfos = () => {
  guideDomTick.value
  const seen = new Set()
  return queryGuideElements('[data-sop-flow]')
    .filter((element) => {
      if (!isGuideElementVisible(element)) return false
      const flow = element.getAttribute('data-sop-flow') || ''
      if (!flow || seen.has(flow)) return false
      seen.add(flow)
      return true
    })
    .map((element, index) => {
      const flow = element.getAttribute('data-sop-flow') || `flow-${index + 1}`
      const title = normalizeGuideText(element.getAttribute('data-sop-flow-title') || element.getAttribute('data-sop-title') || element.textContent || '业务流程')
      const desc = normalizeGuideText(element.getAttribute('data-sop-flow-desc') || element.getAttribute('data-sop-desc') || '')
      const risk = normalizeGuideText(element.getAttribute('data-sop-flow-risk') || element.getAttribute('data-sop-risk') || '')
      const steps = parseSopStepTexts(element.getAttribute('data-sop-flow-steps') || element.getAttribute('data-sop-steps'))
      return {
        flow,
        selector: `[data-sop-flow="${escapeGuideAttr(flow)}"]`,
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

const roleTaskGuideMap = computed(() => {
  const routePath = route.path || '/'
  const inModule = (prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`)
  const canSeeAnyModule = [
    canMms.value,
    canSales.value,
    canPurchase.value,
    canProduction.value,
    canQuality.value,
    canEquipment.value,
    canHr.value,
    canDecision.value
  ].some(Boolean)

  return [
    {
      id: 'role-path-warehouse',
      title: '仓管员每日工作 SOP',
      description: '按“看库存风险 - 处理入库 - 处理出库 - 复核台账 - 留档”的顺序完成仓储日常工作。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/materials', '/'],
      priority: 97,
      when: () => shouldUseRoleTaskGuide('warehouse', canMms.value && (inModule('/materials') || routePath === '/')),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-materials"]',
          title: '第 1 步：进入仓储管理',
          description: '每天先进入仓储管理。优先看库存不足、临期批次、待入库和待出库，不要直接从零散单据开始处理。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"]',
          title: '第 2 步：先看库存风险和待处理应用',
          description: '进入后先找库存台账、库存查询、入库、出库和库存大屏。异常数量、批次、仓库和库位是仓储工作的优先关注点。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 3 步：按卡片状态排序处理',
          description: '优先进入紧急、预警、待处理卡片。入库先核对来源单、批次、仓库和数量；出库先核对可用库存、批次和领用/销售来源。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search, [data-guide="grid-business-actions"], .toolbar-business-row',
          title: '第 4 步：用单号或批次定位记录',
          description: '现场操作时用单号、物料编码、批次号、仓库快速定位。保存或生效库存前，必须复核数量、单位、仓库、库位和批次。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-export"], [data-guide="document-paper"], .eis-document-paper',
          title: '第 5 步：复核库存影响并留档',
          description: '入库/出库完成后回到库存台账或库存查询复核库存变化；需要交接、盘点或对账时导出或打印留档。',
          side: 'bottom'
        })
      ]
    },
    {
      id: 'role-path-sales',
      title: '销售员每日工作 SOP',
      description: '按“看客户/订单 - 处理交付风险 - 下推需求或出货 - 复核回款”的顺序处理销售工作。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/sales', '/'],
      priority: 96,
      when: () => shouldUseRoleTaskGuide('sales', canSales.value && (inModule('/sales') || routePath === '/')),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-sales"]',
          title: '第 1 步：进入销售管理',
          description: '每天先进入销售管理，查看客户、商机、销售订单、出货和回款相关应用。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"]',
          title: '第 2 步：先看订单交付风险',
          description: '优先处理临近交付、库存不足、待下推采购或待出货的订单。客户信息和交付日期是销售工作的主线。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 3 步：进入销售订单或出货应用',
          description: '进入订单后先用紧急、预警、待处理筛选。需要采购补货时下推采购需求，需要发货时下推出货申请或销售出库。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-sop-flow="sales-flow-push"], [data-sop-action="sales-confirm-flow-push"], [data-guide="grid-business-actions"]',
          title: '第 4 步：执行销售下推并复核',
          description: '下推前确认客户、产品、数量、交期和当前订单状态。下推后到采购、出货或仓储应用搜索单号复核结果。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search',
          title: '第 5 步：复核回款和交付状态',
          description: '当天结束前回查未交付、未回款、已取消或异常订单，避免只完成下推但没有确认结果。',
          side: 'bottom'
        })
      ]
    },
    {
      id: 'role-path-purchase',
      title: '采购员每日工作 SOP',
      description: '按“看需求 - 下单 - 跟来到货 - 处理异常 - 复核入库”的顺序完成采购闭环。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/purchase', '/'],
      priority: 96,
      when: () => shouldUseRoleTaskGuide('purchase', canPurchase.value && (inModule('/purchase') || routePath === '/')),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-purchase"]',
          title: '第 1 步：进入采购管理',
          description: '每天先看采购需求、采购订单和到货跟踪。供应商、物料、数量、交期和质检状态是采购工作的关键。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"]',
          title: '第 2 步：先处理待下单和逾期风险',
          description: '先看待下单、临期、逾期、异常到货。不要直接新增订单，先确认是否已有采购需求或销售来源。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 3 步：按需求、订单、到货顺序进入应用',
          description: '需求确认后下推采购订单；订单确认后跟踪到货；到货合格后再下推入库。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-sop-flow="purchase-flow-push"], [data-sop-action="purchase-confirm-flow-push"], [data-guide="grid-business-actions"]',
          title: '第 4 步：按采购流程下推',
          description: '下推前复核供应商、物料、数量、价格、交期、质检状态和仓库信息。已有下游单据时先查看，不要重复生成。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search',
          title: '第 5 步：回到下游应用复核',
          description: '生成订单、到货或入库后，用单号搜索新记录，确认来源、状态、数量和负责人正确。',
          side: 'bottom'
        })
      ]
    },
    {
      id: 'role-path-production',
      title: '生产主管每日工作 SOP',
      description: '按“看计划 - 查缺料 - 处理工单 - 下推质检/入库/出库 - 复核闭环”的顺序管理生产。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/production', '/'],
      priority: 96,
      when: () => shouldUseRoleTaskGuide('production', canProduction.value && (inModule('/production') || routePath === '/')),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-production"]',
          title: '第 1 步：进入生产管理',
          description: '每天先看生产建议、生产工单和领料跟进。交期、缺料、质检和入库是生产主管的主线。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"]',
          title: '第 2 步：先处理紧急工单和缺料',
          description: '优先看紧急、预警、待处理工单。计划数量、完工数量、BOM、缺料数量和交期必须先确认。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 3 步：按计划、工单、领料进入应用',
          description: '生产建议生成工单，工单处理后再下推质量检验或生产入库，领料明细确认后下推仓储出库。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-sop-flow="production-flow-push"], [data-sop-action="production-confirm-flow-push"], [data-guide="grid-business-actions"]',
          title: '第 4 步：执行生产下推',
          description: '下推前确认工单状态、生产数量、完工数量、质检要求、领料数量和库存影响。库存过账仍需仓储补充仓库、库位和批次。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search',
          title: '第 5 步：复核质量、库存和工单状态',
          description: '下推后到质量或仓储应用搜索单号复核。当天结束前检查未完工、缺料和未质检工单。',
          side: 'bottom'
        })
      ]
    },
    {
      id: 'role-path-quality',
      title: '质检员每日工作 SOP',
      description: '按“看待检 - 记录结果 - 不合格生成 NCR - 跟进整改 - 复核关闭”的顺序处理质量工作。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/quality', '/'],
      priority: 96,
      when: () => shouldUseRoleTaskGuide('quality', canQuality.value && (inModule('/quality') || routePath === '/')),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-quality"]',
          title: '第 1 步：进入质量管理',
          description: '每天先看检验台账、检验单、生产检验、质量异常和整改任务。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"]',
          title: '第 2 步：先处理待检和不合格',
          description: '优先处理紧急、预警、待处理检验记录。检验结果、缺陷描述、批次、供应商或生产工单必须填写清楚。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 3 步：进入检验或异常应用',
          description: '检验记录用于录入结果；NCR 用于不合格闭环；整改任务用于跟进责任人和期限。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-sop-flow="quality-ncr-flow"], [data-sop-action="quality-generate-ncr"], [data-guide="grid-business-actions"]',
          title: '第 4 步：不合格一键生成 NCR',
          description: '确认质检结论确实不合格后再生成 NCR。系统会查重并回写来源质检单，生成后跳转质量异常复核。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search',
          title: '第 5 步：跟进整改和关闭',
          description: '当天结束前搜索未关闭 NCR 和整改任务，确认责任部门、整改期限、附件证据和处理状态。',
          side: 'bottom'
        })
      ]
    },
    {
      id: 'role-path-equipment',
      title: '设备员每日工作 SOP',
      description: '按“看点检 - 处理异常 - 生成工单 - 跟进维修 - 复核维保”的顺序管理设备。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/equipment', '/'],
      priority: 96,
      when: () => shouldUseRoleTaskGuide('equipment', canEquipment.value && (inModule('/equipment') || routePath === '/')),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-equipment"]',
          title: '第 1 步：进入设备管理',
          description: '每天先看设备台账、点检记录、设备异常、维保工单和巡检计划。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"]',
          title: '第 2 步：先处理异常和停机风险',
          description: '优先处理紧急、预警、待处理点检记录。设备编号、点检结果、异常项、责任人和计划时间必须明确。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 3 步：进入点检、异常或工单应用',
          description: '点检记录用于发现问题；设备异常用于立案；维保工单用于安排维修和关闭。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-sop-flow="equipment-work-order-flow"], [data-sop-action="equipment-generate-work-order"], [data-guide="grid-business-actions"]',
          title: '第 4 步：点检异常生成工单',
          description: '确认异常确实需要维修闭环后再生成工单。系统会查重并回写异常单号、工单号和生成时间。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search',
          title: '第 5 步：复核维修闭环',
          description: '当天结束前搜索未完成工单，确认维修人员、计划时间、处理结果、附件和设备状态。',
          side: 'bottom'
        })
      ]
    },
    {
      id: 'role-path-hr-admin',
      title: '人事管理员每日工作 SOP',
      description: '按“看人员变动 - 维护档案 - 复核组织和权限 - 留存单据”的顺序处理人事工作。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/hr', '/'],
      priority: 94,
      when: () => shouldUseRoleTaskGuide('hr_admin', canHr.value && (inModule('/hr') || routePath === '/')),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-hr"]',
          title: '第 1 步：进入人事管理',
          description: '每天先看员工档案、组织架构、用户管理和权限相关页面。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"]',
          title: '第 2 步：先处理入转调离和权限风险',
          description: '新增员工、离职、调岗、部门调整和账号权限变更优先处理，避免人员信息和系统权限不一致。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card, [data-guide="grid-wrapper"], .eis-grid-wrapper',
          title: '第 3 步：维护档案或组织信息',
          description: '维护前确认员工姓名、工号、部门、岗位、状态和账号。保存前复核附件和审批记录。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="document-paper"], .eis-document-paper, [data-guide="form-actions"], [data-sop-action="detail-save-doc"]',
          title: '第 4 步：保存单据并复核权限影响',
          description: '人事档案保存后，要确认组织关系、账号状态和权限范围是否同步正确。',
          side: 'bottom'
        })
      ]
    },
    {
      id: 'role-path-manager',
      title: '经营管理者每日巡检 SOP',
      description: '按“看总览 - 看异常 - 追堵点 - 进入责任模块”的顺序做跨模块巡检。',
      type: 'sop',
      category: '岗位任务',
      routes: ['/', '/decision', '/sales', '/purchase', '/production', '/quality', '/equipment', '/materials'],
      priority: 93,
      when: () => shouldUseRoleTaskGuide('manager', canDecision.value || (isSuperAdmin.value && canSeeAnyModule)),
      steps: [
        createGuideStep({
          selector: '[data-guide="menu-decision"], [data-guide="menu-home"]',
          title: '第 1 步：先看经营或工作台总览',
          description: '管理者先看跨模块总览，不要一开始进入单个表格。重点找逾期、缺料、不合格、停机、未交付和未回款。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="subapp-viewport"], [data-guide="layout-main"]',
          title: '第 2 步：定位当前最大风险',
          description: '先判断是销售交付、采购到货、生产缺料、质量异常、设备停机还是库存风险。一个页面只抓 1-2 个最高风险。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="host-tabs"]',
          title: '第 3 步：打开责任模块形成追踪链',
          description: '通过顶部页签保留当前总览，再进入责任模块追踪。不要关闭总览，方便在处理后回看指标是否下降。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="menu-sales"], [data-guide="menu-purchase"], [data-guide="menu-production"], [data-guide="menu-quality"], [data-guide="menu-equipment"], [data-guide="menu-materials"]',
          title: '第 4 步：进入责任模块核实单据',
          description: '进入对应模块后，用异常筛选和单号搜索定位责任记录，确认责任人、期限、状态和下一动作。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search, [data-sop-flow], [data-sop-action]',
          title: '第 5 步：复核处理动作是否闭环',
          description: '只看统计数字不够，要确认下游单据是否生成、状态是否回写、责任人是否明确、附件证据是否存在。',
          side: 'bottom'
        })
      ]
    }
  ]
})

const sopGuideMap = computed(() => {
  guideDomTick.value
  const moduleTitle = currentSopModule.value
  const moduleFunctionText = buildModuleFunctionText()
  const routeId = normalizeGuideId(route.path || 'current')
  const currentApp = buildCurrentAppCardInfo()
  const currentAppGuide = currentApp ? {
    id: `sop-${routeId}-current-app-${normalizeGuideId(currentApp.key)}`,
    title: `${currentApp.name} SOP`,
    description: `了解“${currentApp.name}”功能并按当前页面完成操作闭环。`,
    type: 'sop',
    category: '当前应用',
    priority: 108,
    when: () => hasGuideElement(currentApp.headerSelector) || hasGuideElement(currentApp.selector),
    steps: [
      createGuideStep({
        selector: currentApp.headerSelector,
        title: `第 1 步：确认当前应用是“${currentApp.name}”`,
        description: buildAppCardFunctionText({ key: currentApp.key, name: currentApp.name }, currentApp.guide),
        side: 'bottom'
      }),
      createGuideStep({
        selector: currentApp.selector,
        title: '第 2 步：识别主工作区',
        description: `${currentApp.guide.action || '这里是当前应用的主要业务区域。'} 先确认当前页面对象、筛选范围和可见数据，再开始新增、编辑、拖拽、审批或其他业务处理。`,
        side: 'left'
      }),
      createGuideStep({
        selector: currentApp.secondarySelector,
        title: '第 3 步：填写或筛选关键内容',
        description: '根据当前应用类型处理关键内容：台账先筛选和查找，表单先填必填项，组织/流程页先选中对象，再处理成员、角色、层级、状态或附件。',
        side: 'right'
      }),
      createGuideStep({
        selector: currentApp.actionsSelector,
        title: '第 4 步：执行操作并复核结果',
        description: currentApp.guide.complete || getCurrentModuleCompleteText(),
        side: 'top'
      })
    ]
  } : null
  const appCardGuides = getVisibleAppCardInfos().map((card, index) => {
    const functionGuide = getAppCardFunctionGuide(card)
    const functionText = buildAppCardFunctionText(card, functionGuide)
    return {
      id: `sop-${routeId}-card-${normalizeGuideId(card.key)}`,
      title: `${card.name} SOP`,
      description: functionGuide.purpose || card.desc
        ? `了解“${card.name}”功能并按标准步骤进入处理。`
        : `按标准步骤进入并处理“${card.name}”。`,
      type: 'sop',
      category: '应用卡片',
      priority: 97 - Math.min(index, 20),
      when: () => hasGuideElement(card.selector),
      steps: [
        createGuideStep({
          selector: card.selector,
          title: `第 1 步：了解“${card.name}”功能`,
          description: functionText || `先确认当前卡片是否对应你手头的工作。${card.desc ? `用途：${card.desc}` : '如果不确定，先返回模块入口确认。'}`,
          side: 'right'
        }),
        createGuideStep({
          selector: `${card.selector} [data-guide="app-card-status"], ${card.selector} .app-status`,
          title: '第 2 步：判断处理优先级',
          description: card.status
            ? `当前卡片状态是“${card.status}”。状态不是装饰，它表示当前业务风险：紧急先处理阻塞或超期，预警先处理临期风险，重点用于优先复核关键记录。`
            : '先看卡片状态。紧急表示可能阻塞业务或已经超期，预警表示近期可能出问题，重点表示需要优先复核，正常状态按日常节奏处理。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: `${card.selector} [data-guide="app-card-metrics"], ${card.selector} .app-metrics`,
          title: '第 3 步：读取关键业务数量',
          description: card.metrics
            ? `这里显示关键数量：${card.metrics}。先判断数量代表工作量、风险量还是待处理量；数量异常时，进入后先用紧急、预警、重点或待处理筛选定位数据。`
            : '这里显示当前应用的关键数量。先判断数量代表工作量、风险量还是待处理量；数量异常时，进入后先用紧急、预警、重点或待处理筛选定位数据。',
          side: 'top'
        }),
        createGuideStep({
          selector: `${card.selector} [data-guide="app-card-enter"], ${card.selector} .app-enter, ${card.selector} .app-actions, ${card.selector} .app-card-footer`,
          title: '第 4 步：进入应用并完成闭环',
          description: `${functionGuide.action || '点击进入后，先筛选异常或待处理数据，再搜索目标记录；新增、编辑、删除和导出都要按表格工具栏 SOP 执行。'} ${functionGuide.complete || getCurrentModuleCompleteText()}`,
          side: 'top'
        })
      ]
    }
  })
  const flowGuides = getVisibleSopFlowInfos().map((flow, index) => ({
    id: `sop-${routeId}-flow-${normalizeGuideId(flow.flow)}`,
    title: `${flow.title} SOP`,
    description: flow.desc || `按标准步骤执行“${flow.title}”。`,
    type: 'sop',
    category: '业务流程',
    priority: 94 - Math.min(index, 20),
    when: () => hasGuideElement(flow.selector),
    steps: [
      createGuideStep({
        selector: flow.selector,
        title: `第 1 步：确认“${flow.title}”流程场景`,
        description: flow.desc || '先确认当前流程是否对应手头业务，避免把单据下推到错误模块或错误环节。',
        side: 'left'
      }),
      createGuideStep({
        selector: `${flow.selector} [data-guide="flow-selection"], ${flow.selector} .flow-push-header, [data-guide="flow-selection"]`,
        title: '第 2 步：确认来源单据和下一环节',
        description: '先看已选记录数量、来源单据和下一环节。数量不对、环节不对或当前记录状态不允许流转时，先关闭流程重新选择。',
        side: 'bottom'
      }),
      createGuideStep({
        selector: `${flow.selector} [data-guide="flow-chain"], ${flow.selector} .flow-chain, [data-guide="flow-chain"]`,
        title: '第 3 步：检查上下游单据链路',
        description: '链路中已有下游单据时，优先查看已有结果，不要重复生成。当前节点、上游来源和下游去向必须能对应起来。',
        side: 'bottom'
      }),
      createGuideStep({
        selector: `${flow.selector} [data-guide="flow-risk"], ${flow.selector} .flow-tip, ${flow.selector} .el-alert`,
        title: '第 4 步：阅读风险和限制',
        description: flow.risk || '这里说明当前流程的限制条件，例如不能重复下推、不能越过质检、库存过账仍需仓储补录等。',
        side: 'bottom'
      }),
      ...flow.steps.map((step, stepIndex) => createGuideStep({
        selector: flow.selector,
        title: `流程要点 ${stepIndex + 1}`,
        description: step,
        side: 'bottom'
      })),
      createGuideStep({
        selector: `${flow.selector} [data-guide="flow-confirm"], ${flow.selector} .flow-actions .el-button, [data-guide="flow-confirm"]`,
        title: '第 5 步：确认执行并跳转复核',
        description: '确认前复核单号、数量、状态、负责人和业务条件。点击后应跳转到下游页面或回写当前记录，随后用单号搜索复核结果。',
        side: 'top'
      }),
      createGuideStep({
        selector: '[data-guide="grid-search"], .toolbar-search, [data-guide="document-paper"], .eis-document-paper',
        title: '最后一步：复核生成或回写结果',
        description: flow.risk || '流程完成后搜索新单据或回到当前单据，确认来源、状态、数量、责任人、附件和下游链路都正确。',
        side: 'bottom'
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
        selector: '[data-guide="grid-business-actions"], [data-guide="detail-business-actions"], [data-guide="detail-actions"], .toolbar-business-row, .action-strip, .header-actions',
        title: '第 1 步：先确认当前操作区域',
        description: '如果在表格中操作，先用“紧急、预警、重点、待处理”等筛选按钮缩小范围；如果在详情页操作，先确认当前单据对象和状态。',
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
        selector: '[data-guide="grid-search"], [data-guide="document-paper"], .toolbar-search, .eis-document-paper',
        title: '最后一步：搜索结果并复核',
        description: action.risk || '动作完成后搜索新生成或已关联的单号，或回到当前单据复核状态、来源、数量、责任人和下一环节都正确。',
        side: 'bottom'
      })
    ]
  }))

  return [
    ...(currentAppGuide ? [currentAppGuide] : []),
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
          description: moduleFunctionText,
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="app-card"], .app-card',
          title: '第 2 步：识别应用卡片功能',
          description: '一张卡片就是一个业务应用。先看卡片名称和说明，确认它负责台账、单据、异常、工单、标准、总览、配置或审批中的哪一类工作，再选择与你手头任务一致的卡片。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="app-card-status"], .app-card .app-status',
          title: '第 3 步：先看关注状态',
          description: '状态会提示紧急、预警、重点或正常。紧急优先处理，预警提前处理，重点优先复核；不要只按卡片顺序点进去。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="app-card-metrics"], .app-card .app-metrics',
          title: '第 4 步：再看关键数量',
          description: '这些数量用于判断当前工作量和风险规模。先分清是总量、异常量、待处理量还是完成率；数字异常时，进入应用后先用筛选按钮定位异常数据。',
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
    ...flowGuides,
    ...actionGuides,
    ...appCardGuides,
    {
      id: `sop-${route.path || 'current'}-form`,
      title: `${moduleTitle}表单填写 SOP`,
      description: '按“确认对象 - 填必填项 - 检查风险 - 保存/提交”的顺序完成表单。',
      type: 'sop',
      category: '表单',
      priority: 92,
      when: () => hasGuideElement('[data-guide="form-wrapper"], .el-dialog__body, .el-drawer__body, .form-container, .eis-document-paper'),
      steps: [
        createGuideStep({
          selector: '[data-guide="form-wrapper"], .el-dialog__body, .el-drawer__body, .form-container, .eis-document-paper',
          title: '第 1 步：确认正在填写的业务对象',
          description: '先确认当前表单对应的是正确的客户、物料、设备、员工、质检单或工单。对象错误时不要继续保存。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="form-fields"], .eis-document-paper .doc-body, .el-form',
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
    },
    {
      id: `sop-${route.path || 'current'}-document-detail`,
      title: `${moduleTitle}单据详情 SOP`,
      description: '按“确认单据 - 选择模板 - 填写内容 - 处理附件 - 保存/打印”的顺序维护单据详情。',
      type: 'sop',
      category: '单据',
      priority: 91,
      when: () => hasGuideElement('[data-guide="detail-page"], .detail-page, [data-guide="document-paper"], .eis-document-paper'),
      steps: [
        createGuideStep({
          selector: '[data-guide="detail-header"], .detail-page .page-header',
          title: '第 1 步：确认当前单据页',
          description: '先确认页面标题、返回入口和单据对象。中小企业现场录单时，最常见错误是打开了相似单据后直接修改。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="detail-actions"], .detail-page .header-actions',
          title: '第 2 步：理解顶栏动作',
          description: '这里通常放模板、打印、业务流程和保存。先选模板或查看流程，再填写内容；保存是最后一步，不要提前点击。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="template-select"], .detail-page .header-actions .el-select',
          title: '第 3 步：选择正确表单模板',
          description: '不同应用和业务场景可能使用不同模板。模板不对会导致字段缺失、打印格式不对或附件要求不一致。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="document-paper"], .eis-document-paper',
          title: '第 4 步：填写单据正文',
          description: '从上到下填写核心信息、业务信息和扩展信息。优先处理必填、数量、日期、状态、负责人和业务来源字段。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="document-table-toolbar"], .eis-document-paper .table-toolbar',
          title: '第 5 步：维护明细行',
          description: '有明细表时，新增或删除行前先确认物料、批次、数量、单价、检验项或设备项目，避免把错误明细带到库存、采购、生产或质量环节。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="form-actions"], [data-sop-action="detail-save-doc"], .detail-page .header-actions',
          title: '第 6 步：保存并复核结果',
          description: '保存前复核状态、数量、日期、负责人和附件。保存后重新查看单据状态，确认没有校验错误或遗漏字段。',
          side: 'bottom'
        })
      ]
    },
    {
      id: `sop-${route.path || 'current'}-attachment`,
      title: `${moduleTitle}附件处理 SOP`,
      description: '按“上传 - 检查列表 - 预览 - 删除错误文件 - 回到表单保存”的顺序处理附件。',
      type: 'sop',
      category: '附件',
      priority: 90,
      when: () => hasGuideElement('[data-guide="file-dialog"], .file-dialog-body'),
      steps: [
        createGuideStep({
          selector: '[data-guide="file-dialog"], .file-dialog-body',
          title: '第 1 步：确认附件弹窗',
          description: '附件会跟随当前字段保存。先确认打开的是正确记录、正确附件字段，例如合同、检验报告、设备照片或质量证据。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="file-toolbar"], .file-toolbar',
          title: '第 2 步：上传或清理文件',
          description: '上传前检查文件类型、大小和数量限制。清空会移除当前字段的全部附件，除非确认重传，否则不要随意使用。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="file-list"], .file-list',
          title: '第 3 步：检查附件列表',
          description: '逐个确认文件名、格式和数量。错误附件要及时删除，避免审批、质检、维修或对账时引用错证据。',
          side: 'right'
        }),
        createGuideStep({
          selector: '[data-guide="file-preview"], .file-preview',
          title: '第 4 步：预览关键附件',
          description: '图片、PDF、视频等能预览时要打开核对内容；不能预览的文件请下载查看，再决定是否保留。',
          side: 'left'
        }),
        createGuideStep({
          selector: '[data-guide="form-actions"], [data-sop-action="detail-save-doc"], .detail-page .header-actions',
          title: '第 5 步：回到表单保存',
          description: '附件只在字段值更新后进入表单，最终仍需要保存单据或表格记录，才算完成留档。',
          side: 'bottom'
        })
      ]
    },
    {
      id: `sop-${route.path || 'current'}-flow`,
      title: `${moduleTitle}业务流转 SOP`,
      description: '按“选记录 - 看链路 - 选下一环节 - 确认下推 - 跳转复核”的顺序完成业务流转。',
      type: 'sop',
      category: '业务流转',
      priority: 91,
      when: () => hasGuideElement('[data-guide="flow-wrapper"], .business-flow-dialog'),
      steps: [
        createGuideStep({
          selector: '[data-guide="flow-selection"], .flow-push-header',
          title: '第 1 步：确认已选记录和下一环节',
          description: '先看已选择几条记录，再确认要下推到哪个业务环节。数量不对或下一环节不对时先关闭弹窗重新选择。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="flow-chain"], .flow-chain',
          title: '第 2 步：检查单据链路',
          description: '这里展示上游、当前和下游单据。已有下游单据时优先查看，不要重复生成。',
          side: 'bottom'
        }),
        createGuideStep({
          selector: '[data-guide="flow-confirm"], .flow-actions .el-button',
          title: '第 3 步：确认下推并跳转',
          description: '确认前复核单号、数量、状态、责任人和业务条件。点击后会生成或关联下游单据，并跳转到对应页面查看。',
          side: 'top'
        }),
        createGuideStep({
          selector: '[data-guide="grid-search"], .toolbar-search',
          title: '第 4 步：跳转后搜索并复核结果',
          description: '跳转到下游页面后，用单号搜索新记录，确认状态、来源、数量和下一处理人是否正确。',
          side: 'bottom'
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
    ...roleTaskGuideMap.value,
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

const pickRecommendedGuide = (guides, unseenOnly = false) => {
  const list = Array.isArray(guides) ? guides : []
  const candidates = unseenOnly ? list.filter((guide) => !hasSeenGuide(guide.id)) : list
  if (!candidates.length) return null
  return candidates.find((guide) => guide.category === '当前应用') ||
    candidates.find((guide) => guide.category === '应用卡片' && !String(guide.id || '').includes('-app-cards')) ||
    candidates.find((guide) => guide.type === 'sop') ||
    candidates[0] ||
    null
}

const recommendedGuide = computed(() => {
  return pickRecommendedGuide(availableGuides.value, true) ||
    pickRecommendedGuide(availableGuides.value, false) ||
    baseGuide.value
})

const getGuideVisibleSteps = (guide) => (Array.isArray(guide?.steps) ? guide.steps : [])
  .filter((step) => resolveGuideElement(step.element))

const getGuideVisibleStepCount = (guide) => getGuideVisibleSteps(guide).length || guide?.steps?.length || 0

const shortenGuideDescription = (value, maxLength = 180) => {
  const text = normalizeGuideText(value)
  if (text.length <= maxLength) return text
  const sentenceEnd = text.slice(0, maxLength).search(/[。；;.!?？]/)
  if (sentenceEnd >= 36) return text.slice(0, sentenceEnd + 1)
  return `${text.slice(0, maxLength).trim()}...`
}

const compactGuideSteps = (steps) => steps.map((step) => ({
  ...step,
  popover: {
    ...(step.popover || {}),
    description: shortenGuideDescription(step.popover?.description || '')
  }
}))

const normalizeGuideProgressEntry = (entry) => {
  if (!entry) return null
  if (typeof entry === 'string') {
    return { seenAt: entry, completedAt: '' }
  }
  if (typeof entry === 'object') {
    return {
      seenAt: String(entry.seenAt || entry.seen_at || entry.viewedAt || ''),
      completedAt: String(entry.completedAt || entry.completed_at || '')
    }
  }
  return null
}

const loadGuideProgress = () => {
  try {
    const raw = localStorage.getItem(guideProgressKey.value)
    const parsed = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object') {
      guideProgress.value = {}
      return
    }
    guideProgress.value = Object.fromEntries(
      Object.entries(parsed)
        .map(([key, entry]) => [key, normalizeGuideProgressEntry(entry)])
        .filter(([, entry]) => entry)
    )
  } catch (e) {
    guideProgress.value = {}
  }
}

const mergeGuideProgress = (incoming = {}) => {
  const normalized = Object.fromEntries(
    Object.entries(incoming)
      .map(([key, entry]) => [key, normalizeGuideProgressEntry(entry)])
      .filter(([, entry]) => entry)
  )
  guideProgress.value = {
    ...(guideProgress.value || {}),
    ...normalized
  }
  saveGuideProgress()
}

const fetchSopLearningRecords = async () => {
  const username = userStore.userInfo?.username || userStore.userInfo?.id || ''
  if (!username) return
  guideProgressSyncState.value = 'syncing'
  try {
    const encodedUsername = encodeURIComponent(username)
    const res = await fetch(`/api/sop_learning_records?username=eq.${encodedUsername}&select=guide_id,seen_at,completed_at,status&limit=500`, {
      method: 'GET',
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        ...getAuthHeader()
      }
    })
    if (!res.ok) {
      guideProgressSyncState.value = 'local'
      return
    }
    const rows = await res.json()
    const incoming = {}
    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        if (!row?.guide_id) return
        incoming[row.guide_id] = {
          seenAt: row.seen_at || row.completed_at || '',
          completedAt: row.completed_at || ''
        }
      })
    }
    mergeGuideProgress(incoming)
    guideProgressSyncState.value = 'synced'
  } catch (e) {
    guideProgressSyncState.value = 'local'
  }
}

const saveGuideProgress = () => {
  try {
    localStorage.setItem(guideProgressKey.value, JSON.stringify(guideProgress.value || {}))
  } catch (e) {}
}

const getGuideProgressEntry = (guideId) => normalizeGuideProgressEntry(guideProgress.value?.[guideId])

const hasSeenGuide = (guideId) => Boolean(getGuideProgressEntry(guideId)?.seenAt)

const isGuideCompleted = (guideId) => Boolean(getGuideProgressEntry(guideId)?.completedAt)

const buildSopLearningRecord = (guide, entry) => {
  if (!guide?.id || guide.type !== 'sop') return null
  const username = userStore.userInfo?.username || userStore.userInfo?.id || ''
  if (!username) return null
  return {
    username,
    guide_id: guide.id,
    guide_title: guide.title || '',
    guide_category: guide.category || '',
    sop_role: currentSopRole.value || '',
    module_name: currentSopModule.value || '',
    route_path: route.path || '/',
    step_count: getGuideVisibleStepCount(guide),
    seen_at: entry?.seenAt || null,
    completed_at: entry?.completedAt || null,
    status: entry?.completedAt ? 'completed' : 'seen',
    updated_at: new Date().toISOString()
  }
}

const syncSopLearningRecord = async (guideId) => {
  const guide = availableGuides.value.find((item) => item.id === guideId)
  const entry = getGuideProgressEntry(guideId)
  const record = buildSopLearningRecord(guide, entry)
  if (!record) return
  guideProgressSyncState.value = 'syncing'
  try {
    const res = await fetch('/api/sop_learning_records?on_conflict=username,guide_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        Prefer: 'resolution=merge-duplicates',
        ...getAuthHeader()
      },
      body: JSON.stringify(record)
    })
    guideProgressSyncState.value = res.ok ? 'synced' : 'local'
  } catch (e) {
    guideProgressSyncState.value = 'local'
  }
}

const markGuideSeen = (guideId) => {
  if (!guideId) return
  const entry = getGuideProgressEntry(guideId) || {}
  guideProgress.value = {
    ...(guideProgress.value || {}),
    [guideId]: {
      ...entry,
      seenAt: entry.seenAt || new Date().toISOString()
    }
  }
  saveGuideProgress()
  syncSopLearningRecord(guideId)
}

const markGuideCompleted = (guideId) => {
  if (!guideId) return
  const now = new Date().toISOString()
  const entry = getGuideProgressEntry(guideId) || {}
  guideProgress.value = {
    ...(guideProgress.value || {}),
    [guideId]: {
      ...entry,
      seenAt: entry.seenAt || now,
      completedAt: now
    }
  }
  saveGuideProgress()
  syncSopLearningRecord(guideId)
}

const clearGuideCompleted = (guideId) => {
  if (!guideId) return
  const entry = getGuideProgressEntry(guideId)
  if (!entry) return
  guideProgress.value = {
    ...(guideProgress.value || {}),
    [guideId]: {
      ...entry,
      completedAt: ''
    }
  }
  saveGuideProgress()
  syncSopLearningRecord(guideId)
}

const toggleGuideCompleted = (guide) => {
  if (!guide?.id) return
  if (isGuideCompleted(guide.id)) {
    clearGuideCompleted(guide.id)
    ElMessage.info('已改为未完成，可重新学习')
    return
  }
  markGuideCompleted(guide.id)
  ElMessage.success('已记录 SOP 完成')
}

const guideCompletionSummary = computed(() => {
  const sopGuides = availableGuides.value.filter((guide) => guide.type === 'sop')
  const total = sopGuides.length
  const completed = sopGuides.filter((guide) => isGuideCompleted(guide.id)).length
  const percent = total ? Math.round((completed / total) * 100) : 0
  return { total, completed, percent }
})

const getVisibleSteps = (guide) => getGuideVisibleSteps(guide)

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
    popoverClass: 'eis-sop-driver-popover',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '完成',
    closeBtnText: '关闭',
    steps: compactGuideSteps(steps),
    onDestroyed: () => {
      markGuideSeen(target.id)
      if (target.type === 'sop') markGuideCompleted(target.id)
    }
  }).drive()
}

const runRecommendedGuide = () => {
  runGuide(recommendedGuide.value)
}

const startGuide = () => {
  guideCenterVisible.value = true
}

const handleGuideCenterShow = () => {
  refreshGuideDom()
  fetchSopLearningRecords()
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
  // Keep navigation non-blocking. Users can open SOP guidance from the help entry.
  return
  if (!shouldShowWelcomeGuide()) return
  if (welcomeGuideTimer) window.clearTimeout(welcomeGuideTimer)
  welcomeGuideTimer = window.setTimeout(() => {
    welcomeGuideTimer = null
    if (!shouldShowWelcomeGuide()) return
    if (route.path === '/login') return
    if (!availableGuides.value.length) return
    runWhenIdle(() => {
      if (!shouldShowWelcomeGuide()) return
      if (route.path === '/login') return
      guideWelcomeVisible.value = true
    }, 7000)
  }, 6000)
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
  const moduleKey = moduleKeyFromPath(path)
  if (moduleKey) {
    showMicroAppLoading(moduleKey)
    warmMicroApp(moduleKey)
  }
  const currentPath = normalizeHostPath(route.path)
  if (path === currentPath) {
    hideMicroAppLoadingSoon(300)
    return
  }
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
  if (command === 'settings') {
    if (isSuperAdmin.value) router.push('/settings')
  }
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
        border-color: rgba(var(--el-color-primary-rgb), 0.45);
        box-shadow: 0 6px 14px rgba(var(--el-color-primary-rgb), 0.14);
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
      .host-tab-dot.dot-materials { background: var(--el-color-primary); }
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

  .module-loading-mask {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(245, 247, 251, 0.72);
    color: var(--el-color-primary);
    font-size: 14px;
    font-weight: 700;
    cursor: wait;
    pointer-events: auto;
    backdrop-filter: blur(2px);
  }

  .module-loading-ring {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid rgba(var(--el-color-primary-rgb), 0.18);
    border-top-color: var(--el-color-primary);
    animation: module-loading-spin 0.9s linear infinite;
  }

  @keyframes module-loading-spin {
    to { transform: rotate(360deg); }
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

.guide-progress-panel {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}

.guide-progress-panel__text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.guide-progress-panel__text strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.guide-progress-panel__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.guide-center__list {
  display: grid;
  gap: 8px;
  max-height: 300px;
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

:global(.driver-popover.eis-sop-driver-popover) {
  max-width: min(380px, calc(100vw - 32px)) !important;
  max-height: calc(100vh - 48px) !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
}

:global(.driver-popover-title) {
  font-size: 15px !important;
}

:global(.driver-popover.eis-sop-driver-popover .driver-popover-description) {
  max-height: 30vh !important;
  overflow-y: auto !important;
  padding-right: 4px !important;
  line-height: 1.6 !important;
}

:global(.driver-popover.eis-sop-driver-popover .driver-popover-footer) {
  flex-shrink: 0 !important;
  padding-top: 10px !important;
}

:global(.driver-popover.eis-sop-driver-popover .driver-popover-progress-text) {
  white-space: nowrap !important;
}
</style>
