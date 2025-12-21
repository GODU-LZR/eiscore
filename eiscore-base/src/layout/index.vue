<template>
  <el-container class="layout-container">
    <el-aside 
      width="220px" 
      class="layout-aside"
      :style="{ backgroundColor: asideTheme.menuBg }"
    >
      <div 
        class="logo" 
        :style="{ backgroundColor: asideTheme.logoBg, color: asideTheme.menuText }"
      >
        <span v-if="!isCollapse">{{ config?.title || '管理系统' }}</span>
      </div>
      
      <el-menu
        :default-active="$route.path"
        class="el-menu-vertical"
        :background-color="asideTheme.menuBg"
        :text-color="asideTheme.menuText"
        :active-text-color="asideTheme.menuActiveText"
        :router="true"
        style="border-right: none;" 
      >
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/materials">
          <el-icon><Box /></el-icon>
          <span>物料管理</span>
        </el-menu-item>
        <el-menu-item index="/hr">
          <el-icon><User /></el-icon>
          <span>人事管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header 
        class="layout-header"
        :style="{ backgroundColor: asideTheme.headerBg }"
      >
        <div class="header-left">
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
              <span style="margin-left: 8px; font-weight: 500;">Admin</span>
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
             <component :is="Component" />
           </transition>
        </router-view>
        <div id="micro-container"></div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue' 
import { useDark, useToggle } from '@vueuse/core'
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useSystemStore } from '@/stores/system'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router' 
import { mix } from '@/utils/theme' 

const isCollapse = ref(false)
const router = useRouter()
const systemStore = useSystemStore()
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
    // 【全彩模式】
    return {
      menuBg: primaryColor, 
      menuText: '#ffffff',  
      menuActiveText: '#ffffff', 
      logoBg: mix(primaryColor, '#000000', 0.1),
      // 🔴 顶栏加深：改为 0.85 (15% 浓度)，和卡片保持一致，比背景深
      headerBg: mix(primaryColor, '#ffffff', 0.85) 
    }
  }
})

const handleCommand = (command) => {
  if (command === 'settings') { router.push('/settings') }
  else if (command === 'logout') { 
    localStorage.removeItem('auth_token')
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
    transition: background-color 0.3s;
    .logo {
      height: 60px; line-height: 60px; text-align: center;
      font-size: 18px; font-weight: 600; color: white;
      transition: background-color 0.3s;
    }
    .el-menu { border-right: none; }
  }
  
  .layout-header {
    border-bottom: 1px solid rgba(0,0,0,0.05);
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 20px;
    transition: background-color 0.3s; 
  }
  
  .layout-main {
    background-color: var(--el-bg-color-page);
    padding: 0;
    position: relative;
    transition: background-color 0.3s;
  }
  
  /* 🔴 核心样式修改区 */
  .colorful-mode {
    // 1. 整个页面背景变为极淡的微光色 (5% 浓度)
    background-color: var(--page-bg-tint) !important;
  }

  .colorful-mode :deep(.el-card) {
    // 2. 卡片背景变为稍深的颜色 (15% 浓度)
    // 这样卡片会比背景深，形成凸起感
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