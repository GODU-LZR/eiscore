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
        <el-menu-item v-if="canMms" index="/materials" @click="router.push('/materials')">
          <el-icon><Box /></el-icon>
          <template #title>物料管理</template>
        </el-menu-item>
        <el-menu-item v-if="canHr" index="/hr" @click="router.push('/hr')">
          <el-icon><User /></el-icon>
          <template #title>人事管理</template>
        </el-menu-item>
        <el-menu-item v-if="canApps" index="/apps/" @click="router.push('/apps/')">
          <el-icon><Grid /></el-icon>
          <template #title>应用中心</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
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

          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>管理控制台</el-breadcrumb-item>
          </el-breadcrumb>
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
import { House, Box, User, Grid, Expand, Fold, Moon, Sunny, QuestionFilled, ArrowDown } from '@element-plus/icons-vue'
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
  return route.path
})

const canHome = computed(() => hasPerm('module:home'))
const canHr = computed(() => hasPerm('module:hr'))
const canMms = computed(() => hasPerm('module:mms'))
const canApps = computed(() => hasPerm('module:apps') || userStore.userInfo?.role === 'super_admin')

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
      display: flex; align-items: center;

      .collapse-btn {
        margin-right: 15px;
        cursor: pointer;
        display: flex;
        align-items: center;
        &:hover { opacity: 0.7; }
      }
    }
  }

  .layout-main {
    background-color: var(--el-bg-color-page);
    padding: 0;
    position: relative;
    transition: background-color 0.3s;

    #subapp-viewport {
      width: 100%;
      height: 100%;
    }
    .subapp-viewport {
      width: 100%;
      height: 100%;
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
