<template>
  <div class="home-view">
    <!-- 顶部模式切换栏 -->
    <div class="home-header">
      <div class="header-left">
        <el-icon class="header-icon" :size="22">
          <component :is="activeModeMeta.icon" />
        </el-icon>
        <span class="header-title">{{ activeModeMeta.title }}</span>
        <el-tag v-if="activeMode === 'twin'" size="small" type="success" effect="plain">AI 助手</el-tag>
        <el-tag v-else-if="activeMode === 'enterprise'" size="small" type="warning" effect="plain">智能 BI</el-tag>
        <el-tag v-else size="small" type="primary" effect="plain">单据流转</el-tag>
      </div>
      <div class="header-right">
        <!-- 管理员才显示模式切换 -->
        <div
          v-if="isAdmin"
          class="mode-switcher"
          role="tablist"
          aria-label="首页功能切换"
        >
          <button
            v-for="item in modeOptions"
            :key="item.value"
            type="button"
            class="mode-card"
            :class="{ active: activeMode === item.value }"
            role="tab"
            :aria-selected="activeMode === item.value"
            @click="activeMode = item.value"
          >
            <span class="mode-icon-wrap">
              <el-icon class="mode-icon"><component :is="item.icon" /></el-icon>
            </span>
            <span class="mode-copy">
              <strong>{{ item.label }}</strong>
              <em>{{ item.desc }}</em>
            </span>
            <span class="mode-badge">{{ item.badge }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeMode === 'twin'" class="twin-wrapper">
      <iframe v-if="harnessAuthReady && !harnessFrameFailed" class="harness-frame" :src="harnessFrameUrl('digital-twin')" title="DeepSeek Harness 数字分身" @error="harnessFrameFailed = true"></iframe>
      <div v-else class="harness-loading" role="status" aria-live="polite">
        <el-icon :class="{ 'is-loading': harnessAuthPending }"><Loading /></el-icon>
        <span>{{ harnessFrameFailed ? 'DeepSeek Harness 加载失败，请重新登录' : '正在加载 DeepSeek Harness' }}</span>
      </div>
    </div>

    <div v-if="activeMode === 'enterprise'" class="enterprise-wrapper">
      <iframe v-if="harnessAuthReady && !harnessFrameFailed" class="harness-frame" :src="harnessFrameUrl('enterprise-bi')" title="DeepSeek Harness 智能 BI" @error="harnessFrameFailed = true"></iframe>
      <div v-else class="harness-loading" role="status" aria-live="polite">
        <el-icon :class="{ 'is-loading': harnessAuthPending }"><Loading /></el-icon>
        <span>{{ harnessFrameFailed ? 'DeepSeek Harness 加载失败，请重新登录' : '正在加载 DeepSeek Harness' }}</span>
      </div>
    </div>
    <div v-show="activeMode === 'flow'" class="flow-wrapper">
      <BusinessFlowMap />
    </div>

  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { getAuthHeader } from '@/utils/auth'
import { prepareHarnessAuth as prepareHarnessAuthRequest } from '@/services/harness-auth-client'
import BusinessFlowMap from '@/components/business-flow/BusinessFlowMap.vue'
import {
  Loading, DataAnalysis, Service, Share
} from '@element-plus/icons-vue'


// ── Store & Auth ──
const userStore = useUserStore()

const isAdmin = computed(() => {
  const info = userStore.userInfo || {}
  const role = String(info.role || info.app_role || info.appRole || '').trim().toLowerCase()
  return ['super_admin', 'system_admin', 'admin'].includes(role)
})


// ── 模式切换 ──
const DEFAULT_WORKBENCH_MODE = 'flow'
const activeMode = ref(DEFAULT_WORKBENCH_MODE)
const harnessFrameFailed = ref(false)
const harnessWebEnabled = Boolean(import.meta.env.VITE_HARNESS_WEB_URL || import.meta.env.PROD)
const harnessWebUrl = import.meta.env.VITE_HARNESS_WEB_URL || '/harness-embed/'
const harnessAuthReady = ref(false)
const harnessAuthPending = ref(false)
let harnessAuthRequestId = 0
const harnessFrameUrl = (surface) => {
  return `${harnessWebUrl}#${surface}`
}

const prepareHarnessAuth = async () => {
  if (!harnessWebEnabled) return true
  const requestId = ++harnessAuthRequestId
  harnessAuthPending.value = true
  harnessFrameFailed.value = false
  harnessAuthReady.value = false
  let ready = false
  try {
    ready = await prepareHarnessAuthRequest({
      harnessWebUrl,
      authorization: getAuthHeader().Authorization || ''
    })
  } finally {
    if (requestId === harnessAuthRequestId) {
      harnessAuthReady.value = ready
      harnessAuthPending.value = false
    }
  }
  return ready
}
const modeOptions = [
  { label: '数字分身', value: 'twin', desc: '个人工作助手', badge: 'AI', icon: Service },
  { label: '智能 BI', value: 'enterprise', desc: '经营数据分析', badge: 'BI', icon: DataAnalysis },
  { label: '业务流程', value: 'flow', desc: '流程与单据', badge: 'Flow', icon: Share }
]

const activeModeMeta = computed(() => {
  if (activeMode.value === 'enterprise') return { title: '智能 BI', icon: DataAnalysis }
  if (activeMode.value === 'flow') return { title: '业务流程', icon: Share }
  return { title: '我的数字分身', icon: Service }
})

watch(activeMode, (val) => {
  harnessFrameFailed.value = false
  harnessAuthPending.value = false
  harnessAuthReady.value = false
  if (val === 'twin' || val === 'enterprise') void prepareHarnessAuth()
})
</script>

<style scoped lang="scss">
$primary-color: var(--el-color-primary, #409EFF);
$border-color: var(--el-border-color, #dcdfe6);

.home-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 覆盖 el-main 默认 overflow:auto 对本页的影响 */
  flex: 1;
  min-height: 0;
  --ai-panel-bg: var(--el-color-primary-light-9, #f5f7fa);
  --ai-panel-surface: #ffffff;
}

// ── 顶部栏 ──
.home-header {
  min-height: 60px;
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 14px;
  background: var(--ai-panel-surface);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-icon { color: $primary-color; }
    .header-title { font-weight: 600; font-size: 15px; }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .header-actions {
    display: flex;
    gap: 6px;
    font-size: 18px;
    color: #909399;

    .action-icon-btn {
      width: 24px;
      height: 24px;
      border: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.2s;
      &:hover { color: $primary-color; }
      &.active { color: $primary-color; }
      &:focus-visible {
        outline: 2px solid rgba($primary-color, 0.35);
        outline-offset: 2px;
      }
    }

    .action-icon {
      font-size: 18px;
    }
  }

  .mode-switcher {
    display: grid;
    grid-template-columns: repeat(3, minmax(128px, 1fr));
    gap: 6px;
    min-width: min(540px, 56vw);
    padding: 3px;
    border: 1px solid #d7e0ea;
    border-radius: 8px;
    background: #f6f8fb;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.72);
  }

  .mode-card {
    min-width: 0;
    height: 38px;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0 7px;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    color: #334155;
    background: #ffffff;
    cursor: pointer;
    text-align: left;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;

    &:hover {
      border-color: #9bb7d7;
      color: #0f172a;
      transform: translateY(-1px);
      box-shadow: 0 5px 14px rgba(15, 23, 42, 0.10);
    }

    &.active {
      border-color: #0f172a;
      background: #061224;
      color: #ffffff;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.24);

      .mode-icon-wrap {
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
      }

      .mode-copy em {
        color: rgba(255, 255, 255, 0.72);
      }

      .mode-badge {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }
    }

    &:focus-visible {
      outline: 2px solid rgba($primary-color, 0.35);
      outline-offset: 2px;
    }
  }

  .mode-icon-wrap {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: #edf4ff;
    color: #2563eb;
  }

  .mode-icon {
    font-size: 15px;
  }

  .mode-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;

    strong,
    em {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: 0;
    }

    strong {
      font-size: 13px;
      line-height: 16px;
      font-weight: 700;
    }

    em {
      font-size: 10px;
      line-height: 12px;
      font-style: normal;
      color: #64748b;
    }
  }

  .mode-badge {
    height: 18px;
    min-width: 26px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #e2e8f0;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0;
  }
}

// ── 数字分身整体 ──
.twin-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// ── 智能 BI 内联容器 ──
.enterprise-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.flow-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.harness-frame {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  border: 0;
  background: #fff;
}

.harness-loading {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  background: #fff;
}

@media (max-width: 1180px) {
  .home-header {
    align-items: stretch;
    flex-direction: column;

    .header-right {
      justify-content: space-between;
    }

    .mode-switcher {
      flex: 1;
      min-width: 0;
    }
  }
}

@media (max-width: 760px) {
  .home-header {
    padding: 8px;

    .header-left {
      min-width: 0;
    }

    .header-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-right {
      align-items: stretch;
      flex-direction: column;
      gap: 8px;
    }

    .mode-switcher {
      display: flex;
      overflow-x: auto;
      padding-bottom: 5px;
      scroll-snap-type: x proximity;
    }

    .mode-card {
      flex: 0 0 154px;
      scroll-snap-align: start;
    }

  }
}
</style>
