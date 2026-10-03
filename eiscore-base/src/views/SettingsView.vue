<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>系统全局设置</h2>
            <p>内部系统偏好、企业资料状态与智能协作运行状态</p>
          </div>
        </div>
      </template>

      <el-alert
        v-if="!canManage"
        title="仅超级管理员可修改系统设置"
        type="warning"
        show-icon
        style="margin-bottom: 16px;"
      />

      <el-form v-if="canManage" label-width="140px" class="settings-form">
        <el-tabs v-model="activeTab" class="settings-tabs">
          <el-tab-pane label="基础设置" name="basic">
            <BasicSystemSettings :form="form" :predefine-colors="predefineColors" />
          </el-tab-pane>

          <el-tab-pane label="企业资料" name="login">
            <PublishedEnterpriseProfile
              v-if="hasPublishedEnterpriseProfile"
              :summary="enterpriseProfileSummary"
              @open-operations="openEnterpriseOperations"
              @open-public-site="previewLoginPage"
            />
            <div v-else class="enterprise-profile-empty">
              <el-alert
                title="尚未读取到已发布企业档案"
                description="企业公开资料只在企业站点运营中维护。请完成站点设置并发布，发布后本页会显示只读摘要。"
                type="warning"
                show-icon
                :closable="false"
                class="section-alert"
              />
              <el-button type="primary" @click="openEnterpriseOperations">进入企业站点运营</el-button>
            </div>
          </el-tab-pane>

          <el-tab-pane label="AI Agent" name="agent">
            <el-divider content-position="left">DeepSeek Harness 运行状态</el-divider>
            <el-alert
              title="智能能力统一由 DeepSeek Harness 插件链路提供。模型地址、密钥和插件运行参数由部署环境管理。"
              type="info"
              show-icon
              :closable="false"
              class="section-alert"
            />
            <el-form-item label="运行提供方">
              <el-tag type="success">deepseek-harness</el-tag>
            </el-form-item>
            <el-form-item label="配置方式">
              <span>由服务端 Harness Bridge 和部署环境统一管理</span>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="功能展示" name="visibility">
            <el-divider content-position="left">模块与应用卡片展示控制</el-divider>
            <el-alert
              title="这里仅控制侧边栏模块入口和应用卡片是否展示，不替代权限、接口鉴权或数据库 RLS。"
              type="warning"
              show-icon
              :closable="false"
              class="section-alert"
            />

            <el-form-item label="搜索模块/应用">
              <el-input
                v-model="moduleFilterText"
                clearable
                placeholder="输入模块名、应用名或说明"
              />
            </el-form-item>

            <div class="visibility-panel">
              <div
                v-for="module in filteredDisplayModules"
                :key="module.key"
                class="visibility-module"
              >
                <div class="visibility-module__header">
                  <div>
                    <strong>{{ module.label }}</strong>
                    <span>{{ module.route }}</span>
                  </div>
                  <el-switch
                    :model-value="isVisibilityModuleShown(module.key)"
                    active-text="显示模块"
                    inactive-text="隐藏模块"
                    @change="setVisibilityModuleShown(module.key, $event)"
                  />
                </div>

                <div v-if="module.apps.length" class="visibility-apps">
                  <div
                    v-for="app in module.apps"
                    :key="`${module.key}-${app.key}`"
                    class="visibility-app"
                  >
                    <div>
                      <span class="visibility-app__name">{{ app.name }}</span>
                      <small>{{ app.desc }}</small>
                    </div>
                    <el-switch
                      :model-value="isVisibilityAppShown(module.key, app.key)"
                      :disabled="!isVisibilityModuleShown(module.key)"
                      active-text="显示"
                      inactive-text="隐藏"
                      @change="setVisibilityAppShown(module.key, app.key, $event)"
                    />
                  </div>
                </div>
                <div v-else class="visibility-empty">该模块当前没有独立应用卡片。</div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <el-form-item class="settings-actions">
          <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存并生效</el-button>
          <el-button v-if="hasPublishedEnterpriseProfile" @click="previewLoginPage">打开企业独立站</el-button>
          <el-button v-else @click="openEnterpriseOperations">进入企业站点运营</el-button>
          <el-button @click="resetSettings">重置默认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BasicSystemSettings from '@/components/settings/BasicSystemSettings.vue'
import PublishedEnterpriseProfile from '@/components/settings/PublishedEnterpriseProfile.vue'
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { getHostHttpClient } from '@/platform/http-client'
import {
  DISPLAY_MODULE_CATALOG,
  normalizeDisplayVisibility,
  saveStoredDisplayVisibility
} from '@shared/eis-display-control'
import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import {
  createEnterpriseProfileSummary,
  isPublishedEnterpriseProfile,
  resolveEnterpriseProfilePreviewUrl
} from '@/domain/settings-enterprise-profile-policy'

const systemStore = useSystemStore()
const userStore = useUserStore()
const router = useRouter()
const activeTab = ref('basic')
const savingSettings = ref(false)
const moduleFilterText = ref('')
const visibilityForm = reactive(normalizeDisplayVisibility())
const appCenterDynamicApps = ref([])

const predefineColors = [
  '#409EFF',
  '#1455d9',
  '#0f766e',
  '#1d4ed8',
  '#dc2626',
  '#ca8a04',
  '#4f46e5'
]

const defaultForm = () => {
  const enterpriseConfig = getEnterpriseConfig(globalThis)
  return {
    title: enterpriseConfig.branding.productName,
    themeColor: enterpriseConfig.branding.themeColor,
    notifications: true,
    materialsCategoryDepth: 2,
    visibility: normalizeDisplayVisibility()
  }
}

const form = reactive(defaultForm())
const hasPublishedEnterpriseProfile = computed(() => isPublishedEnterpriseProfile(systemStore.enterpriseProfile))
const enterpriseProfileSummary = computed(() => createEnterpriseProfileSummary(systemStore.enterpriseProfile))

const canManage = computed(() => {
  const info = userStore.userInfo || {}
  const roleValues = [
    info.app_role,
    info.appRole,
    info.role,
    info.role_code,
    info.roleCode,
    info.dbRole,
    info.db_role
  ].map((value) => String(value || '').trim().toLowerCase())
  return roleValues.includes('super_admin') || roleValues.includes('超级管理员')
})

const displayModules = computed(() => DISPLAY_MODULE_CATALOG.map((module) => {
  if (module.key !== 'apps') return module
  return {
    ...module,
    apps: [
      ...module.apps,
      ...appCenterDynamicApps.value
    ]
  }
}))

const filteredDisplayModules = computed(() => {
  const keyword = moduleFilterText.value.trim().toLowerCase()
  if (!keyword) return displayModules.value
  return displayModules.value
    .map((module) => ({
      ...module,
      apps: module.apps.filter((app) => [
        app.key,
        app.name,
        app.desc
      ].some((value) => String(value || '').toLowerCase().includes(keyword)))
    }))
    .filter((module) => (
      module.key.toLowerCase().includes(keyword) ||
      module.label.toLowerCase().includes(keyword) ||
      String(module.route || '').toLowerCase().includes(keyword) ||
      module.apps.length > 0
    ))
})

const applyVisibility = (next) => {
  const normalized = normalizeDisplayVisibility(next)
  visibilityForm.hiddenModules = normalized.hiddenModules
  visibilityForm.hiddenApps = normalized.hiddenApps
}

const updateKeyInArray = (arr, key, enabled) => {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) return arr
  const set = new Set(Array.isArray(arr) ? arr : [])
  if (enabled) set.delete(normalizedKey)
  else set.add(normalizedKey)
  return Array.from(set)
}

const isVisibilityModuleShown = (moduleKey) => !visibilityForm.hiddenModules.includes(moduleKey)

const setVisibilityModuleShown = (moduleKey, shown) => {
  visibilityForm.hiddenModules = updateKeyInArray(visibilityForm.hiddenModules, moduleKey, shown)
}

const isVisibilityAppShown = (moduleKey, appKey) => {
  const list = visibilityForm.hiddenApps[moduleKey] || []
  return !list.includes(appKey)
}

const setVisibilityAppShown = (moduleKey, appKey, shown) => {
  visibilityForm.hiddenApps = {
    ...visibilityForm.hiddenApps,
    [moduleKey]: updateKeyInArray(visibilityForm.hiddenApps[moduleKey], appKey, shown)
  }
}

const loadAppCenterDynamicApps = async () => {
  if (!canManage.value) return
  try {
    const { data } = await getHostHttpClient().requestJson('/apps?select=id,name,description,app_type,status&order=created_at.desc', {
      headers: {
        'Accept-Profile': 'app_center',
        'Content-Profile': 'app_center'
      }
    })
    appCenterDynamicApps.value = Array.isArray(data)
      ? data
        .map((app) => ({
          key: `app:${app.id}`,
          name: String(app.name || '未命名应用'),
          desc: `自建应用 · ${app.app_type || 'custom'} · ${app.status || 'draft'}${app.description ? `｜${app.description}` : ''}`
        }))
        .filter((app) => app.key !== 'app:')
      : []
  } catch {
    appCenterDynamicApps.value = []
  }
}

const syncFromStore = (cfg) => {
  const source = cfg && typeof cfg === 'object' ? cfg : {}
  const next = defaultForm()
  form.title = String(source.title || next.title)
  form.themeColor = String(source.themeColor || next.themeColor)
  form.notifications = source.notifications !== false
  form.materialsCategoryDepth = Number(source.materialsCategoryDepth) === 3 ? 3 : 2
  applyVisibility(source.visibility || next.visibility)
}

onMounted(() => {
  syncFromStore(systemStore.config)
  loadAppCenterDynamicApps()
})

watch(() => systemStore.config, (value) => {
  syncFromStore(value)
}, { deep: true })

watch(canManage, (allowed) => {
  if (allowed && appCenterDynamicApps.value.length === 0) loadAppCenterDynamicApps()
})

const saveSettings = async () => {
  if (!canManage.value) return
  savingSettings.value = true
  const payload = {
    title: form.title,
    themeColor: form.themeColor,
    notifications: form.notifications,
    materialsCategoryDepth: form.materialsCategoryDepth === 3 ? 3 : 2,
    visibility: normalizeDisplayVisibility(visibilityForm)
  }
  try {
    const appOk = await systemStore.saveConfig(payload)
    if (!appOk) {
      ElMessage.error('系统设置保存失败，请稍后重试')
      return
    }
    saveStoredDisplayVisibility(payload.visibility)
    ElMessage.success('设置已保存并生效')
  } catch {
    ElMessage.error('保存失败，请稍后重试')
  } finally {
    savingSettings.value = false
  }
}

const previewLoginPage = () => window.open(
  resolveEnterpriseProfilePreviewUrl(systemStore.enterpriseProfile), '_blank', 'noopener,noreferrer'
)

const openEnterpriseOperations = () => router.push('/company-site')

const resetSettings = () => {
  const next = defaultForm()
  form.title = next.title
  form.themeColor = next.themeColor
  form.notifications = next.notifications
  form.materialsCategoryDepth = next.materialsCategoryDepth
  applyVisibility(next.visibility)
  saveSettings()
}
</script>

<style scoped lang="scss">
.settings-page {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  box-sizing: border-box;
}

.settings-card :deep(.el-card__header) {
  border-bottom: 1px solid var(--el-border-color-light);
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
}

.card-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}

.settings-form {
  max-width: 980px;
}

.settings-tabs {
  width: 100%;
}

.section-alert {
  margin-bottom: 16px;
}

.enterprise-profile-empty {
  padding-top: 16px;
}

.settings-actions {
  margin-top: 18px;
}
</style>
