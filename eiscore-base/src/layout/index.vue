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
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>
        <el-menu-item index="/materials" @click.native.prevent="router.push('/materials')">
          <el-icon><Box /></el-icon>
          <template #title>物料管理</template>
        </el-menu-item>
        <el-menu-item index="/hr" @click.native.prevent="router.push('/hr')">
          <el-icon><User /></el-icon>
          <template #title>人事管理</template>
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
              <el-avatar :size="32" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
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
import { ref, computed } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { mix } from '@/utils/theme'
import { House, Box, User, Expand, Fold, Moon, Sunny, QuestionFilled, ArrowDown } from '@element-plus/icons-vue'
import AiCopilot from '@/components/AiCopilot.vue'

const isCollapse = ref(false)
const router = useRouter()
const route = useRoute()
const systemStore = useSystemStore()
const userStore = useUserStore()
const { config } = storeToRefs(systemStore)
const isDark = useDark()
const toggleDark = useToggle(isDark)

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

const activeMenu = computed(() => {
  if (route.path.startsWith('/materials')) return '/materials'
  if (route.path.startsWith('/hr')) return '/hr'
  return route.path
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
