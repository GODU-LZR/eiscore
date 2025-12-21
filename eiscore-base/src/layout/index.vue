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
import { mix } from '@/utils/theme' // 引入混合函数

const isCollapse = ref(false)
const router = useRouter()
const systemStore = useSystemStore()
const { config } = storeToRefs(systemStore)
const isDark = useDark()
const toggleDark = useToggle(isDark)

// 🟢 核心配置：全景颜色计算
const asideTheme = computed(() => {
  const primaryColor = config.value?.themeColor || '#409EFF'
  
  if (isDark.value) {
    // 【黑夜模式】保持深邃黑
    return {
      menuBg: '#001529',
      menuText: '#fff',
      menuActiveText: primaryColor,
      logoBg: '#002140',
      headerBg: '#001529' // 黑夜模式顶栏也是黑的
    }
  } else {
    // 【白天/全彩模式】
    // 1. 侧边栏：直接用主题色 (如红色)
    // 2. 顶栏：用极淡的主题色 (如淡粉)
    return {
      menuBg: primaryColor, // 🔴 关键修复：直接使用主题色，不再混黑！
      menuText: '#ffffff',  // 背景深色，文字必须白
      menuActiveText: '#ffffff', 
      logoBg: mix(primaryColor, '#000000', 0.1), // Logo稍微深一点点，体现层次
      headerBg: mix(primaryColor, '#ffffff', 0.9) // 顶栏：90%白 + 10%主题色
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
  steps: [
    { element: '.layout-aside', popover: { title: '功能导航', description: '现在侧边栏会完全跟随你的主题色变身！' } }
  ]
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
    border-bottom: 1px solid rgba(0,0,0,0.05); /* 边框变淡，适应彩色顶栏 */
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 20px;
    transition: background-color 0.3s; /* 顶栏也要动画 */
  }
  
  .layout-main {
    background-color: var(--el-bg-color-page);
    padding: 0;
    position: relative;
  }
}

/* 🟢 选中项高亮逻辑 */
:deep(.el-menu-item.is-active) {
  background-color: rgba(255, 255, 255, 0.2) !important; /* 半透明白 */
  border-right: 4px solid #fff;
  font-weight: 700;
}

/* 🟢 全彩模式下的卡片样式微调 */
/* 当不是黑夜模式时，给所有 el-card 加一点点主题色微光 */
.colorful-mode :deep(.el-card) {
  /* 使用我们在 theme.js 里定义的 --bg-tint */
  background-color: var(--bg-tint, #fff) !important; 
  border: 1px solid var(--el-color-primary-light-8);
  transition: background-color 0.3s, border-color 0.3s;
}

/* 页面切换动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>