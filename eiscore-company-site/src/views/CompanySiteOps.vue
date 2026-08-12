<template>
  <div class="company-site-ops" data-guide="company-site-ops">
    <header class="page-header">
      <div class="page-heading">
        <div class="eyebrow"><span class="eyebrow-dot"></span>企业站点运营</div>
        <h1>把官网内容、线索与发布流程放进 EISCore</h1>
        <p>统一管理独立站的品牌资料、内容资产、搜索优化和销售线索，并沿用系统权限与主题。</p>
      </div>
      <div class="page-actions">
        <el-tag :type="siteStatusType(site?.status)" effect="plain" class="status-pill">
          {{ siteStatusText(site?.status) }}
        </el-tag>
        <el-button :loading="loading" @click="loadAll">
          <el-icon><Refresh /></el-icon>
          刷新数据
        </el-button>
        <el-button v-if="canManage" type="primary" :loading="publishingSite" @click="publishSite">
          <el-icon><Promotion /></el-icon>
          发布站点
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="loadError"
      class="load-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="loadError"
    />

    <el-row :gutter="16" class="summary-grid">
      <el-col v-for="card in summaryCards" :key="card.key" :xs="12" :sm="6">
        <el-card shadow="never" class="summary-card" :class="`summary-${card.tone}`">
          <div class="summary-card-top">
            <span class="summary-label">{{ card.label }}</span>
            <span class="summary-icon"><el-icon><component :is="card.icon" /></el-icon></span>
          </div>
          <div class="summary-value">{{ card.value }}</div>
          <div class="summary-foot">{{ card.foot }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="workspace-card">
      <div class="workspace-tabs-wrap">
        <el-tabs v-model="activeSection" class="workspace-tabs">
          <el-tab-pane name="overview">
            <template #label><span><el-icon><DataBoard /></el-icon>运营总览</span></template>
          </el-tab-pane>
          <el-tab-pane name="content">
            <template #label><span><el-icon><Collection /></el-icon>内容资产</span></template>
          </el-tab-pane>
          <el-tab-pane name="leads">
            <template #label><span><el-icon><User /></el-icon>询盘线索</span></template>
          </el-tab-pane>
          <el-tab-pane name="seo">
            <template #label><span><el-icon><TrendCharts /></el-icon>SEO / GEO</span></template>
          </el-tab-pane>
          <el-tab-pane name="settings">
            <template #label><span><el-icon><Setting /></el-icon>站点设置</span></template>
          </el-tab-pane>
        </el-tabs>
      </div>

      <section v-if="activeSection === 'overview'" class="overview-section">
        <div class="overview-banner">
          <div class="banner-mark"><el-icon><Promotion /></el-icon></div>
          <div class="banner-copy">
            <div class="banner-title">{{ site?.brandName || site?.legalName || '企业站点' }}</div>
            <div class="banner-subtitle">
              {{ site?.domain || '尚未配置站点域名' }} · 默认语言 {{ site?.defaultLocale || 'zh-CN' }} · 模板 {{ site?.template || 'manufacturer-editorial-v1' }}
            </div>
          </div>
          <div class="banner-meta">
            <span>已发布版本</span>
            <strong>v{{ site?.publishedVersion || 0 }}</strong>
          </div>
        </div>

        <div class="overview-grid">
          <div class="overview-panel">
            <div class="panel-heading">
              <div><h2>运营链路</h2><p>从内容准备到站点发布的当前状态</p></div>
              <el-tag type="success" effect="light">EISCore 内部模块</el-tag>
            </div>
            <div class="flow-line">
              <div v-for="step in operationSteps" :key="step.key" class="flow-step" :class="`is-${step.state}`">
                <span class="flow-step-icon"><el-icon><component :is="step.icon" /></el-icon></span>
                <span class="flow-step-name">{{ step.name }}</span>
                <span class="flow-step-state">{{ step.stateText }}</span>
              </div>
            </div>
          </div>

          <div class="overview-panel attention-panel">
            <div class="panel-heading">
              <div><h2>今日关注</h2><p>优先处理影响公开站点的事项</p></div>
              <el-icon class="panel-heading-icon"><Warning /></el-icon>
            </div>
            <div v-if="attentionItems.length" class="attention-list">
              <div v-for="item in attentionItems" :key="item.key" class="attention-item">
                <span class="attention-dot" :class="`dot-${item.tone}`"></span>
                <span class="attention-text">{{ item.text }}</span>
                <el-button link type="primary" @click="activeSection = item.section">处理</el-button>
              </div>
            </div>
            <el-empty v-else description="暂无需要立即处理的事项" :image-size="58" />
          </div>
        </div>

        <div class="recent-panel">
          <div class="panel-heading">
            <div><h2>最近更新</h2><p>内容资产的最近编辑记录</p></div>
            <el-button link type="primary" @click="activeSection = 'content'">查看全部</el-button>
          </div>
          <el-table v-if="recentContentRows.length" :data="recentContentRows" size="small" class="ops-table" table-layout="fixed">
            <el-table-column prop="title" label="内容" min-width="220" show-overflow-tooltip />
            <el-table-column prop="typeText" label="类型" width="110" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><el-tag size="small" :type="statusTagType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="180">
              <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无内容资产" :image-size="70" />
        </div>
      </section>

      <section v-else-if="activeSection === 'content'" class="content-section">
        <div class="section-toolbar">
          <div>
            <h2>内容资产</h2>
            <p>页面、产品、行业方案、案例、证据和知识库统一维护，保存后进入草稿状态。</p>
          </div>
          <div class="toolbar-actions">
            <el-select v-model="activeContentType" class="content-type-select" @change="loadContent(activeContentType)">
              <el-option v-for="type in contentTypes" :key="type.key" :label="type.label" :value="type.key" />
            </el-select>
            <el-button v-if="canManage" type="primary" @click="newContent(activeContentType)">
              <el-icon><Plus /></el-icon>新建{{ activeContentTypeLabel }}
            </el-button>
          </div>
        </div>

        <el-table v-loading="contentLoading" :data="activeContentRows" class="ops-table content-table" table-layout="fixed">
          <el-table-column label="名称 / 标识" min-width="230" show-overflow-tooltip>
            <template #default="{ row }">{{ contentTitle(row, activeContentType) }}</template>
          </el-table-column>
          <el-table-column label="语言 / 路径" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ contentMeta(row, activeContentType) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><el-tag size="small" :type="statusTagType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="{ row }">{{ formatDate(row.updatedAt || row.updated_at) }}</template>
          </el-table-column>
          <el-table-column v-if="canManage" label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="editContent(activeContentType, row)">编辑</el-button>
              <el-button v-if="nextStatus(row, activeContentType)" link type="primary" @click="advanceContentStatus(activeContentType, row)">
                {{ nextStatusLabel(row, activeContentType) }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!contentLoading && !activeContentRows.length" description="当前内容类型暂无记录" :image-size="90" />
      </section>

      <section v-else-if="activeSection === 'leads'" class="leads-section">
        <div class="section-toolbar">
          <div>
            <h2>询盘线索</h2>
            <p>承接独立站公开表单和 Agent 会话产生的线索，后续可继续进入销售模块处理。</p>
          </div>
          <el-button @click="loadLeads" :loading="leadsLoading"><el-icon><Refresh /></el-icon>刷新线索</el-button>
        </div>
        <el-table v-loading="leadsLoading" :data="leads" class="ops-table leads-table" table-layout="fixed">
          <el-table-column label="线索编号" width="175" show-overflow-tooltip><template #default="{ row }">{{ row.publicRef || row.public_ref || '-' }}</template></el-table-column>
          <el-table-column label="企业 / 联系人" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ row.companyName || row.company_name || '-' }} / {{ row.contactName || row.contact_name || '-' }}</template>
          </el-table-column>
          <el-table-column label="联系方式" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.email || row.phone || row.whatsapp || '-' }}</template>
          </el-table-column>
          <el-table-column prop="country" label="国家/地区" width="110" show-overflow-tooltip />
          <el-table-column label="来源" width="110"><template #default="{ row }">{{ row.source || 'website' }}</template></el-table-column>
          <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag size="small" :type="leadStatusType(row.status)" effect="light">{{ leadStatusText(row.status) }}</el-tag></template></el-table-column>
          <el-table-column label="提交时间" width="170"><template #default="{ row }">{{ formatDate(row.createdAt || row.created_at) }}</template></el-table-column>
        </el-table>
        <el-empty v-if="!leadsLoading && !leads.length" description="暂无站点询盘线索" :image-size="90" />
      </section>

      <section v-else-if="activeSection === 'seo'" class="seo-section">
        <div class="section-toolbar">
          <div>
            <h2>SEO / GEO 质量检查</h2>
            <p>检查页面元数据、canonical、robots 和公开内容的可发现性，结果会保留在审计链路中。</p>
          </div>
          <el-button v-if="canManage" type="primary" :loading="seoLoading" @click="runSeoCheck"><el-icon><TrendCharts /></el-icon>运行检查</el-button>
        </div>
        <div class="seo-overview">
          <div class="seo-score-card">
            <span class="seo-score-label">最近一次检查</span>
            <strong>{{ seoSummary.label }}</strong>
            <span>{{ seoSummary.detail }}</span>
          </div>
          <div class="seo-stat"><span>问题总数</span><strong>{{ seoSummary.total }}</strong></div>
          <div class="seo-stat"><span>严重 / 错误</span><strong class="is-danger">{{ seoSummary.critical }}</strong></div>
          <div class="seo-stat"><span>已解决</span><strong class="is-success">{{ seoSummary.resolved }}</strong></div>
        </div>
        <el-table v-loading="seoLoading" :data="seoChecks" class="ops-table" table-layout="fixed">
          <el-table-column prop="path" label="路径" min-width="190" show-overflow-tooltip />
          <el-table-column label="检查项" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.checkType || row.check_type || '-' }}</template></el-table-column>
          <el-table-column label="级别" width="110"><template #default="{ row }"><el-tag size="small" :type="severityTagType(row.severity)" effect="light">{{ severityText(row.severity) }}</el-tag></template></el-table-column>
          <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag size="small" :type="row.status === 'resolved' ? 'success' : 'danger'" effect="light">{{ row.status === 'resolved' ? '已解决' : '待处理' }}</el-tag></template></el-table-column>
          <el-table-column label="详情" min-width="280" show-overflow-tooltip><template #default="{ row }">{{ detailText(row.details) }}</template></el-table-column>
          <el-table-column label="检查时间" width="170"><template #default="{ row }">{{ formatDate(row.checkedAt || row.checked_at) }}</template></el-table-column>
        </el-table>
        <el-empty v-if="!seoLoading && !seoChecks.length" description="暂未运行 SEO 检查" :image-size="90" />
      </section>

      <section v-else class="settings-section">
        <div class="section-toolbar">
          <div>
            <h2>站点设置</h2>
            <p>配置企业品牌、域名、默认语言和主题扩展数据；保存后需要重新发布才会进入公开站点。</p>
          </div>
          <div class="toolbar-actions">
            <el-tag type="info" effect="plain">主题跟随系统</el-tag>
            <el-button v-if="canManage" type="primary" :loading="savingSite" @click="saveSite">保存设置</el-button>
          </div>
        </div>
        <el-form :model="siteForm" label-position="top" class="site-form">
          <div class="form-grid form-grid-three">
            <el-form-item label="企业法定名称"><el-input v-model="siteForm.legalName" placeholder="例如：君乐缘食品有限公司" /></el-form-item>
            <el-form-item label="品牌名称"><el-input v-model="siteForm.brandName" placeholder="公开站点显示名称" /></el-form-item>
            <el-form-item label="品牌简称"><el-input v-model="siteForm.brandShortName" placeholder="导航栏短名称" /></el-form-item>
            <el-form-item label="工厂名称"><el-input v-model="siteForm.factoryName" placeholder="工厂或生产基地名称" /></el-form-item>
            <el-form-item label="站点域名"><el-input v-model="siteForm.domain" placeholder="例如：www.example.com" /></el-form-item>
            <el-form-item label="默认语言"><el-input v-model="siteForm.defaultLocale" placeholder="zh-CN" /></el-form-item>
          </div>
          <div class="form-grid form-grid-two">
            <el-form-item label="启用语言 JSON"><el-input v-model="siteForm.enabledLocalesText" type="textarea" :rows="4" placeholder='["zh-CN", "en-US"]' /></el-form-item>
            <el-form-item label="品牌主题扩展 JSON"><el-input v-model="siteForm.themeText" type="textarea" :rows="4" placeholder='{"accent":"#409eff"}' /></el-form-item>
            <el-form-item label="联系方式 JSON"><el-input v-model="siteForm.contactText" type="textarea" :rows="5" placeholder='{"email":"sales@example.com"}' /></el-form-item>
            <el-form-item label="站点 SEO JSON"><el-input v-model="siteForm.seoText" type="textarea" :rows="5" placeholder='{"title":"企业官网"}' /></el-form-item>
          </div>
        </el-form>
      </section>
    </el-card>

    <el-dialog v-model="editDialogVisible" :title="editingId ? `编辑${activeContentTypeLabel}` : `新建${activeContentTypeLabel}`" width="min(760px, calc(100vw - 28px))" class="ops-dialog" destroy-on-close>
      <el-form :model="editingForm" label-position="top" class="content-form">
        <div class="form-grid form-grid-two">
          <el-form-item v-if="hasLocaleField" label="语言" required><el-input v-model="editingForm.locale" placeholder="zh-CN" /></el-form-item>
          <el-form-item v-if="hasSlugField" label="Slug / 路径" required><el-input v-model="editingForm.slugOrPath" placeholder="about-us 或 /company/" /></el-form-item>
          <el-form-item v-if="editingType === 'product'" label="产品编号" required><el-input v-model="editingForm.productCode" placeholder="产品唯一编号" /></el-form-item>
          <el-form-item v-if="editingType === 'product'" label="产品分类"><el-input v-model="editingForm.category" placeholder="按产品线或应用分类" /></el-form-item>
          <el-form-item v-if="editingType === 'page'" label="页面类型"><el-input v-model="editingForm.pageType" placeholder="page / landing / home" /></el-form-item>
          <el-form-item v-if="editingType === 'knowledge'" label="文档类型"><el-input v-model="editingForm.documentType" placeholder="faq / policy / product" /></el-form-item>
          <el-form-item v-if="editingType === 'case'" label="公开级别"><el-select v-model="editingForm.publicLevel" style="width:100%"><el-option label="公开" value="named" /><el-option label="匿名公开" value="anonymous" /><el-option label="内部" value="internal" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'solution' || editingType === 'case'" label="行业"><el-input v-model="editingForm.industry" placeholder="食品、制造、零售等" /></el-form-item>
          <el-form-item v-if="editingType === 'evidence'" label="来源类型"><el-input v-model="editingForm.sourceType" placeholder="internal_document / certificate" /></el-form-item>
          <el-form-item v-if="editingType === 'evidence'" label="来源引用"><el-input v-model="editingForm.sourceRef" placeholder="文件编号、证书编号或内部链接" /></el-form-item>
        </div>

        <el-form-item v-if="hasTitleField" label="标题" required><el-input v-model="editingForm.title" placeholder="公开展示标题" /></el-form-item>
        <el-form-item v-if="editingType === 'evidence'" label="可验证声明" required><el-input v-model="editingForm.claim" type="textarea" :rows="3" placeholder="只能填写可被证据支持的事实" /></el-form-item>
        <el-form-item v-if="editingType === 'solution'" label="应用场景"><el-input v-model="editingForm.scenario" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'case'" label="项目范围"><el-input v-model="editingForm.scope" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'page' || editingType === 'solution' || editingType === 'case'" label="摘要 / 说明"><el-input v-model="editingForm.summary" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'knowledge'" label="知识内容" required><el-input v-model="editingForm.content" type="textarea" :rows="8" /></el-form-item>

        <div v-if="editingType === 'product'" class="form-grid form-grid-two">
          <el-form-item label="应用范围 JSON"><el-input v-model="editingForm.applicationsText" type="textarea" :rows="4" placeholder='["烘焙", "餐饮"]' /></el-form-item>
          <el-form-item label="规格 JSON"><el-input v-model="editingForm.specificationsText" type="textarea" :rows="4" placeholder='{"capacity":""}' /></el-form-item>
          <el-form-item label="交付 JSON"><el-input v-model="editingForm.deliveryText" type="textarea" :rows="4" placeholder='{"leadTime":""}' /></el-form-item>
          <el-form-item label="证据 ID JSON"><el-input v-model="editingForm.evidenceIdsText" type="textarea" :rows="4" placeholder='[]' /></el-form-item>
        </div>
        <div v-if="editingType === 'page'" class="form-grid form-grid-two">
          <el-form-item label="页面区块 JSON"><el-input v-model="editingForm.blocksText" type="textarea" :rows="6" placeholder='[{"type":"hero","title":""}]' /></el-form-item>
          <el-form-item label="页面 SEO JSON"><el-input v-model="editingForm.seoText" type="textarea" :rows="6" placeholder='{"title":"","description":""}' /></el-form-item>
        </div>
        <div v-if="editingType === 'solution' || editingType === 'case'" class="form-grid form-grid-two">
          <el-form-item label="内容 JSON"><el-input v-model="editingForm.contentText" type="textarea" :rows="6" placeholder='{"challenge":"","result":""}' /></el-form-item>
          <el-form-item label="SEO JSON"><el-input v-model="editingForm.seoText" type="textarea" :rows="6" placeholder='{"title":"","description":""}' /></el-form-item>
        </div>
        <div v-if="editingType === 'evidence' || editingType === 'knowledge'" class="form-grid form-grid-two">
          <el-form-item v-if="editingType === 'evidence'" label="证据 JSON"><el-input v-model="editingForm.evidenceText" type="textarea" :rows="5" placeholder='{"document":"","page":""}' /></el-form-item>
          <el-form-item v-if="editingType === 'evidence'" label="有效期"><el-input v-model="editingForm.expiresAt" placeholder="2027-12-31" /></el-form-item>
          <el-form-item v-if="editingType === 'knowledge'" label="引用 JSON"><el-input v-model="editingForm.citationsText" type="textarea" :rows="5" placeholder='[]' /></el-form-item>
          <el-form-item v-if="editingType === 'knowledge'" label="禁用声明 JSON"><el-input v-model="editingForm.forbiddenClaimsText" type="textarea" :rows="5" placeholder='[]' /></el-form-item>
        </div>
        <div v-if="editingType === 'seo'" class="form-grid form-grid-two">
          <el-form-item label="页面标题" required><el-input v-model="editingForm.title" /></el-form-item>
          <el-form-item label="Robots"><el-input v-model="editingForm.robots" placeholder="index,follow" /></el-form-item>
          <el-form-item label="描述"><el-input v-model="editingForm.description" type="textarea" :rows="4" /></el-form-item>
          <el-form-item label="Canonical"><el-input v-model="editingForm.canonical" placeholder="https://example.com/company/" /></el-form-item>
          <el-form-item label="关键词 JSON"><el-input v-model="editingForm.keywordsText" type="textarea" :rows="4" placeholder='["食品工厂"]' /></el-form-item>
          <el-form-item label="结构化数据 JSON"><el-input v-model="editingForm.structuredDataText" type="textarea" :rows="4" placeholder='{"@type":"Organization"}' /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingContent" @click="saveContent">保存草稿</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Collection,
  DataBoard,
  Document,
  Edit,
  Plus,
  Promotion,
  Refresh,
  Setting,
  TrendCharts,
  User,
  Warning
} from '@element-plus/icons-vue'
import request from '@/utils/request'
import { getUserInfo } from '@/utils/auth'

const COMPANY_SITE_READ_ROLES = new Set([
  'super_admin', 'admin', 'company_site_admin', 'site_admin', 'content_editor',
  'content_reviewer', 'sales_manager', 'sales_owner', 'sales'
])
const COMPANY_SITE_MANAGE_ROLES = new Set([
  'super_admin', 'admin', 'company_site_admin', 'site_admin', 'content_reviewer'
])
const COMPANY_SITE_SCOPES = ['company_site', 'company-site', 'companysite', 'site_content']
const READ_ACTIONS = ['read', 'view', 'list', 'manage', 'admin']
const MANAGE_ACTIONS = ['write', 'publish', 'manage', 'admin']

const activeSection = ref('overview')
const activeContentType = ref('pages')
const loading = ref(false)
const contentLoading = ref(false)
const leadsLoading = ref(false)
const seoLoading = ref(false)
const savingSite = ref(false)
const publishingSite = ref(false)
const savingContent = ref(false)
const editDialogVisible = ref(false)
const editingType = ref('page')
const editingId = ref('')
const loadError = ref('')
const canRead = ref(false)
const canManage = ref(false)
const site = ref(null)
const leads = ref([])
const seoChecks = ref([])
const contentCollections = reactive({
  pages: [],
  products: [],
  solutions: [],
  cases: [],
  evidence: [],
  knowledge: [],
  seo: []
})

const contentTypes = [
  { key: 'pages', label: '页面', singular: 'page' },
  { key: 'products', label: '产品', singular: 'product' },
  { key: 'solutions', label: '行业方案', singular: 'solution' },
  { key: 'cases', label: '客户案例', singular: 'case' },
  { key: 'evidence', label: '证据记录', singular: 'evidence' },
  { key: 'knowledge', label: '知识文档', singular: 'knowledge' },
  { key: 'seo', label: 'SEO 元数据', singular: 'seo' }
]

const emptyContentForm = () => ({
  locale: 'zh-CN',
  slugOrPath: '',
  pageType: 'page',
  productCode: '',
  category: '',
  title: '',
  summary: '',
  industry: '',
  scenario: '',
  scope: '',
  publicLevel: 'anonymous',
  sourceType: 'internal_document',
  sourceRef: '',
  claim: '',
  expiresAt: '',
  documentType: 'faq',
  content: '',
  description: '',
  canonical: '',
  robots: 'index,follow',
  applicationsText: '[]',
  specificationsText: '{}',
  deliveryText: '{}',
  evidenceIdsText: '[]',
  blocksText: '[]',
  contentText: '{}',
  seoText: '{}',
  evidenceText: '{}',
  citationsText: '[]',
  forbiddenClaimsText: '[]',
  keywordsText: '[]',
  structuredDataText: '{}'
})

const editingForm = reactive(emptyContentForm())

const activeContentTypeInfo = computed(() => contentTypes.find((item) => item.key === activeContentType.value) || contentTypes[0])
const activeContentTypeLabel = computed(() => activeContentTypeInfo.value.label)
const activeContentRows = computed(() => contentCollections[activeContentType.value] || [])
const hasLocaleField = computed(() => ['pages', 'solutions', 'cases', 'knowledge', 'seo'].includes(activeContentType.value) || ['page', 'solution', 'case', 'knowledge', 'seo'].includes(editingType.value))
const hasSlugField = computed(() => ['pages', 'solutions', 'cases'].includes(activeContentType.value) || ['page', 'solution', 'case'].includes(editingType.value))
const hasTitleField = computed(() => ['pages', 'solutions', 'cases', 'knowledge', 'seo'].includes(activeContentType.value) || ['page', 'solution', 'case', 'knowledge', 'seo'].includes(editingType.value))

const allContentRows = computed(() => Object.entries(contentCollections).flatMap(([type, rows]) => (rows || []).map((row) => ({
  ...row,
  _type: type,
  typeText: contentTypes.find((item) => item.key === type)?.label || type,
  title: contentTitle(row, type),
  updatedAt: row.updatedAt || row.updated_at || ''
}))))

const recentContentRows = computed(() => [...allContentRows.value]
  .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  .slice(0, 6))

const contentCount = computed(() => allContentRows.value.length)
const publishedContentCount = computed(() => allContentRows.value.filter((row) => row.status === 'published').length)
const newLeadCount = computed(() => leads.value.filter((row) => row.status === 'new').length)
const seoOpenCount = computed(() => seoChecks.value.filter((row) => row.status !== 'resolved').length)

const summaryCards = computed(() => [
  { key: 'content', label: '内容资产', value: contentCount.value, foot: `${publishedContentCount.value} 条已发布`, tone: 'blue', icon: Collection },
  { key: 'leads', label: '询盘线索', value: leads.value.length, foot: `${newLeadCount.value} 条待跟进`, tone: 'green', icon: User },
  { key: 'published', label: '站点版本', value: `v${site.value?.publishedVersion || 0}`, foot: siteStatusText(site.value?.status), tone: 'purple', icon: Promotion },
  { key: 'seo', label: 'SEO 待处理', value: seoOpenCount.value, foot: seoOpenCount.value ? '建议及时修复' : '当前无问题', tone: seoOpenCount.value ? 'orange' : 'green', icon: TrendCharts }
])

const siteForm = reactive({
  legalName: '',
  brandName: '',
  brandShortName: '',
  factoryName: '',
  domain: '',
  defaultLocale: 'zh-CN',
  enabledLocalesText: '["zh-CN"]',
  themeText: '{}',
  contactText: '{}',
  seoText: '{}'
})

const operationSteps = computed(() => {
  const hasDraft = allContentRows.value.some((row) => row.status === 'draft')
  const hasReview = allContentRows.value.some((row) => ['review', 'approved'].includes(row.status))
  const isPublished = site.value?.status === 'published'
  return [
    { key: 'content', name: '内容准备', icon: Collection, state: hasDraft ? 'attention' : 'done', stateText: hasDraft ? '有草稿' : '已就绪' },
    { key: 'review', name: '审核校验', icon: Document, state: hasReview ? 'attention' : 'done', stateText: hasReview ? '待审核' : '已通过' },
    { key: 'publish', name: '站点发布', icon: Promotion, state: isPublished ? 'done' : 'attention', stateText: isPublished ? '已发布' : '待发布' },
    { key: 'leads', name: '线索承接', icon: User, state: leads.value.length ? 'done' : 'idle', stateText: leads.value.length ? '持续沉淀' : '等待线索' }
  ]
})

const attentionItems = computed(() => {
  const items = []
  if (site.value?.status !== 'published') items.push({ key: 'site', text: '站点配置尚未发布，公开站点可能仍使用旧版本。', section: 'settings', tone: 'orange' })
  if (allContentRows.value.some((row) => row.status === 'draft')) items.push({ key: 'draft', text: '存在未提交审核的内容草稿。', section: 'content', tone: 'blue' })
  if (seoOpenCount.value) items.push({ key: 'seo', text: `SEO 检查发现 ${seoOpenCount.value} 项待处理问题。`, section: 'seo', tone: 'red' })
  if (newLeadCount.value) items.push({ key: 'lead', text: `有 ${newLeadCount.value} 条新线索等待跟进。`, section: 'leads', tone: 'green' })
  return items.slice(0, 4)
})

const seoSummary = computed(() => {
  const total = seoChecks.value.length
  const critical = seoChecks.value.filter((row) => ['critical', 'error'].includes(row.severity)).length
  const resolved = seoChecks.value.filter((row) => row.status === 'resolved').length
  return {
    total,
    critical,
    resolved,
    label: total ? (critical ? '需要修复' : '基础检查通过') : '尚未检查',
    detail: total ? `${resolved}/${total} 项已解决` : '运行一次检查即可生成结果'
  }
})

const textValue = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback
  return String(value)
}

const parseJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value
  try {
    const parsed = JSON.parse(String(value || ''))
    return parsed === null || parsed === undefined ? fallback : parsed
  } catch {
    return fallback
  }
}

const jsonText = (value, fallback = {}) => JSON.stringify(value === undefined || value === null ? fallback : value, null, 2)

const syncSiteForm = (value) => {
  const next = value || {}
  siteForm.legalName = textValue(next.legalName || next.legal_name)
  siteForm.brandName = textValue(next.brandName || next.brand_name)
  siteForm.brandShortName = textValue(next.brandShortName || next.brand_short_name)
  siteForm.factoryName = textValue(next.factoryName || next.factory_name)
  siteForm.domain = textValue(next.domain)
  siteForm.defaultLocale = textValue(next.defaultLocale || next.default_locale, 'zh-CN')
  siteForm.enabledLocalesText = jsonText(next.enabledLocales || next.enabled_locales || ['zh-CN'], ['zh-CN'])
  siteForm.themeText = jsonText(next.theme, {})
  siteForm.contactText = jsonText(next.contact, {})
  siteForm.seoText = jsonText(next.seo, {})
}

const siteStatusText = (value) => ({
  draft: '草稿待发布',
  published: '已发布',
  suspended: '已暂停',
  archived: '已归档'
}[value] || '未配置')

const siteStatusType = (value) => ({ published: 'success', suspended: 'warning', archived: 'info', draft: 'warning' }[value] || 'info')

const statusText = (value) => ({
  draft: '草稿',
  review: '待审核',
  approved: '已审核',
  published: '已发布',
  expired: '已过期',
  archived: '已归档'
}[value] || value || '未知')

const statusTagType = (value) => ({
  draft: 'info',
  review: 'warning',
  approved: 'success',
  published: 'success',
  expired: 'danger',
  archived: 'info'
}[value] || 'info')

const leadStatusText = (value) => ({
  new: '新线索', qualified: '已筛选', assigned: '已分配', contacted: '已联系', won: '已成交', lost: '已流失', spam: '垃圾线索', archived: '已归档'
}[value] || value || '未知')

const leadStatusType = (value) => ({ new: 'warning', qualified: 'primary', assigned: 'primary', contacted: 'success', won: 'success', lost: 'info', spam: 'danger', archived: 'info' }[value] || 'info')

const severityText = (value) => ({ critical: '严重', error: '错误', warning: '警告', info: '提示' }[value] || value || '提示')
const severityTagType = (value) => ({ critical: 'danger', error: 'danger', warning: 'warning', info: 'info' }[value] || 'info')

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return textValue(value)
  return date.toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-')
}

const detailText = (value) => {
  if (!value) return '-'
  if (typeof value === 'string') return value
  return value.message || value.detail || Object.values(value).find((item) => typeof item === 'string') || '检查结果已记录'
}

const contentTitle = (row, type) => {
  if (!row) return '-'
  if (type === 'pages') return row.title || row.slug || '-'
  if (type === 'products') return row.productCode || row.product_code || row.slug || '-'
  if (type === 'evidence') return row.claim || row.sourceRef || '-'
  return row.title || row.slug || row.path || row.documentType || '-'
}

const contentMeta = (row, type) => {
  if (!row) return '-'
  if (type === 'products') return row.category || row.slug || '-'
  if (type === 'evidence') return row.sourceType || '-'
  return row.locale || row.path || '-'
}

const refreshAuthState = () => {
  const info = getUserInfo()
  const roles = [info.app_role, info.appRole, info.role, info.role_code, info.roleCode, info.dbRole, info.db_role]
    .map((value) => textValue(value).trim().toLowerCase())
  const permissions = Array.isArray(info.permissions) ? info.permissions : []
  const hasScopedPermission = (actions) => permissions.some((permission) => {
    const value = textValue(permission).trim().toLowerCase()
    if (value === '*') return true
    const scoped = COMPANY_SITE_SCOPES.some((scope) => value === scope || value.includes(`${scope}:`) || value.includes(`${scope}.`) || value.includes(`${scope}/`))
    return scoped && actions.some((action) => value === action || value.includes(`:${action}`) || value.includes(`.${action}`) || value.includes(`/${action}`) || value.includes(action))
  })
  canRead.value = roles.some((role) => COMPANY_SITE_READ_ROLES.has(role)) || hasScopedPermission(READ_ACTIONS)
  canManage.value = roles.some((role) => COMPANY_SITE_MANAGE_ROLES.has(role)) || hasScopedPermission(MANAGE_ACTIONS)
}

const loadSite = async () => {
  const response = await request.get('/company-site/admin/site-config')
  site.value = response?.site || null
  syncSiteForm(site.value)
}

const loadContent = async (type = activeContentType.value) => {
  if (!contentCollections[type]) return
  contentLoading.value = true
  try {
    const response = await request.get(`/company-site/admin/${type}`, { params: { limit: 200 } })
    contentCollections[type] = Array.isArray(response?.items) ? response.items : []
  } finally {
    contentLoading.value = false
  }
}

const loadContentCatalog = async () => {
  await Promise.all(contentTypes.map((type) => loadContent(type.key)))
}

const loadLeads = async () => {
  leadsLoading.value = true
  try {
    const response = await request.get('/company-site/admin/leads', { params: { limit: 200 } })
    leads.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    leadsLoading.value = false
  }
}

const loadSeoChecks = async () => {
  seoLoading.value = true
  try {
    const response = await request.get('/company-site/admin/seo/checks', { params: { limit: 200 } })
    seoChecks.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    seoLoading.value = false
  }
}

const loadAll = async () => {
  refreshAuthState()
  if (!canRead.value) {
    loadError.value = '当前账号没有企业站点运营权限，请联系管理员分配站点读取权限。'
    return
  }
  loading.value = true
  loadError.value = ''
  const results = await Promise.allSettled([loadSite(), loadContentCatalog(), loadLeads(), loadSeoChecks()])
  const failed = results.find((item) => item.status === 'rejected')
  if (failed) loadError.value = '部分运营数据暂时无法加载，请检查运行时服务或稍后重试。'
  loading.value = false
}

const saveSite = async () => {
  if (!canManage.value) return
  const enabledLocales = parseJson(siteForm.enabledLocalesText, [])
  if (!Array.isArray(enabledLocales) || !enabledLocales.length) {
    ElMessage.warning('启用语言必须是至少包含一种语言的 JSON 数组')
    return
  }
  savingSite.value = true
  try {
    const response = await request.patch('/company-site/admin/site-config', {
      legalName: siteForm.legalName,
      brandName: siteForm.brandName,
      brandShortName: siteForm.brandShortName,
      factoryName: siteForm.factoryName,
      domain: siteForm.domain,
      defaultLocale: siteForm.defaultLocale,
      enabledLocales,
      theme: parseJson(siteForm.themeText, {}),
      contact: parseJson(siteForm.contactText, {}),
      seo: parseJson(siteForm.seoText, {})
    })
    site.value = response?.site || site.value
    syncSiteForm(site.value)
    ElMessage.success('站点设置已保存为草稿')
  } finally {
    savingSite.value = false
  }
}

const publishSite = async () => {
  if (!canManage.value) return
  try {
    await ElMessageBox.confirm('发布后将把当前站点配置切换到公开版本，是否继续？', '确认发布站点', { type: 'warning' })
  } catch {
    return
  }
  publishingSite.value = true
  try {
    const response = await request.post('/company-site/admin/content/publish', { objectType: 'site_config', id: 'primary', status: 'published' })
    if (response?.site) site.value = response.site
    await loadSite()
    ElMessage.success('站点已发布')
  } finally {
    publishingSite.value = false
  }
}

const newContent = (type) => {
  const info = contentTypes.find((item) => item.key === type)
  if (!info || type === 'seo') {
    if (type === 'seo') ElMessage.info('SEO 元数据可通过站点内容或 SEO 检查结果继续维护')
    return
  }
  editingType.value = info.singular
  editingId.value = ''
  Object.assign(editingForm, emptyContentForm())
  editDialogVisible.value = true
}

const readRowValue = (row, camel, snake = '') => row?.[camel] ?? (snake ? row?.[snake] : undefined)

const editContent = (type, row) => {
  const info = contentTypes.find((item) => item.key === type)
  if (!info || !row) return
  editingType.value = info.singular
  editingId.value = textValue(row.id)
  Object.assign(editingForm, emptyContentForm())
  editingForm.locale = textValue(readRowValue(row, 'locale'), 'zh-CN')
  editingForm.slugOrPath = textValue(readRowValue(row, 'slug', 'path'))
  editingForm.pageType = textValue(readRowValue(row, 'pageType', 'page_type'), 'page')
  editingForm.productCode = textValue(readRowValue(row, 'productCode', 'product_code'))
  editingForm.category = textValue(readRowValue(row, 'category'))
  editingForm.title = textValue(readRowValue(row, 'title'))
  editingForm.summary = textValue(readRowValue(row, 'summary'))
  editingForm.industry = textValue(readRowValue(row, 'industry'))
  editingForm.scenario = textValue(readRowValue(row, 'scenario'))
  editingForm.scope = textValue(readRowValue(row, 'scope'))
  editingForm.publicLevel = textValue(readRowValue(row, 'publicLevel', 'public_level'), 'anonymous')
  editingForm.sourceType = textValue(readRowValue(row, 'sourceType', 'source_type'), 'internal_document')
  editingForm.sourceRef = textValue(readRowValue(row, 'sourceRef', 'source_ref'))
  editingForm.claim = textValue(readRowValue(row, 'claim'))
  editingForm.expiresAt = textValue(readRowValue(row, 'expiresAt', 'expires_at'))
  editingForm.documentType = textValue(readRowValue(row, 'documentType', 'document_type'), 'faq')
  editingForm.content = textValue(readRowValue(row, 'content'))
  editingForm.description = textValue(readRowValue(row, 'description'))
  editingForm.canonical = textValue(readRowValue(row, 'canonical'))
  editingForm.robots = textValue(readRowValue(row, 'robots'), 'index,follow')
  editingForm.applicationsText = jsonText(readRowValue(row, 'applications'), [])
  editingForm.specificationsText = jsonText(readRowValue(row, 'specifications'), {})
  editingForm.deliveryText = jsonText(readRowValue(row, 'delivery'), {})
  editingForm.evidenceIdsText = jsonText(readRowValue(row, 'evidenceIds', 'evidence_ids'), [])
  editingForm.blocksText = jsonText(readRowValue(row, 'blocks'), [])
  editingForm.contentText = jsonText(readRowValue(row, 'content'), {})
  editingForm.seoText = jsonText(readRowValue(row, 'seo'), {})
  editingForm.evidenceText = jsonText(readRowValue(row, 'evidence'), {})
  editingForm.citationsText = jsonText(readRowValue(row, 'citations'), [])
  editingForm.forbiddenClaimsText = jsonText(readRowValue(row, 'forbiddenClaims', 'forbidden_claims'), [])
  editingForm.keywordsText = jsonText(readRowValue(row, 'keywords'), [])
  editingForm.structuredDataText = jsonText(readRowValue(row, 'structuredData', 'structured_data'), {})
  editDialogVisible.value = true
}

const buildContentPayload = () => {
  const form = editingForm
  if (editingType.value === 'page') return { locale: form.locale, slug: form.slugOrPath, pageType: form.pageType, title: form.title, summary: form.summary, blocks: parseJson(form.blocksText, []), seo: parseJson(form.seoText, {}) }
  if (editingType.value === 'product') return { productCode: form.productCode, slug: form.slugOrPath, category: form.category, applications: parseJson(form.applicationsText, []), specifications: parseJson(form.specificationsText, {}), delivery: parseJson(form.deliveryText, {}), evidenceIds: parseJson(form.evidenceIdsText, []) }
  if (editingType.value === 'solution') return { locale: form.locale, slug: form.slugOrPath, title: form.title, industry: form.industry, scenario: form.scenario, content: parseJson(form.contentText, {}), seo: parseJson(form.seoText, {}) }
  if (editingType.value === 'case') return { locale: form.locale, slug: form.slugOrPath, title: form.title, industry: form.industry, scope: form.scope, publicLevel: form.publicLevel, content: parseJson(form.contentText, {}), evidenceIds: parseJson(form.evidenceIdsText, []) }
  if (editingType.value === 'evidence') return { claim: form.claim, sourceType: form.sourceType, sourceRef: form.sourceRef, evidence: parseJson(form.evidenceText, {}), expiresAt: form.expiresAt }
  if (editingType.value === 'knowledge') return { locale: form.locale, documentType: form.documentType, title: form.title, content: form.content, citations: parseJson(form.citationsText, []), forbiddenClaims: parseJson(form.forbiddenClaimsText, []), expiresAt: form.expiresAt }
  return { locale: form.locale, path: form.slugOrPath, title: form.title, description: form.description, canonical: form.canonical, robots: form.robots, keywords: parseJson(form.keywordsText, []), structuredData: parseJson(form.structuredDataText, {}) }
}

const saveContent = async () => {
  if (!canManage.value) return
  if (!editingId.value && editingType.value === 'product' && !editingForm.productCode) return ElMessage.warning('请输入产品编号')
  if (!editingId.value && ['page', 'solution', 'case'].includes(editingType.value) && (!editingForm.locale || !editingForm.slugOrPath || !editingForm.title)) return ElMessage.warning('请补充语言、标识和标题')
  if (!editingId.value && editingType.value === 'knowledge' && (!editingForm.locale || !editingForm.title || !editingForm.content)) return ElMessage.warning('请补充语言、标题和知识内容')
  if (!editingId.value && editingType.value === 'evidence' && !editingForm.claim) return ElMessage.warning('请输入可验证声明')
  savingContent.value = true
  try {
    const endpoint = `/company-site/admin/content/${editingType.value}${editingId.value ? `/${editingId.value}` : ''}`
    await request[editingId.value ? 'patch' : 'post'](endpoint, buildContentPayload())
    editDialogVisible.value = false
    await loadContent(activeContentType.value)
    ElMessage.success('内容草稿已保存')
  } finally {
    savingContent.value = false
  }
}

const nextStatus = (row, type) => {
  if (!canManage.value || type === 'seo') return ''
  const status = textValue(row?.status, 'draft')
  const chain = type === 'evidence' ? ['draft', 'approved', 'published', 'archived'] : ['draft', 'review', 'approved', 'published', 'archived']
  const index = chain.indexOf(status)
  return index >= 0 && index < chain.length - 1 ? chain[index + 1] : ''
}

const nextStatusLabel = (row, type) => ({ review: '提交审核', approved: type === 'evidence' ? '审核通过' : '审核通过', published: '发布', archived: '归档' }[nextStatus(row, type)] || '')

const advanceContentStatus = async (type, row) => {
  const status = nextStatus(row, type)
  if (!status) return
  const action = status === 'published' ? '发布' : (status === 'archived' ? '归档' : '推进状态')
  try {
    await ElMessageBox.confirm(`确定将“${contentTitle(row, type)}”${action}吗？`, `确认${action}`, { type: status === 'published' ? 'warning' : 'info' })
  } catch {
    return
  }
  await request.post('/company-site/admin/content/publish', { objectType: contentTypes.find((item) => item.key === type)?.singular || type, id: row.id, status })
  await loadContent(type)
  ElMessage.success(`内容已${action}`)
}

const runSeoCheck = async () => {
  if (!canManage.value) return
  seoLoading.value = true
  try {
    await request.post('/company-site/admin/seo/check', {})
    await loadSeoChecks()
    ElMessage.success('SEO 检查已完成')
  } finally {
    seoLoading.value = false
  }
}

const handleAuthUpdate = () => {
  refreshAuthState()
  if (canRead.value && !site.value) loadAll()
}

onMounted(() => {
  refreshAuthState()
  window.addEventListener('user-info-updated', handleAuthUpdate)
  loadAll()
})

onUnmounted(() => {
  window.removeEventListener('user-info-updated', handleAuthUpdate)
})
</script>

<style scoped>
.company-site-ops {
  min-height: 100vh;
  padding: clamp(16px, 2.2vw, 28px);
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}

.page-header,
.section-toolbar,
.panel-heading,
.summary-card-top,
.overview-banner,
.workspace-tabs-wrap,
.toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header {
  align-items: flex-end;
  margin: 0 auto 20px;
  max-width: 1500px;
}

.page-heading { min-width: 0; }
.eyebrow { display: flex; align-items: center; gap: 8px; color: var(--el-color-primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.eyebrow-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--el-color-primary); box-shadow: 0 0 0 5px var(--el-color-primary-light-9); }
.page-heading h1 { margin: 8px 0 7px; font-size: clamp(21px, 2.4vw, 30px); line-height: 1.2; letter-spacing: -.02em; }
.page-heading p, .section-toolbar p, .panel-heading p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.page-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.status-pill { border-radius: 999px; }
.load-alert { max-width: 1500px; margin: 0 auto 16px; }

.summary-grid, .workspace-card { max-width: 1500px; margin-left: auto; margin-right: auto; }
.summary-card { min-height: 132px; border-radius: 12px; border-color: var(--el-border-color-lighter); transition: transform .18s ease, box-shadow .18s ease; }
.summary-card:hover { transform: translateY(-2px); box-shadow: var(--el-box-shadow-light); }
.summary-label { color: var(--el-text-color-secondary); font-size: 13px; }
.summary-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 9px; color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.summary-green .summary-icon { color: var(--el-color-success); background: var(--el-color-success-light-9); }
.summary-purple .summary-icon { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.summary-orange .summary-icon { color: var(--el-color-warning); background: var(--el-color-warning-light-9); }
.summary-value { margin-top: 12px; font-size: 26px; line-height: 1; font-weight: 750; color: var(--el-text-color-primary); }
.summary-foot { margin-top: 10px; color: var(--el-text-color-secondary); font-size: 12px; }

.workspace-card { margin-top: 16px; border-radius: 14px; border-color: var(--el-border-color-lighter); overflow: hidden; }
.workspace-card :deep(.el-card__body) { padding: 0; }
.workspace-tabs-wrap { padding: 0 20px; border-bottom: 1px solid var(--el-border-color-lighter); }
.workspace-tabs { min-width: 0; }
.workspace-tabs :deep(.el-tabs__header) { margin: 0; }
.workspace-tabs :deep(.el-tabs__item span) { display: inline-flex; align-items: center; gap: 6px; }
.overview-section, .content-section, .leads-section, .seo-section, .settings-section { padding: 22px; }
.overview-banner { padding: 20px 22px; margin-bottom: 18px; border: 1px solid var(--el-color-primary-light-8); border-radius: 12px; background: linear-gradient(120deg, var(--el-color-primary-light-9), var(--el-bg-color)); }
.banner-mark { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 48px; width: 48px; height: 48px; border-radius: 14px; color: #fff; background: var(--el-color-primary); font-size: 24px; box-shadow: 0 8px 18px rgba(var(--el-color-primary-rgb), .22); }
.banner-copy { flex: 1; min-width: 0; }
.banner-title { font-size: 18px; font-weight: 700; }
.banner-subtitle { margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.banner-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; color: var(--el-text-color-secondary); font-size: 12px; }
.banner-meta strong { color: var(--el-color-primary); font-size: 22px; }
.overview-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr); gap: 16px; }
.overview-panel, .recent-panel { padding: 18px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }
.recent-panel { margin-top: 16px; }
.panel-heading { align-items: flex-start; }
.panel-heading h2, .section-toolbar h2 { margin: 0 0 5px; font-size: 16px; }
.panel-heading-icon { color: var(--el-color-warning); font-size: 20px; }
.flow-line { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 24px; }
.flow-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; text-align: center; }
.flow-step:not(:last-child)::after { content: ''; position: absolute; top: 18px; left: calc(50% + 26px); right: calc(-50% + 26px); height: 1px; background: var(--el-border-color); }
.flow-step-icon { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; color: var(--el-text-color-secondary); background: var(--el-fill-color); border: 1px solid var(--el-border-color); }
.flow-step.is-done .flow-step-icon { color: var(--el-color-success); border-color: var(--el-color-success-light-5); background: var(--el-color-success-light-9); }
.flow-step.is-attention .flow-step-icon { color: var(--el-color-warning); border-color: var(--el-color-warning-light-5); background: var(--el-color-warning-light-9); }
.flow-step-name { font-size: 13px; font-weight: 650; }
.flow-step-state { color: var(--el-text-color-secondary); font-size: 11px; }
.flow-step.is-attention .flow-step-state { color: var(--el-color-warning); }
.attention-list { margin-top: 18px; }
.attention-item { display: flex; align-items: center; gap: 9px; min-height: 39px; border-bottom: 1px solid var(--el-border-color-lighter); }
.attention-item:last-child { border-bottom: none; }
.attention-dot { flex: 0 0 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--el-color-primary); }
.dot-orange { background: var(--el-color-warning); }.dot-red { background: var(--el-color-danger); }.dot-green { background: var(--el-color-success); }.dot-blue { background: var(--el-color-primary); }
.attention-text { flex: 1; min-width: 0; color: var(--el-text-color-regular); font-size: 12px; line-height: 1.5; }
.ops-table { width: 100%; margin-top: 16px; }
.ops-table :deep(.el-table__inner-wrapper::before) { display: none; }
.ops-table :deep(.el-table__row) { cursor: default; }

.section-toolbar { align-items: flex-start; margin-bottom: 18px; }
.toolbar-actions { flex-shrink: 0; }
.content-type-select { width: 130px; }
.content-table { margin-top: 0; }
.site-form, .content-form { max-width: 1080px; }
.form-grid { display: grid; gap: 0 16px; }
.form-grid-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.site-form :deep(.el-form-item), .content-form :deep(.el-form-item) { margin-bottom: 18px; }
.site-form :deep(.el-textarea__inner), .content-form :deep(.el-textarea__inner) { font-family: var(--el-font-family); line-height: 1.55; }
.seo-overview { display: grid; grid-template-columns: minmax(220px, 1.5fr) repeat(3, minmax(120px, 1fr)); gap: 12px; }
.seo-score-card, .seo-stat { min-height: 102px; padding: 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-blank); }
.seo-score-card { display: flex; flex-direction: column; gap: 6px; }
.seo-score-label, .seo-stat span { color: var(--el-text-color-secondary); font-size: 12px; }
.seo-score-card strong { color: var(--el-color-primary); font-size: 20px; }
.seo-score-card > span:last-child { color: var(--el-text-color-secondary); font-size: 12px; }
.seo-stat { display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.seo-stat strong { font-size: 26px; color: var(--el-text-color-primary); }.seo-stat strong.is-danger { color: var(--el-color-danger); }.seo-stat strong.is-success { color: var(--el-color-success); }

@media (max-width: 900px) {
  .page-header { align-items: flex-start; flex-direction: column; }
  .page-actions { justify-content: flex-start; }
  .overview-grid { grid-template-columns: 1fr; }
  .seo-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .seo-score-card { grid-column: 1 / -1; }
}

@media (max-width: 640px) {
  .company-site-ops { padding: 14px; }
  .workspace-tabs-wrap { padding: 0 12px; overflow-x: auto; }
  .workspace-tabs { min-width: 540px; }
  .overview-section, .content-section, .leads-section, .seo-section, .settings-section { padding: 16px; }
  .overview-banner { align-items: flex-start; flex-wrap: wrap; padding: 16px; }
  .banner-copy { flex-basis: calc(100% - 64px); }
  .banner-meta { flex-direction: row; align-items: center; width: 100%; padding-left: 64px; }
  .flow-line { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 8px; }
  .flow-step:nth-child(2)::after { display: none; }
  .flow-step:nth-child(3)::after { display: none; }
  .section-toolbar { flex-direction: column; }
  .toolbar-actions { width: 100%; justify-content: flex-start; }
  .content-type-select { flex: 1; }
  .form-grid-two, .form-grid-three { grid-template-columns: 1fr; }
  .seo-overview { grid-template-columns: 1fr 1fr; }
  .seo-score-card { grid-column: 1 / -1; }
  .page-heading h1 { font-size: 22px; }
}
</style>
