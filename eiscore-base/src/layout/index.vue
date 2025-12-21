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

const isCollapse = ref(false)
const router = useRouter()
const systemStore = useSystemStore()
// 使用 storeToRefs 保持响应性
const { config } = storeToRefs(systemStore)

// --- 暗黑模式核心 ---
const isDark = useDark()
const toggleDark = useToggle(isDark)

// --- 侧边栏主题配置 (修复：让选中颜色跟随系统主题色) ---
const asideTheme = computed(() => {
  // 获取当前设定的主题色，如果没有就用默认蓝
  const primaryColor = config.value?.themeColor || '#409EFF'
  
  return isDark.value ? {
    // [黑夜模式]
    menuBg: '#001529',
    menuText: '#fff',
    menuActiveText: primaryColor, // 跟随主题色
    logoBg: '#002140', 
  } : {
    // [白天模式]
    menuBg: '#ffffff',
    menuText: '#303133', 
    menuActiveText: primaryColor, // 跟随主题色
    logoBg: '#ffffff',
  }
}) // <--- 注意这里必须有括号

// --- 处理下拉菜单点击 ---
const handleCommand = (command) => {
  if (command === 'settings') {
    router.push('/settings') 
  } else if (command === 'logout') {
    console.log('执行退出登录逻辑...')
    localStorage.removeItem('auth_token')
    router.push('/login')
  }
}

// --- 用户指引 ---
const driverObj = driver({
  showProgress: true,
  steps: [
    { 
      element: '.layout-aside', 
      popover: { title: '功能导航区', description: '所有的业务模块（如物料、人事）都在这里切换。' } 
    },
    { 
      element: '.layout-header .header-right', 
      popover: { title: '个性化设置', description: '在这里切换暗黑模式，或查看个人信息。' } 
    }
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
    /* 删除了硬编码的背景色，由 JS 动态控制 */
    display: flex;
    flex-direction: column;
    box-shadow: 2px 0 6px rgba(0,21,41,0.35);
    z-index: 10;
    transition: background-color 0.3s; /* 平滑过渡 */
    
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
    background-color: var(--el-bg-color); /* Element Plus 自带变量，会自动随暗黑模式变 */
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

/* 🟢 新增：强制覆盖 Element Plus 菜单选中样式 (增加背景高亮) */
:deep(.el-menu-item.is-active) {
  background-color: var(--el-color-primary-light-9) !important;
  border-right: 3px solid var(--el-color-primary);
}

.dark :deep(.el-menu-item.is-active) {
  background-color: rgba(255, 255, 255, 0.05) !important; 
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>