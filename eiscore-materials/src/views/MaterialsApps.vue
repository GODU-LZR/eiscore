<template>
  <div class="materials-apps">
    <div class="apps-header">
      <div class="header-text">
        <h2>物料应用</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col
        v-for="app in apps"
        :key="app.key"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <el-card class="app-card" shadow="hover" @click="openApp(app)">
          <div class="app-card-body">
            <div class="app-icon" :class="`tone-${app.tone}`">
              <el-icon size="20">
                <component :is="iconMap[app.icon]" />
              </el-icon>
            </div>
            <div class="app-info">
              <div class="app-name">{{ app.name }}</div>
              <div class="app-desc">{{ app.desc }}</div>
            </div>
          </div>
          <div class="app-enter">进入</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { Box } from '@element-plus/icons-vue'
import { MATERIAL_APPS } from '@/utils/material-apps'

const router = useRouter()
const apps = MATERIAL_APPS
const iconMap = { Box }

const openApp = (app) => {
  if (!app?.route) return
  router.push(app.route)
}
</script>

<style scoped>
.materials-apps {
  padding: 20px;
  min-height: 100vh;
  box-sizing: border-box;
}

.apps-header {
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

.app-card {
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 20px;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
}

.app-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.tone-blue { background: #409eff; }
.tone-orange { background: #e6a23c; }
.tone-green { background: #67c23a; }

.app-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.app-desc {
  font-size: 12px;
  color: #909399;
}

.app-enter {
  margin-top: 14px;
  font-size: 12px;
  color: #409eff;
}
</style>
