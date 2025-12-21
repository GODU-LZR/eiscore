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
      <el-header class="layout-header">
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

      <el-main class="layout-main">
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
// 🟢 1. 引入 mix 工具
import { mix } from '@/utils/theme'

const isCollapse = ref(false)
const router = useRouter()
const systemStore = useSystemStore()
const { config } = storeToRefs(systemStore)

const isDark = useDark()
const toggleDark = useToggle(isDark)

// 🟢 2. 升级主题计算逻辑
const asideTheme = computed(() => {
  const primaryColor = config.value?.themeColor || '#409EFF'
  
  // 核心逻辑：
  // 侧边栏背景 = 主题色 + 80% 黑色混合 (生成深色品牌背景)
  // Logo背景 = 主题色 (更亮一点)
  
  if (isDark.value) {
    // 【黑夜模式】保持极致黑
    return {
      menuBg: '#001529',
      menuText: '#fff',
      menuActiveText: primaryColor,
      logoBg: '#002140', 
    }
  } else {
    // 【白天/彩色模式】侧边栏使用品牌深色
    // 如果你想让侧边栏是白色的，可以保留原来的写法。
    // 这里我们按你的需求：让盒子/侧边栏也随主题变化。
    
    // 生成一个很深的品牌色作为背景 (混合 80% 黑色)
    const brandDarkBg = mix(primaryColor, '#000000', 0.8)
    
    return {
      menuBg: brandDarkBg, 
      menuText: '#ffffff', // 深色背景配白字
      menuActiveText: '#ffffff', // 选中也是白字，靠背景高亮区分
      logoBg: primaryColor, // Logo 区域直接用纯主题色，显眼！
    }
  }
})

const handleCommand = (command) => {
  if (command === 'settings') {
    router.push('/settings') 
  } else if (command === 'logout') {
    localStorage.removeItem('auth_token')
    router.push('/login')
  }
}

const driverObj = driver({
  showProgress: true,
  steps: [
    { element: '.layout-aside', popover: { title: '功能导航区', description: '所有的业务模块（如物料、人事）都在这里切换。' } },
    { element: '.layout-header .header-right', popover: { title: '个性化设置', description: '在这里切换暗黑模式，或查看个人信息。' } }
  ]
});

const startGuide = () => {
  driverObj.drive();
}
</script>

<style scoped lang="scss">
.layout-container {
  height: 100vh;
  
  .layout-aside {
    display: flex;
    flex-direction: column;
    box-shadow: 2px 0 6px rgba(0,21,41,0.35);
    z-index: 10;
    transition: background-color 0.3s;
    
    .logo {
      height: 60px;
      line-height: 60px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      overflow: hidden;
      white-space: nowrap;
      letter-spacing: 1px;
      transition: background-color 0.3s, color 0.3s;
    }
    
    .el-menu {
      border-right: none;
    }
  }
  
  .layout-header {
    background-color: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    box-shadow: 0 1px 4px rgba(0,21,41,0.08);
    z-index: 9;
  }
  
  .layout-main {
    background-color: var(--el-bg-color-page);
    padding: 0;
    position: relative;
    overflow-x: hidden;
  }
}

/* 🟢 选中项样式优化：背景变亮一点 */
:deep(.el-menu-item.is-active) {
  // 混合 20% 白色作为选中背景
  background-color: rgba(255, 255, 255, 0.1) !important;
  border-right: 3px solid #fff; // 选中指示器改为白色
  font-weight: 600;
}

.dark :deep(.el-menu-item.is-active) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-right-color: var(--el-color-primary); 
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>