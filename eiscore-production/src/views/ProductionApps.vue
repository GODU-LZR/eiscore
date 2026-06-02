<template>
  <div class="production-apps">
    <div class="apps-header">
      <div class="header-text">
        <h2>生产应用</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col
        v-for="app in visibleApps"
        :key="app.key"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <router-link :to="app.route" custom v-slot="{ href, navigate }">
          <a class="app-card-link" :href="href" @click="handleNavigate($event, navigate, app)">
            <el-card class="app-card" shadow="hover">
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
          </a>
        </router-link>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, Connection, DataBoard, List, Tickets } from '@element-plus/icons-vue'
import { PRODUCTION_APPS } from '@/utils/production-apps'
import { hasPerm } from '@/utils/permission'

const router = useRouter()
const iconMap = { Calendar, Connection, DataBoard, List, Tickets }

const visibleApps = computed(() => PRODUCTION_APPS.filter((app) => !app.perm || hasPerm(app.perm)))

const openApp = async (app) => {
  if (!app?.route) return
  await router.push(app.route)
}

const handleNavigate = async (event, navigate, app) => {
  if (!app?.route) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (typeof navigate === 'function') {
    navigate(event)
  } else {
    await openApp(app)
  }
  await nextTick()
  if (router.currentRoute.value.path !== app.route) {
    await router.push(app.route)
  }
}
</script>

<style scoped>
.production-apps {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px;
  background: #f5f7fa;
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

.app-card-link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.app-card {
  margin-bottom: 20px;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
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
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.tone-blue { background: #409eff; }
.tone-green { background: #67c23a; }
.tone-orange { background: #e6a23c; }
.tone-dark { background: #111827; }
.tone-slate { background: #475569; }

.app-info {
  min-width: 0;
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
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
}

.app-enter {
  margin-top: 14px;
  font-size: 12px;
  color: #409eff;
}

:global(#app.dark) .production-apps {
  background-color: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .app-name {
  color: #f3f4f6;
}

:global(#app.dark) .header-text p,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-enter {
  color: #cbd5e1;
}

:global(#app.dark) .app-card {
  background-color: #111827;
  border-color: #1f2937;
}
</style>
