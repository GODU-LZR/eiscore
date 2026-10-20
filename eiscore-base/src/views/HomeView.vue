<template>
  <div class="home-view" :data-workbench-mode="activeMode">
    <header class="home-header">
      <div class="header-left">
        <el-icon class="header-icon" :size="21"><Grid /></el-icon>
        <div>
          <strong class="header-title">{{ activeMode === 'flow' ? '业务工作台' : 'DeepSeek Harness' }}</strong>
          <span class="header-subtitle">惠众消防集团</span>
        </div>
      </div>
      <div class="workbench-switch" role="tablist" aria-label="工作台视图切换">
        <button
          type="button"
          class="workbench-switch__button"
          :class="{ 'is-active': activeMode === 'flow' }"
          role="tab"
          :aria-selected="activeMode === 'flow'"
          aria-controls="huizhong-business-flow"
          @click="switchMode('flow')"
        >
          <el-icon aria-hidden="true"><Share /></el-icon>
          <span>业务流程</span>
        </button>
        <button
          type="button"
          class="workbench-switch__button"
          :class="{ 'is-active': activeMode === 'harness' }"
          role="tab"
          :aria-selected="activeMode === 'harness'"
          aria-controls="deepseek-harness-panel"
          @click="switchMode('harness')"
        >
          <el-icon aria-hidden="true"><Service /></el-icon>
          <span>DeepSeek Harness</span>
        </button>
      </div>
    </header>

    <section
      id="huizhong-business-flow"
      v-show="activeMode === 'flow'"
      class="overview-panel"
      aria-label="惠众版工作台"
    >
      <div class="overview-summary">
        <div>
          <p class="overview-kicker">惠众版工作台</p>
          <h1>业务工作台</h1>
          <p class="overview-description">按销售流程办理业务，进入销售、物料、人事与应用中心。</p>
        </div>
        <div class="overview-date">
          <span>当前账号</span>
          <strong>{{ userStore.userInfo?.username || '当前用户' }}</strong>
        </div>
      </div>

      <BusinessFlowMap class="overview-flow" @navigate="router.push($event)" />

      <div class="overview-section-heading">
        <div>
          <h2>模块入口</h2>
          <span>按业务职责选择工作区</span>
        </div>
        <span class="overview-section-count">{{ moduleCards.length }} 个模块</span>
      </div>

      <div class="module-grid">
        <button
          v-for="module in moduleCards"
          :key="module.key"
          type="button"
          class="module-card"
          @click="openModule(module)"
        >
          <span class="module-card-icon" :class="`module-card-icon--${module.tone}`">
            <el-icon><component :is="module.icon" /></el-icon>
          </span>
          <span class="module-card-copy">
            <strong>{{ module.label }}</strong>
            <span>{{ module.desc }}</span>
            <em>{{ module.action }}</em>
          </span>
          <el-icon class="module-card-arrow"><ArrowRight /></el-icon>
        </button>
      </div>
    </section>

    <section
      id="deepseek-harness-panel"
      v-show="activeMode === 'harness'"
      class="harness-panel"
      aria-label="DeepSeek Harness"
    >
      <HarnessWorkspaceSlot :active="activeMode === 'harness'" />
    </section>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import BusinessFlowMap from '@/components/business-flow/BusinessFlowMap.vue'
import HarnessWorkspaceSlot from '@/components/harness/HarnessWorkspaceSlot.vue'
import { ArrowRight, Box, Grid, Service, Share, ShoppingCart, User } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const DEFAULT_WORKBENCH_MODE = 'flow'
const activeMode = ref(DEFAULT_WORKBENCH_MODE)
const switchMode = (mode) => {
  if (mode !== 'flow' && mode !== 'harness') return
  activeMode.value = mode
}

const moduleCards = [
  {
    key: 'apps',
    label: '应用中心',
    desc: '统一管理业务应用入口',
    action: '打开应用中心',
    path: '/apps/',
    icon: Grid,
    tone: 'amber'
  },
  {
    key: 'sales',
    label: '销售',
    desc: '客户、机会与销售驾驶舱',
    action: '打开销售管理',
    path: '/sales/cockpit',
    icon: ShoppingCart,
    tone: 'purple'
  },
  {
    key: 'materials',
    label: '物料',
    desc: '物料、库存与出入库',
    action: '打开物料管理',
    path: '/materials/inventory-dashboard',
    icon: Box,
    tone: 'teal'
  },
  {
    key: 'hr',
    label: '人事',
    desc: '员工、组织与考勤',
    action: '打开人事管理',
    path: '/hr/employee',
    icon: User,
    tone: 'slate'
  }
]

const openModule = (module) => {
  if (module.path) router.push(module.path)
}
</script>

<style scoped lang="scss">
.home-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.home-header {
  min-height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 18px;
  border-bottom: 1px solid #d9e0e7;
  background: #fff;
}

.workbench-switch {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: stretch;
  gap: 3px;
  min-height: 38px;
  padding: 3px;
  border: 1px solid #d4dde6;
  border-radius: 7px;
  background: #f4f7fa;
}

.workbench-switch__button {
  display: inline-flex;
  min-width: 118px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #5c6b79;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  transition: background-color .16s ease, border-color .16s ease, color .16s ease, box-shadow .16s ease;
}

.workbench-switch__button:hover {
  border-color: #b6c6d4;
  color: #263b4b;
}

.workbench-switch__button.is-active {
  border-color: #2f6f9f;
  background: #fff;
  color: #245c86;
  box-shadow: 0 2px 5px rgba(37, 73, 101, .12);
}

.workbench-switch__button:focus-visible {
  outline: 2px solid #2f6f9f;
  outline-offset: 2px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-icon { color: #2f6f9f; }

.header-title,
.header-subtitle {
  display: block;
  white-space: nowrap;
}

.header-title {
  color: #253342;
  font-size: 15px;
  line-height: 1.35;
}

.header-subtitle {
  margin-top: 1px;
  color: #7a8794;
  font-size: 12px;
}

.overview-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: clamp(22px, 4vw, 48px) clamp(18px, 5vw, 64px) 48px;
  background: #f3f5f7;
  color: #1f2937;
}

.harness-panel {
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #f3f5f7;
}

.overview-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #d8dee6;
}

.overview-kicker {
  margin: 0 0 8px;
  color: #526273;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .04em;
}

.overview-summary h1 {
  margin: 0;
  color: #17212b;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.2;
  letter-spacing: 0;
}

.overview-description {
  max-width: 640px;
  margin: 10px 0 0;
  color: #647282;
  font-size: 14px;
  line-height: 1.6;
}

.overview-date {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 150px;
  padding: 12px 14px;
  border-left: 3px solid #2f6f9f;
  background: #fff;
  color: #6a7785;
  font-size: 12px;
}

.overview-date strong {
  overflow: hidden;
  color: #253342;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-flow { margin: 22px 0 30px; }

.overview-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.overview-section-heading h2 {
  margin: 0 0 4px;
  color: #253342;
  font-size: 17px;
  font-weight: 650;
}

.overview-section-heading span {
  color: #728091;
  font-size: 12px;
}

.overview-section-count { white-space: nowrap; }

.module-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.module-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  min-height: 128px;
  padding: 17px 38px 16px 16px;
  border: 1px solid #d5dce4;
  border-radius: 6px;
  background: #fff;
  color: #273442;
  cursor: pointer;
  text-align: left;
  transition: border-color .16s ease, background-color .16s ease;
}

.module-card:hover {
  border-color: #6e98b7;
  background: #fbfcfd;
}

.module-card:focus-visible {
  outline: 2px solid #2f6f9f;
  outline-offset: 2px;
}

.module-card-icon {
  display: inline-flex;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 4px;
  font-size: 18px;
}

.module-card-icon--blue { background: #e6f0f7; color: #2d658f; }
.module-card-icon--green { background: #e7f2ec; color: #3b7654; }
.module-card-icon--amber { background: #f6efdc; color: #8b6b22; }
.module-card-icon--purple { background: #eeeaf5; color: #69568a; }
.module-card-icon--teal { background: #e4f1f0; color: #397675; }
.module-card-icon--slate { background: #e9edf1; color: #566678; }

.module-card-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.module-card-copy strong {
  color: #22303e;
  font-size: 16px;
  font-weight: 650;
}

.module-card-copy span {
  overflow: hidden;
  color: #6d7b89;
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-card-copy em {
  margin-top: auto;
  color: #2f6f9f;
  font-size: 12px;
  font-style: normal;
}

.module-card-arrow {
  position: absolute;
  top: 19px;
  right: 15px;
  color: #91a0ae;
  font-size: 15px;
}

@media (max-width: 1180px) {
  .overview-panel { padding-inline: 24px; }
  .module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .home-header { flex-wrap: wrap; padding: 10px 14px; }
  .workbench-switch { width: 100%; }
  .workbench-switch__button { flex: 1 1 0; min-width: 0; }
  .overview-summary { flex-direction: column; }
  .overview-date { width: 100%; }
  .module-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
