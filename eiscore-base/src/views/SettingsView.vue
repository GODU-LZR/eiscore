<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>系统全局设置</h2>
            <p>主题色、登录门户与数字化转型服务商智能体接入配置</p>
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
            <el-divider content-position="left">基础配置</el-divider>
            <el-form-item label="系统标题">
              <el-input v-model="form.title" placeholder="请输入左上角显示标题" />
            </el-form-item>

            <el-form-item label="标签页图标">
              <div class="favicon-config">
                <div class="upload-row">
                  <el-input v-model="form.favicon" placeholder="可填图标 URL，或使用右侧上传" />
                  <el-upload
                    accept="image/*,.ico"
                    :show-file-list="false"
                    :auto-upload="false"
                    :on-change="(file) => handleFaviconUpload(file)"
                  >
                    <el-button>上传</el-button>
                  </el-upload>
                </div>
                <div v-if="form.favicon" class="favicon-preview">
                  <span class="favicon-preview__frame">
                    <img :src="form.favicon" alt="标签页图标预览" />
                  </span>
                  <div>
                    <strong>当前标签页图标</strong>
                    <p>保存后会同步到浏览器标签页的 favicon。</p>
                  </div>
                </div>
              </div>
            </el-form-item>

            <el-form-item label="主题颜色">
              <div class="theme-row">
                <el-color-picker v-model="form.themeColor" />
                <div class="preset-colors">
                  <button
                    v-for="color in predefineColors"
                    :key="color"
                    type="button"
                    class="color-block"
                    :style="{ backgroundColor: color }"
                    @click="form.themeColor = color"
                  />
                </div>
              </div>
            </el-form-item>

            <el-form-item label="开启通知">
              <el-switch v-model="form.notifications" />
            </el-form-item>

            <el-form-item label="物料分类层级">
              <el-radio-group v-model="form.materialsCategoryDepth">
                <el-radio :label="2">二级</el-radio>
                <el-radio :label="3">三级</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="登录门户" name="login">
            <el-divider content-position="left">登录门户品牌信息</el-divider>
        <el-form-item label="企业 Logo">
          <div class="logo-config">
            <div class="upload-row">
              <el-input v-model="form.loginBranding.logo" placeholder="可填 Logo URL，或使用右侧上传" />
              <el-upload
                accept="image/*"
                :show-file-list="false"
                :auto-upload="false"
                :on-change="(file) => handleLogoUpload(file)"
              >
                <el-button>上传</el-button>
              </el-upload>
            </div>
            <div v-if="form.loginBranding.logo" class="logo-preview">
              <span class="logo-preview__frame">
                <img :src="form.loginBranding.logo" alt="企业 Logo 预览" />
              </span>
              <div>
                <strong>当前登录页 Logo</strong>
            <p>默认使用系统图标，可在这里替换为企业自有图片地址或上传图片。</p>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="企业名称">
          <el-input v-model="form.loginBranding.companyName" placeholder="例如：XX集团有限公司" />
        </el-form-item>

        <el-form-item label="站点标识">
          <el-input v-model="form.loginBranding.siteTag" placeholder="例如：Enterprise Digital Portal" />
        </el-form-item>

        <el-form-item label="首屏提示">
          <el-input v-model="form.loginBranding.announcement" placeholder="例如：员工与合作伙伴入口" />
        </el-form-item>

        <el-form-item label="主宣传语">
          <el-input v-model="form.loginBranding.slogan" placeholder="例如：让生产、仓储与经营协同更高效" />
        </el-form-item>

        <el-form-item label="企业介绍">
          <el-input
            v-model="form.loginBranding.description"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="用于登录页展示企业简介"
          />
        </el-form-item>

        <el-form-item label="背景图片">
          <div class="upload-row">
            <el-input
              v-model="form.loginBranding.backgroundImage"
              placeholder="可填图片 URL，或使用右侧上传"
            />
            <el-upload
              accept="image/*"
              :show-file-list="false"
              :auto-upload="false"
              :on-change="(file) => handleBackgroundUpload(file)"
            >
              <el-button>上传</el-button>
            </el-upload>
          </div>
        </el-form-item>

        <el-divider content-position="left">独立站首屏配置</el-divider>
        <el-form-item label="顶部登录按钮">
          <el-input v-model="form.loginBranding.headerLoginText" placeholder="例如：员工通道" />
        </el-form-item>

        <el-form-item label="登录框标题">
          <div class="double-row">
            <el-input v-model="form.loginBranding.authKicker" placeholder="小标题，例如：员工入口" />
            <el-input v-model="form.loginBranding.authTitle" placeholder="主标题，例如：账号登录" />
          </div>
        </el-form-item>

        <el-form-item label="登录框提示">
          <div class="double-row">
            <el-input v-model="form.loginBranding.authSafeNote" placeholder="表单提示，例如：账号由管理员统一分配" />
            <el-input v-model="form.loginBranding.authFootnote" placeholder="底部提示，例如：该入口仅供授权人员使用" />
          </div>
        </el-form-item>

        <el-form-item label="主按钮文案">
          <el-input v-model="form.loginBranding.primaryActionText" placeholder="例如：员工登录" />
        </el-form-item>

        <el-form-item label="副按钮">
          <div class="double-row">
            <el-input v-model="form.loginBranding.secondaryActionText" placeholder="按钮文案，例如：了解平台" />
            <el-input v-model="form.loginBranding.secondaryActionUrl" placeholder="跳转地址，例如：/eiscore 或 https://..." />
          </div>
        </el-form-item>

        <el-form-item label="顶部导航">
          <div class="dynamic-panel">
            <div
              v-for="(item, index) in form.loginBranding.navItems"
              :key="`nav-${index}`"
              class="inline-item"
            >
              <el-input v-model="item.label" placeholder="导航名称，例如：企业概况" />
              <el-input v-model="item.anchor" placeholder="锚点：overview / capabilities / metrics" />
              <el-button type="danger" plain @click="removeNavItem(index)">删除</el-button>
            </div>
            <el-button class="add-btn" @click="addNavItem">新增导航</el-button>
          </div>
        </el-form-item>

        <el-form-item label="核心指标">
          <div class="dynamic-panel">
            <div
              v-for="(item, index) in form.loginBranding.metrics"
              :key="`metric-${index}`"
              class="inline-item"
            >
              <el-input v-model="item.value" placeholder="指标值，例如：2009" />
              <el-input v-model="item.label" placeholder="指标名称，例如：成立时间" />
              <el-button type="danger" plain @click="removeMetric(index)">删除</el-button>
            </div>
            <el-button class="add-btn" @click="addMetric">新增指标</el-button>
          </div>
        </el-form-item>

        <el-form-item label="信任标签">
          <div class="dynamic-panel">
            <div
              v-for="(item, index) in form.loginBranding.trustBadges"
              :key="`trust-${index}`"
              class="inline-item compact-inline"
            >
              <el-input v-model="item.label" placeholder="例如：全链路追溯" />
              <el-button type="danger" plain @click="removeTrustBadge(index)">删除</el-button>
            </div>
            <el-button class="add-btn" @click="addTrustBadge">新增标签</el-button>
          </div>
        </el-form-item>

        <el-form-item label="企业服务链路">
          <div class="dynamic-panel">
            <div
              v-for="(item, index) in form.loginBranding.businessChain"
              :key="`chain-${index}`"
              class="dynamic-item"
            >
              <div class="double-row">
                <el-input v-model="item.title" placeholder="链路标题，例如：仓储生产" />
                <el-input v-model="item.status" placeholder="状态标签，例如：实时同步" />
              </div>
              <el-input
                v-model="item.description"
                type="textarea"
                :rows="2"
                maxlength="180"
                show-word-limit
                placeholder="链路说明"
              />
              <el-button type="danger" plain @click="removeBusinessChain(index)">删除链路</el-button>
            </div>
            <el-button class="add-btn" @click="addBusinessChain">新增服务链路</el-button>
          </div>
        </el-form-item>

        <el-form-item label="能力卡片">
          <div class="dynamic-panel">
            <div
              v-for="(item, index) in form.loginBranding.capabilities"
              :key="`capability-${index}`"
              class="dynamic-item"
            >
              <el-input v-model="item.title" placeholder="能力标题，例如：生产与配方管理" />
              <el-input
                v-model="item.description"
                type="textarea"
                :rows="2"
                maxlength="180"
                show-word-limit
                placeholder="能力说明"
              />
              <el-button type="danger" plain @click="removeCapability(index)">删除能力</el-button>
            </div>
            <el-button class="add-btn" @click="addCapability">新增能力卡片</el-button>
          </div>
        </el-form-item>

        <el-divider content-position="left">页面区块标题</el-divider>
        <el-form-item label="下滑提示">
          <el-input v-model="form.loginBranding.scrollCueText" placeholder="例如：向下了解企业" />
        </el-form-item>

        <el-form-item label="指标区块">
          <div class="double-row">
            <el-input v-model="form.loginBranding.metricsSectionKicker" placeholder="小标题，例如：企业实力" />
            <el-input v-model="form.loginBranding.metricsSectionTitle" placeholder="标题，例如：制造现场与经营管理协同" />
          </div>
        </el-form-item>

        <el-form-item label="介绍区块">
          <el-input v-model="form.loginBranding.aboutSectionKicker" placeholder="例如：关于企业" />
        </el-form-item>

        <el-form-item label="服务区块">
          <div class="double-row">
            <el-input v-model="form.loginBranding.capabilitiesSectionKicker" placeholder="小标题，例如：产品与服务" />
            <el-input v-model="form.loginBranding.capabilitiesSectionTitle" placeholder="标题，例如：从产地原料到客户应用的完整服务" />
          </div>
        </el-form-item>

        <el-form-item label="团队区块">
          <div class="double-row">
            <el-input v-model="form.loginBranding.leadersSectionKicker" placeholder="小标题，例如：管理团队" />
            <el-input v-model="form.loginBranding.leadersSectionTitle" placeholder="标题，例如：管理团队" />
          </div>
        </el-form-item>

        <el-form-item label="轮播图片">
          <div class="dynamic-panel">
            <div
              v-for="(item, index) in form.loginBranding.carouselImages"
              :key="`carousel-${index}`"
              class="dynamic-item"
            >
              <el-input v-model="item.url" placeholder="图片 URL 或上传图片" />
              <el-input v-model="item.title" placeholder="标题（可选）" />
              <el-input v-model="item.subtitle" placeholder="副标题（可选）" />
              <div class="item-actions">
                <el-upload
                  accept="image/*"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="(file) => handleCarouselUpload(file, index)"
                >
                  <el-button>上传图片</el-button>
                </el-upload>
                <el-button type="danger" plain @click="removeCarousel(index)">删除</el-button>
              </div>
            </div>
            <el-button class="add-btn" @click="addCarousel">新增轮播图</el-button>
          </div>
        </el-form-item>

        <el-form-item label="领导介绍">
          <div class="dynamic-panel">
            <div
              v-for="(leader, index) in form.loginBranding.leaders"
              :key="`leader-${index}`"
              class="dynamic-item leader-item"
            >
              <el-input v-model="leader.name" placeholder="姓名" />
              <el-input v-model="leader.title" placeholder="职位" />
              <el-input
                v-model="leader.intro"
                type="textarea"
                :rows="2"
                maxlength="180"
                show-word-limit
                placeholder="一句话简介"
              />
              <div class="upload-row">
                <el-input v-model="leader.avatar" placeholder="头像 URL 或上传图片" />
                <el-upload
                  accept="image/*"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="(file) => handleLeaderUpload(file, index)"
                >
                  <el-button>上传头像</el-button>
                </el-upload>
              </div>
              <el-button type="danger" plain @click="removeLeader(index)">删除领导</el-button>
            </div>
            <el-button class="add-btn" @click="addLeader">新增领导介绍</el-button>
          </div>
        </el-form-item>

        <el-divider content-position="left">页脚信息</el-divider>
        <el-form-item label="版权文本">
          <el-input v-model="form.loginBranding.footerText" placeholder="例如：Copyright © XX集团" />
        </el-form-item>

        <el-form-item label="备案信息">
          <el-input v-model="form.loginBranding.icpText" placeholder="例如：粤ICP备xxxxxxxx号" />
        </el-form-item>

          </el-tab-pane>

          <el-tab-pane label="实施运维 Agent" name="agent">
            <el-divider content-position="left">数字化转型服务商智能体配置</el-divider>
            <el-alert
              title="该配置会写入 system_configs.ai_glm_config，Agent Runtime 将读取 api_url 与 api_key。"
              type="info"
              show-icon
              :closable="false"
              class="section-alert"
            />
            <el-form-item label="Base URL">
              <el-input
                v-model="agentConfig.apiUrl"
                clearable
                @input="markAgentConfigDirty"
                placeholder="例如：https://open.bigmodel.cn/api/paas/v4/chat/completions"
              />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input
                v-model="agentConfig.apiKey"
                type="password"
                show-password
                clearable
                autocomplete="off"
                @input="markAgentConfigDirty"
                placeholder="请输入 Agent/大模型服务 API Key"
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-tag :type="agentConfig.apiUrl && agentConfig.apiKey ? 'success' : 'warning'">
                {{ agentConfig.apiUrl && agentConfig.apiKey ? '已配置' : '待配置' }}
              </el-tag>
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

        <el-form-item v-if="canManage" class="settings-actions">
          <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存并生效</el-button>
          <el-button @click="previewLoginPage">预览登录页</el-button>
          <el-button @click="resetSettings">重置默认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { reactive, ref, onMounted, computed, watch } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import {
  DISPLAY_MODULE_CATALOG,
  normalizeDisplayVisibility,
  saveStoredDisplayVisibility
} from '@shared/eis-display-control'

const systemStore = useSystemStore()
const userStore = useUserStore()
const activeTab = ref('basic')
const savingSettings = ref(false)
const agentConfig = reactive({
  apiUrl: '',
  apiKey: ''
})
const agentRawConfig = ref({})
const agentConfigLoaded = ref(false)
const agentConfigDirty = ref(false)
const AI_AGENT_CONFIG_KEY = 'ai_glm_config'
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

const defaultForm = () => ({
  title: '君乐缘台球工厂数字化管理平台',
  favicon: '/favicon.ico',
  themeColor: '#409EFF',
  notifications: true,
  materialsCategoryDepth: 2,
  visibility: normalizeDisplayVisibility(),
  loginBranding: {
    companyName: '君乐缘台球工厂',
    slogan: '让生产、仓储与经营协同更高效',
    description: '面向君乐缘台球工厂的生产制造、物料仓储、销售采购与经营分析一体化平台。',
    logo: '/favicon.ico',
    siteTag: '台球工厂数字化运营平台',
    announcement: '员工与合作伙伴入口',
    headerLoginText: '员工通道',
    authKicker: '员工入口',
    authTitle: '账号登录',
    authSafeNote: '账号由管理员统一分配',
    authFootnote: '该入口仅供授权人员使用',
    primaryActionText: '员工登录',
    secondaryActionText: '了解平台',
    secondaryActionUrl: '/eiscore',
    scrollCueText: '向下了解企业',
    metricsSectionKicker: '企业实力',
    metricsSectionTitle: '制造现场与经营管理协同',
    aboutSectionKicker: '关于企业',
    capabilitiesSectionKicker: '产品与服务',
    capabilitiesSectionTitle: '从订单、生产到交付的业务协同',
    leadersSectionKicker: '管理团队',
    leadersSectionTitle: '管理团队',
    backgroundImage: '',
    navItems: [
      { label: '企业概况', anchor: 'overview' },
      { label: '关于企业', anchor: 'about' },
      { label: '产品服务', anchor: 'capabilities' },
      { label: '企业实力', anchor: 'metrics' }
    ],
    metrics: [
      { label: '生产协同', value: '全流程' },
      { label: '库存可视', value: '实时' },
      { label: '经营决策', value: '数据化' }
    ],
    trustBadges: [
      { label: '生产制造' },
      { label: '物料仓储' },
      { label: '经营分析' }
    ],
    businessChain: [
      { title: '订单协同', description: '统一管理客户需求、订单计划和交付节点。', status: '计划可追踪' },
      { title: '生产制造', description: '围绕产品配方、工单、领料和报工形成生产闭环。', status: '过程透明' },
      { title: '交付服务', description: '打通质量、库存、出货与经营分析数据。', status: '结果可复盘' }
    ],
    capabilities: [
      { title: '生产与配方管理', description: '管理产品配方、BOM、工单、领料和生产报工。' },
      { title: '库存与仓储管理', description: '统一管理物料、批次、仓库、入库和出库。' },
      { title: '销售采购协同', description: '连接客户订单、采购供应和交付执行。' }
    ],
    carouselImages: [],
    leaders: [],
    footerText: 'Copyright © EISCore',
    icpText: ''
  }
})

const form = reactive(defaultForm())

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

const isVisibilityModuleShown = (moduleKey) => {
  return !visibilityForm.hiddenModules.includes(moduleKey)
}

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

const markAgentConfigDirty = () => {
  agentConfigDirty.value = true
}

const parseConfigValue = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (e) {
    return {}
  }
}

const getAuthToken = () => {
  const raw = localStorage.getItem('auth_token')
  if (!raw) return ''
  let token = raw
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.token) token = parsed.token
  } catch (e) {}
  if (token && token.length > 32768) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    return ''
  }
  return token
}

const systemConfigHeaders = (withJson = false) => {
  const headers = {
    Accept: 'application/json',
    'Accept-Profile': 'public'
  }
  if (withJson) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Profile'] = 'public'
    headers.Prefer = 'resolution=merge-duplicates'
  }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const appCenterHeaders = () => {
  const headers = {
    Accept: 'application/json',
    'Accept-Profile': 'app_center',
    'Content-Profile': 'app_center'
  }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const loadAppCenterDynamicApps = async () => {
  if (!canManage.value) return
  try {
    const res = await fetch('/api/apps?select=id,name,description,app_type,status&order=created_at.desc', {
      headers: appCenterHeaders()
    })
    if (!res.ok) return
    const list = await res.json()
    appCenterDynamicApps.value = Array.isArray(list)
      ? list
        .map((app) => ({
          key: `app:${app.id}`,
          name: String(app.name || '未命名应用'),
          desc: `自建应用 · ${app.app_type || 'custom'} · ${app.status || 'draft'}${app.description ? `｜${app.description}` : ''}`
        }))
        .filter((app) => app.key !== 'app:')
      : []
  } catch (e) {
    appCenterDynamicApps.value = []
  }
}

const loadAgentConfig = async () => {
  if (!canManage.value) return
  try {
    const key = encodeURIComponent(AI_AGENT_CONFIG_KEY)
    const res = await fetch(`/api/system_configs?key=eq.${key}`, {
      headers: systemConfigHeaders()
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const row = Array.isArray(data) ? data[0] : null
    const value = parseConfigValue(row?.value)
    agentRawConfig.value = { ...value }
    agentConfig.apiUrl = String(value.api_url || '')
    agentConfig.apiKey = String(value.api_key || '')
    agentConfigLoaded.value = true
    agentConfigDirty.value = false
  } catch (e) {
    agentConfigLoaded.value = false
    ElMessage.warning('Agent 配置读取失败，请检查系统配置权限或服务状态')
  }
}

const saveAgentConfig = async () => {
  if (!canManage.value) return true
  if (!agentConfigDirty.value) return true
  const value = {
    ...(agentRawConfig.value || {}),
    api_url: String(agentConfig.apiUrl || '').trim(),
    api_key: String(agentConfig.apiKey || '').trim()
  }
  const res = await fetch('/api/system_configs', {
    method: 'POST',
    headers: systemConfigHeaders(true),
    body: JSON.stringify({
      key: AI_AGENT_CONFIG_KEY,
      value,
      description: '数字化转型服务商智能体接入配置'
    })
  })
  if (!res.ok) return false
  agentRawConfig.value = { ...value }
  agentConfigLoaded.value = true
  agentConfigDirty.value = false
  return true
}

const syncFromStore = (cfg) => {
  const source = cfg && typeof cfg === 'object' ? cfg : {}
  const branding = source.loginBranding && typeof source.loginBranding === 'object'
    ? source.loginBranding
    : {}
  const next = defaultForm()

  form.title = String(source.title || next.title)
  form.favicon = String(source.favicon || source.icon || source.siteIcon || source.faviconUrl || branding.logo || next.favicon)
  form.themeColor = String(source.themeColor || next.themeColor)
  form.notifications = source.notifications !== false
  form.materialsCategoryDepth = Number(source.materialsCategoryDepth) === 3 ? 3 : 2
  applyVisibility(source.visibility || next.visibility)

  form.loginBranding.companyName = String(branding.companyName || next.loginBranding.companyName)
  form.loginBranding.slogan = String(branding.slogan || next.loginBranding.slogan)
  form.loginBranding.description = String(branding.description || next.loginBranding.description)
  form.loginBranding.logo = String(branding.logo || next.loginBranding.logo)
  form.loginBranding.siteTag = String(branding.siteTag || next.loginBranding.siteTag)
  form.loginBranding.announcement = String(branding.announcement || next.loginBranding.announcement)
  form.loginBranding.headerLoginText = String(branding.headerLoginText || next.loginBranding.headerLoginText)
  form.loginBranding.authKicker = String(branding.authKicker || next.loginBranding.authKicker)
  form.loginBranding.authTitle = String(branding.authTitle || next.loginBranding.authTitle)
  form.loginBranding.authSafeNote = String(branding.authSafeNote || next.loginBranding.authSafeNote)
  form.loginBranding.authFootnote = String(branding.authFootnote || next.loginBranding.authFootnote)
  form.loginBranding.primaryActionText = String(branding.primaryActionText || next.loginBranding.primaryActionText)
  form.loginBranding.secondaryActionText = String(branding.secondaryActionText || next.loginBranding.secondaryActionText)
  form.loginBranding.secondaryActionUrl = String(branding.secondaryActionUrl || next.loginBranding.secondaryActionUrl)
  form.loginBranding.scrollCueText = String(branding.scrollCueText || next.loginBranding.scrollCueText)
  form.loginBranding.metricsSectionKicker = String(branding.metricsSectionKicker || next.loginBranding.metricsSectionKicker)
  form.loginBranding.metricsSectionTitle = String(branding.metricsSectionTitle || next.loginBranding.metricsSectionTitle)
  form.loginBranding.aboutSectionKicker = String(branding.aboutSectionKicker || next.loginBranding.aboutSectionKicker)
  form.loginBranding.capabilitiesSectionKicker = String(branding.capabilitiesSectionKicker || next.loginBranding.capabilitiesSectionKicker)
  form.loginBranding.capabilitiesSectionTitle = String(branding.capabilitiesSectionTitle || next.loginBranding.capabilitiesSectionTitle)
  form.loginBranding.leadersSectionKicker = String(branding.leadersSectionKicker || next.loginBranding.leadersSectionKicker)
  form.loginBranding.leadersSectionTitle = String(branding.leadersSectionTitle || next.loginBranding.leadersSectionTitle)
  form.loginBranding.backgroundImage = String(branding.backgroundImage || '')
  form.loginBranding.navItems = Array.isArray(branding.navItems)
    ? branding.navItems.map((item) => ({
      label: String(item?.label || ''),
      anchor: String(item?.anchor || '')
    })).filter((item) => item.label)
    : next.loginBranding.navItems.map((item) => ({ ...item }))
  form.loginBranding.metrics = Array.isArray(branding.metrics)
    ? branding.metrics.map((item) => ({
      label: String(item?.label || ''),
      value: String(item?.value || '')
    })).filter((item) => item.label || item.value)
    : next.loginBranding.metrics.map((item) => ({ ...item }))
  form.loginBranding.trustBadges = Array.isArray(branding.trustBadges)
    ? branding.trustBadges.map((item) => ({
      label: typeof item === 'string' ? item : String(item?.label || '')
    })).filter((item) => item.label)
    : next.loginBranding.trustBadges.map((item) => ({ ...item }))
  form.loginBranding.businessChain = Array.isArray(branding.businessChain)
    ? branding.businessChain.map((item) => ({
      title: String(item?.title || ''),
      description: String(item?.description || ''),
      status: String(item?.status || '')
    })).filter((item) => item.title || item.description)
    : next.loginBranding.businessChain.map((item) => ({ ...item }))
  form.loginBranding.capabilities = Array.isArray(branding.capabilities)
    ? branding.capabilities.map((item) => ({
      title: String(item?.title || ''),
      description: String(item?.description || '')
    })).filter((item) => item.title || item.description)
    : next.loginBranding.capabilities.map((item) => ({ ...item }))
  form.loginBranding.carouselImages = Array.isArray(branding.carouselImages)
    ? branding.carouselImages.map((item) => ({
      url: String(item?.url || ''),
      title: String(item?.title || ''),
      subtitle: String(item?.subtitle || '')
    })).filter((item) => item.url)
    : []
  form.loginBranding.leaders = Array.isArray(branding.leaders)
    ? branding.leaders.map((item) => ({
      name: String(item?.name || ''),
      title: String(item?.title || ''),
      intro: String(item?.intro || ''),
      avatar: String(item?.avatar || '')
    })).filter((item) => item.name)
    : []
  form.loginBranding.footerText = String(branding.footerText || next.loginBranding.footerText)
  form.loginBranding.icpText = String(branding.icpText || '')
}

onMounted(() => {
  syncFromStore(systemStore.config)
  loadAgentConfig()
  loadAppCenterDynamicApps()
})

watch(() => systemStore.config, (val) => {
  syncFromStore(val)
}, { deep: true })

watch(canManage, (allowed) => {
  if (allowed && !agentConfigLoaded.value) {
    loadAgentConfig()
  }
  if (allowed && appCenterDynamicApps.value.length === 0) {
    loadAppCenterDynamicApps()
  }
})

const toDataUrl = (rawFile) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = reject
  reader.readAsDataURL(rawFile)
})

const handleBackgroundUpload = async (uploadFile) => {
  if (!uploadFile?.raw) return
  form.loginBranding.backgroundImage = await toDataUrl(uploadFile.raw)
}

const handleLogoUpload = async (uploadFile) => {
  if (!uploadFile?.raw) return
  form.loginBranding.logo = await toDataUrl(uploadFile.raw)
}

const handleFaviconUpload = async (uploadFile) => {
  if (!uploadFile?.raw) return
  form.favicon = await toDataUrl(uploadFile.raw)
}

const handleCarouselUpload = async (uploadFile, index) => {
  if (!uploadFile?.raw || !form.loginBranding.carouselImages[index]) return
  form.loginBranding.carouselImages[index].url = await toDataUrl(uploadFile.raw)
}

const handleLeaderUpload = async (uploadFile, index) => {
  if (!uploadFile?.raw || !form.loginBranding.leaders[index]) return
  form.loginBranding.leaders[index].avatar = await toDataUrl(uploadFile.raw)
}

const addCarousel = () => {
  form.loginBranding.carouselImages.push({ url: '', title: '', subtitle: '' })
}

const removeCarousel = (index) => {
  form.loginBranding.carouselImages.splice(index, 1)
}

const addNavItem = () => {
  form.loginBranding.navItems.push({ label: '', anchor: '' })
}

const removeNavItem = (index) => {
  form.loginBranding.navItems.splice(index, 1)
}

const addMetric = () => {
  form.loginBranding.metrics.push({ label: '', value: '' })
}

const removeMetric = (index) => {
  form.loginBranding.metrics.splice(index, 1)
}

const addTrustBadge = () => {
  form.loginBranding.trustBadges.push({ label: '' })
}

const removeTrustBadge = (index) => {
  form.loginBranding.trustBadges.splice(index, 1)
}

const addBusinessChain = () => {
  form.loginBranding.businessChain.push({ title: '', description: '', status: '' })
}

const removeBusinessChain = (index) => {
  form.loginBranding.businessChain.splice(index, 1)
}

const addCapability = () => {
  form.loginBranding.capabilities.push({ title: '', description: '' })
}

const removeCapability = (index) => {
  form.loginBranding.capabilities.splice(index, 1)
}

const addLeader = () => {
  form.loginBranding.leaders.push({ name: '', title: '', intro: '', avatar: '' })
}

const removeLeader = (index) => {
  form.loginBranding.leaders.splice(index, 1)
}

const saveSettings = async () => {
  if (!canManage.value) return
  savingSettings.value = true
  const payload = {
    title: form.title,
    favicon: form.favicon,
    themeColor: form.themeColor,
    notifications: form.notifications,
    materialsCategoryDepth: form.materialsCategoryDepth === 3 ? 3 : 2,
    visibility: normalizeDisplayVisibility(visibilityForm),
    loginBranding: {
      companyName: form.loginBranding.companyName,
      slogan: form.loginBranding.slogan,
      description: form.loginBranding.description,
      logo: form.loginBranding.logo,
      siteTag: form.loginBranding.siteTag,
      announcement: form.loginBranding.announcement,
      headerLoginText: form.loginBranding.headerLoginText,
      authKicker: form.loginBranding.authKicker,
      authTitle: form.loginBranding.authTitle,
      authSafeNote: form.loginBranding.authSafeNote,
      authFootnote: form.loginBranding.authFootnote,
      primaryActionText: form.loginBranding.primaryActionText,
      secondaryActionText: form.loginBranding.secondaryActionText,
      secondaryActionUrl: form.loginBranding.secondaryActionUrl,
      scrollCueText: form.loginBranding.scrollCueText,
      metricsSectionKicker: form.loginBranding.metricsSectionKicker,
      metricsSectionTitle: form.loginBranding.metricsSectionTitle,
      aboutSectionKicker: form.loginBranding.aboutSectionKicker,
      capabilitiesSectionKicker: form.loginBranding.capabilitiesSectionKicker,
      capabilitiesSectionTitle: form.loginBranding.capabilitiesSectionTitle,
      leadersSectionKicker: form.loginBranding.leadersSectionKicker,
      leadersSectionTitle: form.loginBranding.leadersSectionTitle,
      backgroundImage: form.loginBranding.backgroundImage,
      navItems: form.loginBranding.navItems.filter((item) => item.label),
      metrics: form.loginBranding.metrics.filter((item) => item.label || item.value),
      trustBadges: form.loginBranding.trustBadges.filter((item) => item.label),
      businessChain: form.loginBranding.businessChain.filter((item) => item.title || item.description),
      capabilities: form.loginBranding.capabilities.filter((item) => item.title || item.description),
      carouselImages: form.loginBranding.carouselImages.filter((item) => item.url),
      leaders: form.loginBranding.leaders.filter((item) => item.name),
      footerText: form.loginBranding.footerText,
      icpText: form.loginBranding.icpText
    }
  }
  try {
    const appOk = await systemStore.saveConfig(payload)
    if (!appOk) {
      ElMessage.error('系统设置保存失败，请稍后重试')
      return
    }
    const agentOk = await saveAgentConfig()
    if (!agentOk) {
      ElMessage.error('系统设置已保存，但 Agent 配置保存失败')
      return
    }
    saveStoredDisplayVisibility(payload.visibility)
    ElMessage.success('设置已保存并生效')
  } catch (e) {
    ElMessage.error('保存失败，请稍后重试')
  } finally {
    savingSettings.value = false
  }
}

const previewLoginPage = () => {
  window.open('/login', '_blank', 'noopener,noreferrer')
}

const resetSettings = () => {
  const next = defaultForm()
  form.title = next.title
  form.favicon = next.favicon
  form.themeColor = next.themeColor
  form.notifications = next.notifications
  form.materialsCategoryDepth = next.materialsCategoryDepth
  applyVisibility(next.visibility)
  form.loginBranding.companyName = next.loginBranding.companyName
  form.loginBranding.slogan = next.loginBranding.slogan
  form.loginBranding.description = next.loginBranding.description
  form.loginBranding.logo = next.loginBranding.logo
  form.loginBranding.siteTag = next.loginBranding.siteTag
  form.loginBranding.announcement = next.loginBranding.announcement
  form.loginBranding.headerLoginText = next.loginBranding.headerLoginText
  form.loginBranding.authKicker = next.loginBranding.authKicker
  form.loginBranding.authTitle = next.loginBranding.authTitle
  form.loginBranding.authSafeNote = next.loginBranding.authSafeNote
  form.loginBranding.authFootnote = next.loginBranding.authFootnote
  form.loginBranding.primaryActionText = next.loginBranding.primaryActionText
  form.loginBranding.secondaryActionText = next.loginBranding.secondaryActionText
  form.loginBranding.secondaryActionUrl = next.loginBranding.secondaryActionUrl
  form.loginBranding.scrollCueText = next.loginBranding.scrollCueText
  form.loginBranding.metricsSectionKicker = next.loginBranding.metricsSectionKicker
  form.loginBranding.metricsSectionTitle = next.loginBranding.metricsSectionTitle
  form.loginBranding.aboutSectionKicker = next.loginBranding.aboutSectionKicker
  form.loginBranding.capabilitiesSectionKicker = next.loginBranding.capabilitiesSectionKicker
  form.loginBranding.capabilitiesSectionTitle = next.loginBranding.capabilitiesSectionTitle
  form.loginBranding.leadersSectionKicker = next.loginBranding.leadersSectionKicker
  form.loginBranding.leadersSectionTitle = next.loginBranding.leadersSectionTitle
  form.loginBranding.backgroundImage = next.loginBranding.backgroundImage
  form.loginBranding.navItems = next.loginBranding.navItems.map((item) => ({ ...item }))
  form.loginBranding.metrics = next.loginBranding.metrics.map((item) => ({ ...item }))
  form.loginBranding.trustBadges = next.loginBranding.trustBadges.map((item) => ({ ...item }))
  form.loginBranding.businessChain = next.loginBranding.businessChain.map((item) => ({ ...item }))
  form.loginBranding.capabilities = next.loginBranding.capabilities.map((item) => ({ ...item }))
  form.loginBranding.carouselImages = next.loginBranding.carouselImages.map((item) => ({ ...item }))
  form.loginBranding.leaders = next.loginBranding.leaders.map((item) => ({ ...item }))
  form.loginBranding.footerText = next.loginBranding.footerText
  form.loginBranding.icpText = next.loginBranding.icpText
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

.settings-actions {
  margin-top: 18px;
}

.theme-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preset-colors {
  display: flex;
  gap: 8px;
}

.color-block {
  width: 22px;
  height: 22px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
}

.upload-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  width: 100%;
}

.logo-config {
  display: grid;
  gap: 12px;
  width: 100%;
}

.favicon-config {
  display: grid;
  gap: 12px;
  width: 100%;
}

.logo-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}

.logo-preview__frame {
  width: 64px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: #fff;
  box-sizing: border-box;
}

.logo-preview__frame img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.logo-preview strong {
  display: block;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.logo-preview p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.favicon-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}

.favicon-preview__frame {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: #fff;
  box-sizing: border-box;
}

.favicon-preview__frame img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.favicon-preview strong {
  display: block;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.favicon-preview p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.double-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.38fr) minmax(260px, 0.62fr);
  gap: 12px;
  width: 100%;
}

.dynamic-panel {
  display: grid;
  gap: 12px;
  width: 100%;
}

.dynamic-item {
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 10px;
  background: var(--el-fill-color-extra-light);
}

.leader-item {
  background: color-mix(in srgb, var(--el-color-primary) 6%, #ffffff);
}

.inline-item {
  display: grid;
  grid-template-columns: minmax(160px, 0.35fr) minmax(220px, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 10px;
  background: var(--el-fill-color-extra-light);
}

.compact-inline {
  grid-template-columns: minmax(220px, 1fr) auto;
}

.item-actions {
  display: flex;
  gap: 10px;
}

.add-btn {
  width: fit-content;
}

@media (max-width: 768px) {
  .upload-row,
  .double-row,
  .inline-item {
    grid-template-columns: 1fr;
  }

  .logo-preview {
    align-items: flex-start;
  }
}
</style>
