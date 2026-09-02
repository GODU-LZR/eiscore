import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  Collection,
  DataBoard,
  DataAnalysis,
  Document,
  Edit,
  DocumentChecked,
  Plus,
  Promotion,
  Refresh,
  Setting,
  Tickets,
  TrendCharts,
  User,
  Warning,
  WarningFilled
} from '@element-plus/icons-vue'
import request from '@/utils/request'
import { getUserInfo } from '@/utils/auth'
import { COMPANY_SITE_CAPABILITIES, isCompanyContentTypeEnabled } from '@/domain/company-site-capabilities'
import { useRouter } from 'vue-router'

export function useCompanySiteOperations() {
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣








const COMPANY_SITE_READ_ROLES = new Set([
  'super_admin', 'admin', 'company_site_admin', 'site_admin', 'content_editor',
  'content_reviewer', 'sales_manager', 'sales_owner', 'sales', 'production_planner', 'system_admin'
])
const COMPANY_SITE_MANAGE_ROLES = new Set([
  'super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_reviewer'
])
const COMPANY_SITE_SCOPES = ['company_site', 'company-site', 'companysite', 'site_content']
const READ_ACTIONS = ['read', 'view', 'list', 'manage', 'admin']
const MANAGE_ACTIONS = ['write', 'publish', 'manage', 'admin']

const activeSection = ref('overview')
const router = useRouter()
const activeContentType = ref('pages')
const loading = ref(false)
const contentLoading = ref(false)
const leadsLoading = ref(false)
const draftsLoading = ref(false)
const seoLoading = ref(false)
const keywordMapLoading = ref(false)
const savingSite = ref(false)
const publishingSite = ref(false)
const savingContent = ref(false)
const factLoading = ref(false)
const geoLoading = ref(false)
const correctionsLoading = ref(false)
const editDialogVisible = ref(false)
const editingType = ref('page')
const editingId = ref('')
const loadError = ref('')
const canRead = ref(false)
const canManage = ref(false)
const canAudit = ref(false)
const canContentWrite = ref(false)
const canPublish = ref(false)
const canSiteWrite = ref(false)
const canSalesWrite = ref(false)
const canSalesApprove = ref(false)
const canSalesPrecheck = ref(false)
const site = ref(null)
const leads = ref([])
const drafts = ref([])
const seoChecks = ref([])
const keywordMapReport = ref(null)
const draftDetailVisible = ref(false)
const draftDetail = ref(null)
const customerMatchVisible = ref(false)
const customerMatch = ref(null)
const factReport = ref(null)
const correctionTasks = ref([])
const geoSnapshots = ref([])
const correctionFilter = ref('open')
  const contentCollections = reactive({
  pages: [],
  products: [],
  solutions: [],
  cases: [],
  certificates: [],
  downloads: [],
  evidence: [],
  knowledge: [],
  seo: [],
  keywords: [],
  externalProfiles: []
})

const contentTypes = [
  { key: 'pages', label: '页面', singular: 'page' },
  { key: 'products', label: '产品', singular: 'product' },
  { key: 'solutions', label: '行业方案', singular: 'solution' },
  { key: 'cases', label: '客户案例', singular: 'case' },
  { key: 'certificates', label: '证书验证', singular: 'certificate' },
  { key: 'downloads', label: '资料下载', singular: 'download' },
  { key: 'evidence', label: '证据记录', singular: 'evidence' },
  { key: 'knowledge', label: '知识文档', singular: 'knowledge' },
  { key: 'seo', label: 'SEO 元数据', singular: 'seo' },
  { key: 'keywords', label: '关键词地图', singular: 'keyword' },
  { key: 'externalProfiles', label: '外部档案', singular: 'externalProfile' }
].map((item) => ({ ...item, enabled: isCompanyContentTypeEnabled(item.key) }))

const featureAvailability = COMPANY_SITE_CAPABILITIES

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
  issuer: '',
  certificateNumber: '',
  validFrom: '',
  validTo: '',
  description: '',
  fileName: '',
  mimeType: '',
  assetUrl: '',
  accessPolicy: 'lead_required',
  publicLevel: 'anonymous',
  sourceType: 'internal_document',
  sourceRef: '',
  claim: '',
  expiresAt: '',
  keyword: '',
  keywordType: 'secondary',
  intent: 'commercial',
  market: '',
  customerRole: '',
  targetPath: '',
  source: '',
  ownerId: '',
  priority: 3,
  profileType: 'directory',
  verificationStatus: 'pending',
  lastCheckedAt: '',
  profileName: '',
  canonicalName: '',
  url: '',
  notes: '',
  documentType: 'faq',
  content: '',
  question: '',
  answer: '',
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
const hasLocaleField = computed(() => ['pages', 'solutions', 'cases', 'certificates', 'downloads', 'knowledge', 'seo', 'keywords', 'externalProfiles'].includes(activeContentType.value) || ['page', 'solution', 'case', 'certificate', 'download', 'knowledge', 'seo', 'keyword', 'externalProfile'].includes(editingType.value))
const hasSlugField = computed(() => ['pages', 'solutions', 'cases', 'certificates', 'downloads'].includes(activeContentType.value) || ['page', 'solution', 'case', 'certificate', 'download'].includes(editingType.value))
const hasTitleField = computed(() => ['pages', 'solutions', 'cases', 'certificates', 'downloads', 'seo'].includes(activeContentType.value) || ['page', 'solution', 'case', 'certificate', 'download', 'seo'].includes(editingType.value))
const draftFilter = ref('')

const draftTypeText = (value) => ({ opportunity: '商机草稿', quote: '报价草稿', order: '销售订单草稿', production: '生产建议草稿' }[value] || value || '销售草稿')
const draftApprovalText = (value) => ({ pending: '待人工批准', approved: '已批准' }[value] || value || '待人工批准')
const draftApprovalType = (value) => ({ pending: 'warning', approved: 'success' }[value] || 'info')
const draftLeadRef = (row) => row?.source?.leadId || row?.source?.lead_id || row?.leadId || row?.lead_id || '-'
const keywordTypeText = (value) => ({ primary: '主词', secondary: '辅助词', supporting: '支持词' }[value] || value || '辅助词')
const keywordIntentText = (value) => ({ informational: '信息型', commercial: '商业型', transactional: '交易型', navigational: '导航型' }[value] || value || '商业型')

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
const factSummary = computed(() => {
  const report = factReport.value
  if (!report) return { label: '尚未扫描', detail: '运行扫描以检查事实来源和冲突', openTasks: correctionTasks.value.filter((row) => ['open', 'in_progress'].includes(row.status)).length, expired: 0, conflicts: 0 }
  return {
    label: report.summary?.issues ? '需要处理' : '基础检查通过',
    detail: `${report.summary?.issues || 0} 个问题 · ${formatDate(report.generatedAt)}`,
    openTasks: report.summary?.openTasks || 0,
    expired: report.summary?.expired || 0,
    conflicts: report.summary?.conflicts || 0
  }
})

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
  logoUrl: '',
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
  siteForm.logoUrl = textValue(next?.trademark?.asset || next?.trademark?.logoUrl || next.logoUrl)
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
const correctionStatusText = (value) => ({ open: '待处理', in_progress: '处理中', resolved: '已解决', dismissed: '已忽略' }[value] || value || '未知')
const correctionStatusType = (value) => ({ open: 'danger', in_progress: 'warning', resolved: 'success', dismissed: 'info' }[value] || 'info')
const accuracyStatusText = (value) => ({ pending: '待复核', verified: '准确', incorrect: '错误', needs_review: '待复核' }[value] || value || '待复核')
const accuracyStatusType = (value) => ({ pending: 'warning', verified: 'success', incorrect: 'danger', needs_review: 'warning' }[value] || 'info')

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
  if (type === 'keywords') return row.keyword || '-'
  if (type === 'externalProfiles') return row.name || row.canonicalName || '-'
  if (type === 'evidence') return row.claim || row.sourceRef || '-'
  if (type === 'knowledge') return row.question || row.title || '-'
  if (type === 'certificates') return row.title || row.name || row.number || '-'
  if (type === 'downloads') return row.title || row.fileName || row.slug || '-'
  return row.title || row.slug || row.path || row.documentType || '-'
}

const contentMeta = (row, type) => {
  if (!row) return '-'
  if (type === 'products') return row.category || row.slug || '-'
  if (type === 'keywords') return `${row.market || '未设市场'} · ${row.targetPath || '未映射'}`
  if (type === 'externalProfiles') return `${row.profileType || 'directory'} · ${row.verificationStatus || 'pending'}`
  if (type === 'evidence') return row.sourceType || '-'
  if (type === 'knowledge') return row.locale || 'FAQ'
  if (type === 'certificates') return `${row.issuer || '证书'} · ${row.publicLevel === 'public' ? '公开' : '内部'}`
  if (type === 'downloads') return `${row.locale || 'zh-CN'} · ${row.accessPolicy || 'lead_required'}`
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
  const isRole = (allowed) => roles.some((role) => allowed.has(role))
  canRead.value = isRole(COMPANY_SITE_READ_ROLES) || hasScopedPermission(READ_ACTIONS)
  canContentWrite.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_editor', 'content_reviewer'])) || hasScopedPermission(['content:write', 'content', 'write'])
  canPublish.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_reviewer'])) || hasScopedPermission(['content:publish', 'publish'])
  canSiteWrite.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin'])) || hasScopedPermission(['site:write', 'site', 'write'])
  canSalesWrite.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'sales_manager', 'sales_owner', 'sales', 'production_planner'])) || hasScopedPermission(['sales:write', 'sales', 'write'])
  canSalesApprove.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'sales_manager', 'production_planner'])) || hasScopedPermission(['sales:approve', 'approve'])
  canSalesPrecheck.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'sales_manager', 'sales_owner', 'production_planner'])) || hasScopedPermission(['sales:precheck', 'precheck'])
  canManage.value = canContentWrite.value || canPublish.value || canSiteWrite.value
  canAudit.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_reviewer', 'sales_manager', 'sales_owner', 'sales', 'production_planner'])) || hasScopedPermission(['audit', 'facts', 'geo', 'manage'])
}

const loadSite = async () => {
  const response = await request.get('/company-site/admin/site-config')
  site.value = response?.config?.site || response?.site || null
  syncSiteForm(site.value)
}

const loadContent = async (type = activeContentType.value) => {
  if (!contentCollections[type] || !isCompanyContentTypeEnabled(type)) return
  contentLoading.value = true
  try {
    const response = await request.get(`/company-site/admin/${type}`, { params: { limit: 200 } })
    contentCollections[type] = Array.isArray(response?.items) ? response.items : []
  } finally {
    contentLoading.value = false
  }
}

const loadContentCatalog = async () => {
  await Promise.all(contentTypes.filter((type) => type.enabled).map((type) => loadContent(type.key)))
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

const loadDrafts = async () => {
  if (!featureAvailability.salesDrafts || (!canSalesWrite.value && !canSalesApprove.value)) return
  draftsLoading.value = true
  try {
    const response = await request.get('/sales/drafts', { params: { type: draftFilter.value || undefined } })
    drafts.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    draftsLoading.value = false
  }
}

const loadKeywordMap = async () => {
  if (!featureAvailability.keywordMapReport || !canAudit.value) return
  keywordMapLoading.value = true
  try {
    const response = await request.get('/company-site/admin/reports/keyword-map', { params: { locale: site.value?.defaultLocale || 'zh-CN' } })
    keywordMapReport.value = response?.report || null
  } finally {
    keywordMapLoading.value = false
  }
}

const openDraft = async (row) => {
  if (!featureAvailability.salesDrafts) return
  const response = await request.get(`/sales/drafts/${encodeURIComponent(row.draftType)}/${encodeURIComponent(row.id)}`)
  draftDetail.value = response?.draft || row
  draftDetailVisible.value = true
}

const approveDraft = async (row) => {
  if (!featureAvailability.salesDrafts || !canSalesApprove.value) return
  await ElMessageBox.confirm(`确认批准${draftTypeText(row.draftType)}吗？这仍然只是内部草稿。`, '人工批准', { type: 'warning' })
  await request.post(`/sales/drafts/${encodeURIComponent(row.draftType)}/${encodeURIComponent(row.id)}/approve`, {})
  await loadDrafts()
  ElMessage.success('草稿已记录人工批准')
}

const precheckDraft = async (row) => {
  if (!featureAvailability.salesDrafts || !canSalesPrecheck.value) return
  const response = await request.post(`/sales/orders/${encodeURIComponent(row.id)}/precheck`, {})
  draftDetail.value = { ...row, precheck: response?.precheck || null }
  draftDetailVisible.value = true
}

const runCustomerMatch = async (row) => {
  if (!featureAvailability.customerMatch || !canSalesWrite.value) return
  const leadId = row?.id
  if (!leadId) return
  const response = await request.post(`/sales/leads/${encodeURIComponent(leadId)}/customer-match`, {}, { headers: { 'Idempotency-Key': `customer-match-${leadId}` } })
  customerMatch.value = response?.match || null
  customerMatchVisible.value = true
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

const loadCorrectionTasks = async () => {
  if (!featureAvailability.factGovernance || !canAudit.value) return
  correctionsLoading.value = true
  try {
    const response = await request.get('/company-site/admin/facts/corrections', { params: { status: correctionFilter.value } })
    correctionTasks.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    correctionsLoading.value = false
  }
}

const loadGeoSnapshots = async () => {
  if (!featureAvailability.factGovernance || !canAudit.value) return
  geoLoading.value = true
  try {
    const response = await request.get('/company-site/admin/geo/snapshots', { params: { locale: site.value?.defaultLocale || 'zh-CN' } })
    geoSnapshots.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    geoLoading.value = false
  }
}

const loadFactGovernance = async () => {
  if (!featureAvailability.factGovernance || !canAudit.value) return
  await Promise.all([loadCorrectionTasks(), loadGeoSnapshots()])
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

const openCueBuilder = () => router.push('/cue-builder')
const openFactoryDemo = () => router.push('/factory-demo')

const saveSite = async () => {
  if (!canSiteWrite.value) return
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
      trademark: { ...(site.value?.trademark || {}), asset: siteForm.logoUrl },
      seo: parseJson(siteForm.seoText, {})
    })
    site.value = response?.config?.site || response?.site || site.value
    syncSiteForm(site.value)
    ElMessage.success('站点设置已保存为草稿')
  } finally {
    savingSite.value = false
  }
}

const publishSite = async () => {
  if (!canPublish.value) return
  try {
    await ElMessageBox.confirm('发布后将把当前站点配置切换到公开版本，是否继续？', '确认发布站点', { type: 'warning' })
  } catch {
    return
  }
  publishingSite.value = true
  try {
    const response = await request.post('/company-site/admin/content/publish', {
      objectType: 'site_config',
      id: site.value?.siteKey || site.value?.site_key,
      status: 'published'
    })
    if (response?.item) site.value = { ...(site.value || {}), ...response.item }
    await loadSite()
    ElMessage.success('站点已发布')
  } finally {
    publishingSite.value = false
  }
}

const newContent = (type) => {
  if (!canContentWrite.value) return
  const info = contentTypes.find((item) => item.key === type)
  if (!info?.enabled || type === 'seo') {
    if (type === 'seo') ElMessage.info('SEO 元数据可通过站点内容或 SEO 检查结果继续维护')
    return
  }
  editingType.value = info.singular
  editingId.value = ''
  Object.assign(editingForm, emptyContentForm())
  if (editingType.value === 'certificate') editingForm.publicLevel = 'internal'
  if (editingType.value === 'externalProfile') editingForm.profileType = 'directory'
  editDialogVisible.value = true
}

const readRowValue = (row, camel, snake = '') => row?.[camel] ?? (snake ? row?.[snake] : undefined)

const editContent = (type, row) => {
  const info = contentTypes.find((item) => item.key === type)
  if (!info?.enabled || !row) return
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
  editingForm.issuer = textValue(readRowValue(row, 'issuer'))
  editingForm.certificateNumber = textValue(readRowValue(row, 'number', 'certificate_number'))
  editingForm.validFrom = textValue(readRowValue(row, 'validFrom', 'valid_from'))
  editingForm.validTo = textValue(readRowValue(row, 'validTo', 'valid_to'))
  editingForm.description = textValue(readRowValue(row, 'description'))
  editingForm.fileName = textValue(readRowValue(row, 'fileName', 'file_name'))
  editingForm.mimeType = textValue(readRowValue(row, 'mimeType', 'mime_type'))
  editingForm.assetUrl = textValue(readRowValue(row, 'assetUrl', 'asset_url'))
  editingForm.accessPolicy = textValue(readRowValue(row, 'accessPolicy', 'access_policy'), 'lead_required')
  editingForm.publicLevel = textValue(readRowValue(row, 'publicLevel', 'public_level'), editingType.value === 'certificate' ? 'internal' : 'anonymous')
  editingForm.sourceType = textValue(readRowValue(row, 'sourceType', 'source_type'), 'internal_document')
  editingForm.sourceRef = textValue(readRowValue(row, 'sourceRef', 'source_ref'))
  editingForm.claim = textValue(readRowValue(row, 'claim'))
  editingForm.expiresAt = textValue(readRowValue(row, 'expiresAt', 'expires_at'))
  editingForm.keyword = textValue(readRowValue(row, 'keyword'))
  editingForm.keywordType = textValue(readRowValue(row, 'keywordType', 'keyword_type'), 'secondary')
  editingForm.intent = textValue(readRowValue(row, 'intent'), 'commercial')
  editingForm.market = textValue(readRowValue(row, 'market'))
  editingForm.customerRole = textValue(readRowValue(row, 'customerRole', 'customer_role'))
  editingForm.targetPath = textValue(readRowValue(row, 'targetPath', 'target_path'))
  editingForm.source = textValue(readRowValue(row, 'source'))
  editingForm.ownerId = textValue(readRowValue(row, 'ownerId', 'owner_id'))
  editingForm.priority = Number(readRowValue(row, 'priority')) || 3
  editingForm.profileType = textValue(readRowValue(row, 'profileType', 'profile_type'), 'directory')
  editingForm.verificationStatus = textValue(readRowValue(row, 'verificationStatus', 'verification_status'), 'pending')
  editingForm.lastCheckedAt = textValue(readRowValue(row, 'lastCheckedAt', 'last_checked_at'))
  editingForm.profileName = textValue(readRowValue(row, 'name'))
  editingForm.canonicalName = textValue(readRowValue(row, 'canonicalName', 'canonical_name'))
  editingForm.url = textValue(readRowValue(row, 'url'))
  editingForm.notes = textValue(readRowValue(row, 'notes'))
  editingForm.documentType = textValue(readRowValue(row, 'documentType', 'document_type'), 'faq')
  editingForm.content = textValue(readRowValue(row, 'content'))
  editingForm.question = textValue(row?.question ?? row?.title)
  editingForm.answer = textValue(row?.answer ?? row?.content)
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
  if (editingType.value === 'certificate') return { locale: form.locale, slug: form.slugOrPath, name: form.title, description: form.description, issuer: form.issuer, number: form.certificateNumber, validFrom: form.validFrom, validTo: form.validTo, publicLevel: form.publicLevel, evidence: parseJson(form.evidenceText, {}) }
  if (editingType.value === 'download') return { locale: form.locale, slug: form.slugOrPath, title: form.title, description: form.description, fileName: form.fileName, mimeType: form.mimeType, assetUrl: form.assetUrl, accessPolicy: form.accessPolicy, expiresAt: form.expiresAt }
  if (editingType.value === 'evidence') return { claim: form.claim, sourceType: form.sourceType, sourceRef: form.sourceRef, evidence: parseJson(form.evidenceText, {}), expiresAt: form.expiresAt }
  if (editingType.value === 'knowledge') return { locale: form.locale, title: form.question, content: form.answer, documentType: form.documentType, citations: parseJson(form.citationsText, []), forbiddenClaims: parseJson(form.forbiddenClaimsText, []), expiresAt: form.expiresAt }
  if (editingType.value === 'keyword') return { locale: form.locale, keyword: form.keyword, keywordType: form.keywordType, intent: form.intent, market: form.market, customerRole: form.customerRole, targetPath: form.targetPath, source: form.source, ownerId: form.ownerId, priority: form.priority }
  if (editingType.value === 'externalProfile') return { locale: form.locale, profileType: form.profileType, name: form.profileName, canonicalName: form.canonicalName, url: form.url, market: form.market, verificationStatus: form.verificationStatus, lastCheckedAt: form.lastCheckedAt, expiresAt: form.expiresAt, evidenceIds: parseJson(form.evidenceIdsText, []), ownerId: form.ownerId, notes: form.notes }
  return { locale: form.locale, path: form.slugOrPath, title: form.title, description: form.description, canonical: form.canonical, robots: form.robots, keywords: parseJson(form.keywordsText, []), structuredData: parseJson(form.structuredDataText, {}) }
}

const saveContent = async () => {
  if (!canContentWrite.value) return
  if (!editingId.value && editingType.value === 'product' && !editingForm.productCode) return ElMessage.warning('请输入产品编号')
  if (!editingId.value && ['page', 'solution', 'case'].includes(editingType.value) && (!editingForm.locale || !editingForm.slugOrPath || !editingForm.title)) return ElMessage.warning('请补充语言、标识和标题')
  if (!editingId.value && editingType.value === 'knowledge' && (!editingForm.locale || !editingForm.question || !editingForm.answer)) return ElMessage.warning('请补充语言、问题和回答内容')
  if (!editingId.value && editingType.value === 'evidence' && !editingForm.claim) return ElMessage.warning('请输入可验证声明')
  if (!editingId.value && editingType.value === 'keyword' && (!editingForm.locale || !editingForm.keyword || !editingForm.targetPath)) return ElMessage.warning('请补充语言、关键词和目标路径')
  if (!editingId.value && editingType.value === 'externalProfile' && (!editingForm.locale || !editingForm.profileName || !editingForm.canonicalName || !editingForm.url)) return ElMessage.warning('请补充语言、名称、标准名称和 URL')
  if (!editingId.value && ['certificate', 'download'].includes(editingType.value) && (!editingForm.locale || !editingForm.slugOrPath || !editingForm.title)) return ElMessage.warning('请补充语言、标识和标题')
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
  if ((!canContentWrite.value && !canPublish.value) || type === 'seo') return ''
  const status = textValue(row?.status, 'draft')
  const chain = ['draft', 'review', 'approved', 'published']
  const index = chain.indexOf(status)
  const next = index >= 0 && index < chain.length - 1 ? chain[index + 1] : ''
  if (next === 'published' && !canPublish.value) return ''
  if (next && next !== 'published' && !canContentWrite.value) return ''
  return next
}

const nextStatusLabel = (row, type) => ({ review: '提交审核', approved: '审核通过', published: '发布' }[nextStatus(row, type)] || '')

const advanceContentStatus = async (type, row) => {
  const status = nextStatus(row, type)
  if (!status) return
  const action = status === 'published' ? '发布' : status === 'review' ? '送审' : '审核通过'
  try {
    await ElMessageBox.confirm(`确定将“${contentTitle(row, type)}”${action}吗？`, `确认${action}`, { type: status === 'published' ? 'warning' : 'info' })
  } catch {
    return
  }
  const objectType = contentTypes.find((item) => item.key === type)?.singular || type
  await request.post('/company-site/admin/content/publish', { objectType, id: row.id, status })
  await loadContent(type)
  ElMessage.success(`内容已${action}`)
}

const runSeoCheck = async () => {
  if (!canAudit.value) return
  seoLoading.value = true
  try {
    await request.post('/company-site/admin/seo/check', {})
    await loadSeoChecks()
    ElMessage.success('SEO 检查已完成')
  } finally {
    seoLoading.value = false
  }
}

const scanFacts = async () => {
  if (!featureAvailability.factGovernance || !canAudit.value) return
  factLoading.value = true
  try {
    const response = await request.post('/company-site/admin/facts/scan', {})
    factReport.value = response?.report || null
    await loadCorrectionTasks()
    ElMessage.success('事实扫描已完成')
  } finally {
    factLoading.value = false
  }
}

const generateGeoSnapshots = async () => {
  if (!featureAvailability.factGovernance || !canAudit.value) return
  geoLoading.value = true
  try {
    await request.post('/company-site/admin/geo/snapshots/generate', { platform: 'internal-baseline', locale: site.value?.defaultLocale || 'zh-CN' })
    await loadGeoSnapshots()
    ElMessage.success('GEO 快照已生成，等待人工复核')
  } finally {
    geoLoading.value = false
  }
}

const reviewGeoSnapshot = async (row, accuracyStatus) => {
  if (!featureAvailability.factGovernance || !canPublish.value) return
  await request.patch(`/company-site/admin/geo/snapshots/${encodeURIComponent(row.id)}/review`, { accuracyStatus })
  await Promise.all([loadGeoSnapshots(), loadCorrectionTasks()])
  ElMessage.success('GEO 快照复核状态已更新')
}

const updateCorrectionStatus = async (row, status) => {
  if (!featureAvailability.factGovernance || !canContentWrite.value) return
  await request.patch(`/company-site/admin/facts/corrections/${encodeURIComponent(row.id)}`, { status })
  await loadCorrectionTasks()
  ElMessage.success('纠偏任务状态已更新')
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
return {
  Box,
  COMPANY_SITE_MANAGE_ROLES,
  COMPANY_SITE_READ_ROLES,
  COMPANY_SITE_SCOPES,
  Collection,
  DataAnalysis,
  DataBoard,
  Document,
  DocumentChecked,
  Edit,
  ElMessage,
  ElMessageBox,
  MANAGE_ACTIONS,
  Plus,
  Promotion,
  READ_ACTIONS,
  Refresh,
  Setting,
  Tickets,
  TrendCharts,
  User,
  Warning,
  WarningFilled,
  accuracyStatusText,
  accuracyStatusType,
  activeContentRows,
  activeContentType,
  activeContentTypeInfo,
  activeContentTypeLabel,
  activeSection,
  advanceContentStatus,
  allContentRows,
  approveDraft,
  attentionItems,
  buildContentPayload,
  canAudit,
  canContentWrite,
  canManage,
  canPublish,
  canRead,
  canSalesApprove,
  canSalesPrecheck,
  canSalesWrite,
  canSiteWrite,
  computed,
  contentCollections,
  contentCount,
  contentLoading,
  contentMeta,
  contentTitle,
  contentTypes,
  correctionFilter,
  correctionStatusText,
  correctionStatusType,
  correctionTasks,
  correctionsLoading,
  customerMatch,
  customerMatchVisible,
  detailText,
  draftApprovalText,
  draftApprovalType,
  draftDetail,
  draftDetailVisible,
  draftFilter,
  draftLeadRef,
  draftTypeText,
  drafts,
  draftsLoading,
  editContent,
  editDialogVisible,
  editingForm,
  editingId,
  editingType,
  emptyContentForm,
  factLoading,
  factReport,
  factSummary,
  featureAvailability,
  formatDate,
  generateGeoSnapshots,
  geoLoading,
  geoSnapshots,
  getUserInfo,
  handleAuthUpdate,
  hasLocaleField,
  hasSlugField,
  hasTitleField,
  jsonText,
  keywordIntentText,
  keywordMapLoading,
  keywordMapReport,
  keywordTypeText,
  leadStatusText,
  leadStatusType,
  leads,
  leadsLoading,
  loadAll,
  loadContent,
  loadContentCatalog,
  loadCorrectionTasks,
  loadDrafts,
  loadError,
  loadFactGovernance,
  loadGeoSnapshots,
  loadKeywordMap,
  loadLeads,
  loadSeoChecks,
  loadSite,
  loading,
  newContent,
  newLeadCount,
  nextStatus,
  nextStatusLabel,
  onMounted,
  onUnmounted,
  openCueBuilder,
  openDraft,
  openFactoryDemo,
  operationSteps,
  parseJson,
  precheckDraft,
  publishSite,
  publishedContentCount,
  publishingSite,
  reactive,
  readRowValue,
  recentContentRows,
  ref,
  refreshAuthState,
  request,
  reviewGeoSnapshot,
  router,
  runCustomerMatch,
  runSeoCheck,
  saveContent,
  saveSite,
  savingContent,
  savingSite,
  scanFacts,
  seoChecks,
  seoLoading,
  seoOpenCount,
  seoSummary,
  severityTagType,
  severityText,
  site,
  siteForm,
  siteStatusText,
  siteStatusType,
  statusTagType,
  statusText,
  summaryCards,
  syncSiteForm,
  textValue,
  updateCorrectionStatus,
  useRouter,
}
}
