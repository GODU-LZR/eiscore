import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ArrowLeft, ArrowRight, CircleCheck, Close, DocumentChecked, Key, Loading, Lock, Menu, Setting, Top, View, Warning } from '@element-plus/icons-vue'
import {
  JINWEI_PRODUCT_FAMILIES,
  JINWEI_PUBLIC_PROJECTS,
  JINWEI_PUBLIC_SOLUTIONS,
  JINWEI_QUALITY_BASELINE,
  JINWEI_SPEC_FIELDS,
  JINWEI_SYSTEM_URL
} from '@/jinwei/model.js'
import { enterpriseProfileFromSiteConfig } from '@eiscore/platform/enterprise-profile'
import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { navigateExternalHttps } from '@eiscore/platform/navigation'
import { requestPublicJson } from '@/platform/public-http'

export function useJinweiSite() {
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣





const locale = ref(typeof localStorage !== 'undefined' && localStorage.getItem('jinwei.site.locale') === 'en-US' ? 'en-US' : 'zh-CN')
const publishedEnterpriseProfile = ref(null)
const isEnglish = computed(() => locale.value === 'en-US')
const tx = (zh, en) => (isEnglish.value ? en : zh)

const ZH_COPY = Object.freeze({
  brand: { name: '经纬网业', sub: 'JINGWEI NETTING', homeLabel: '返回经纬网业首页' },
  locale: { toggleLabel: '切换到英文' },
  nav: { ariaLabel: '页面导航', mobileLabel: '移动端页面导航', products: '产品体系', solutions: '应用方案', capability: '制造现场', process: '交付流程', quality: '质量依据', inquiry: '提交规格', systemTitle: '打开 EISCore 制造系统', menuLabel: '打开页面导航' },
  login: { openTitle: '打开经纬系统登录', short: '登录', title: '进入经纬 EISCore', kicker: 'AUTHORIZED ACCESS / 授权入口', dialogTitleId: 'jinwei-login-title', closeLabel: '关闭登录窗口', lead: '员工、计划、仓库、质检与合作伙伴使用统一账号进入制造协同系统。', username: '用户名', password: '密码', usernamePlaceholder: '输入企业账号', passwordPlaceholder: '输入登录密码', remember: '在本设备记住账号', checking: '正在验证', submit: '验证并进入系统', note: '登录验证在经纬域名下完成；管理端使用独立会话，不在地址栏传递密码或 Token。', adminLink: '打开管理端登录页', verified: '账号验证通过，正在进入经纬 EISCore。', invalid: '账号或密码不正确，请检查后重试。', unavailable: '账号已验证，但系统登录交接暂时不可用，请稍后重试。' },
  hero: { imageAlt: '湛江市经纬网厂厂区大门', org: '湛江市经纬网厂 / ZHANJIANG JINGWEI NETTING FACTORY', primary: '提交规格', secondary: '查看制造现场', indexLabel: '产品范围', carouselRole: '轮播图', carouselLabel: '经纬网业厂区与产品现场', carouselControls: '现场图片切换', carouselSlides: '现场图片', slideLabel: '第', previous: '上一张现场图片', next: '下一张现场图片' },
  proof: { ariaLabel: '制造依据', items: [{ title: 'Specification first', detail: '材质、线规格、网眼、尺寸、颜色与包装逐项确认' }, { title: 'Traceable by batch', detail: '合同、批次、机台、人员、检验与包装码贯通' }, { title: 'Built for handoff', detail: '本厂织造、外协回网、染色和分批交付统一衔接' }] },
  sections: {
    products: { label: '01 / PRODUCT SYSTEM', title: '从线材、网衣到整套网箱，按工况定义每一条规格。', detail: '每个询盘先形成可核对的规格版本，再进入库存齐套、机台匹配和交付评估。' },
    solutions: { label: '02 / APPLICATION SYSTEMS', title: '从网片供货，到按工况协同的工程方案', detail: '公开页面区分产品族与产业关联业务；项目参数、客户名称和性能指标均在技术评审后确认。', associatedLabel: 'ASSOCIATED BRAND / 产业关联业务' },
    spec: { label: 'SPECIFICATION LOOM', title: '一张规格单，贯穿报价、排产、检验与包装' },
    capability: { label: '03 / FACTORY FLOOR', title: '制造能力，来自看得见的工位与交接。', detail: '现场图片覆盖原料、拉丝与温控、整经盘头、织网、人工检修、热定型、包装及仓储。每一处实物标识，都会在系统中转成可扫描、可校验的批次记录。', rows: [{ title: '原料准备', detail: '聚乙烯、尼龙、涤纶及外购纱线按批次接收' }, { title: '织造路线', detail: '有结、无结、捻线与成绳按产品工艺分支' }, { title: '后处理', detail: '人工补网、委外染色、电热或蒸汽定型' }, { title: '交付控制', detail: '条/件换算、包装唛头、合同归属与分批出库' }], images: { weaving: { label: '织网现场', caption: '大面积网衣装配', alt: '经纬网厂大面积网衣装配现场' }, extrusion: { label: '生产车间', caption: '多机台织造工位', alt: '经纬网厂多机台织造生产车间' }, setting: { label: '网结细节', caption: '成品网衣检视', alt: '渔网网结与网眼细节' } } },
    process: { label: '04 / ORDER JOURNEY', title: '从客户规格到包装码，状态沿着一条线走完。' },
    quality: { label: '05 / QUALITY & EVIDENCE', title: '把标准、批次和放行状态，放在同一条证据链上。', detail: '以下是联网核验后用于系统建模的标准基线，不等同于企业认证，也不替代客户合同中的检验要求。', boundary: '公开数字、项目案例、证书和产能口径上线前仍需经纬网厂书面确认。' },
    projects: { label: 'PROJECT REGISTER', title: '项目展示采用证据等级，而不是夸大承诺', note: '授权后可扩充为正式案例' },
    industry: { ariaLabel: '产业关联边界', label: 'JINGWEI INDUSTRIAL CONTEXT', title: '网具制造是主体，产业协同按业务边界呈现', detail: '公开资料还提到海洋牧场、养殖装备与“粤府鲜”金鲳鱼等关联业务。本页仅将其作为产业体系背景，不把关联业务的规模、资质或产品承诺写成湛江市经纬网厂单体数据。' },
    inquiry: { label: '06 / SPECIFICATION REQUEST', title: '把关键规格，一次说清楚。', detail: '提交后进入人工审核。价格、库存、产能与交期只有在规格版本锁定并完成齐套检查后才会确认。', noteTitle: '规格先行', noteDetail: '缺少关键字段时不会直接生成正式订单或生产任务。' }
  },
  form: { productLegend: '产品与规格', productType: '产品类型', material: '材质', materialPlaceholder: '如：涤纶 / 尼龙 / 聚乙烯', construction: '网结类型', selectPlaceholder: '请选择', yarnSpec: '线规格 / 股数', yarnPlaceholder: '如：210D / PLY3', meshSize: '网眼 / 目数', meshPlaceholder: '如：3/8 英寸', dimensions: '成品尺寸', dimensionsPlaceholder: '长 x 宽 x 深，注明单位', color: '颜色', colorPlaceholder: '如：原白 / 深黑青', weight: '重量标准', weightPlaceholder: '如：KG/PC 与允许偏差', finish: '后处理', finishPlaceholder: '染色、硬度、定型要求', packing: '包装与唛头', packingPlaceholder: '条/件、袋色、印刷版、侧边编号、重量与唛头要求', purchaseLegend: '采购需求', quantity: '需求数量', quantityPlaceholder: '数量及单位', targetDate: '目标日期', country: '交付地区', countryPlaceholder: '国家 / 地区', notes: '用途与补充要求', notesPlaceholder: '应用场景、分批交付、检验或其他要求', contactLegend: '联系信息', company: '企业名称', contact: '联系人', email: '邮箱', phone: '电话 / WhatsApp', consent: '我同意使用本次提交的信息进行询盘跟进。', submitting: '正在提交', submit: '提交规格询盘' },
  footer: '湛江 · 渔网、绳索与养殖网具制造', footerTop: '返回顶部'
})

const EN_COPY = Object.freeze({
  brand: { name: 'Jingwei Netting', sub: 'JINGWEI NETTING', homeLabel: 'Back to Jingwei Netting home' },
  locale: { toggleLabel: 'Switch to Chinese' },
  nav: { ariaLabel: 'Site navigation', mobileLabel: 'Mobile site navigation', products: 'Products', solutions: 'Solutions', capability: 'Factory floor', process: 'Order journey', quality: 'Quality basis', inquiry: 'Request specs', systemTitle: 'Open EISCore manufacturing system', menuLabel: 'Open site navigation' },
  login: { openTitle: 'Open Jingwei system login', short: 'Login', title: 'Enter Jingwei EISCore', kicker: 'AUTHORIZED ACCESS', dialogTitleId: 'jinwei-login-title', closeLabel: 'Close login dialog', lead: 'Employees, planners, warehouse, quality and partners use one account for manufacturing coordination.', username: 'Username', password: 'Password', usernamePlaceholder: 'Enter company username', passwordPlaceholder: 'Enter password', remember: 'Remember username on this device', checking: 'Verifying', submit: 'Verify and continue', note: 'Verification stays on the Jingwei domain. The admin portal keeps its own session; passwords and tokens are never put in the address bar.', adminLink: 'Open admin login', verified: 'Account verified. Opening Jingwei EISCore.', invalid: 'Username or password is incorrect. Please try again.', unavailable: 'Your account was verified, but the secure system handoff is temporarily unavailable. Please try again.' },
  hero: { imageAlt: 'Jingwei Netting Factory entrance', org: 'ZHANJIANG JINGWEI NETTING FACTORY / 湛江市经纬网厂', primary: 'Request a specification', secondary: 'View factory floor', indexLabel: 'Product scope', carouselRole: 'Carousel', carouselLabel: 'Jingwei factory and product scenes', carouselControls: 'Scene controls', carouselSlides: 'Scenes', slideLabel: 'Slide', previous: 'Previous scene', next: 'Next scene' },
  proof: { ariaLabel: 'Manufacturing basis', items: [{ title: 'Specification first', detail: 'Material, yarn, mesh, dimensions, color and packing are confirmed line by line.' }, { title: 'Traceable by batch', detail: 'Contract, batch, machine, operator, inspection and package code stay connected.' }, { title: 'Built for handoff', detail: 'In-house weaving, outsourced return, dyeing and split delivery share one handoff.' }] },
  sections: {
    products: { label: '01 / PRODUCT SYSTEM', title: 'From yarn and netting to complete cages, every specification follows the operating condition.', detail: 'Each inquiry becomes a checkable specification version before readiness, machine matching and delivery review.' },
    solutions: { label: '02 / APPLICATION SYSTEMS', title: 'From net supply to coordinated engineering packages', detail: 'The public page separates product families from associated businesses. Project parameters, customer names and performance metrics are confirmed in technical review.', associatedLabel: 'ASSOCIATED BRAND / INDUSTRIAL CONTEXT' },
    spec: { label: 'SPECIFICATION LOOM', title: 'One specification sheet across quote, planning, inspection and packing' },
    capability: { label: '03 / FACTORY FLOOR', title: 'Manufacturing capability comes from visible workstations and handoffs.', detail: 'Factory scenes cover material, drawing and temperature control, warping, weaving, manual repair, heat setting, packing and storage. Physical marks become scannable, verifiable batch records in the system.', rows: [{ title: 'Material preparation', detail: 'PE, nylon, polyester and purchased yarn are received by batch.' }, { title: 'Weaving routes', detail: 'Knotted, knotless, twisting and rope routes branch by product process.' }, { title: 'Finishing', detail: 'Manual repair, outsourced dyeing and electric or steam setting.' }, { title: 'Delivery control', detail: 'Piece/carton conversion, marks, contract ownership and split dispatch.' }], images: { weaving: { label: 'NET ASSEMBLY', caption: 'Large net assembly floor', alt: 'Jingwei large net assembly floor' }, extrusion: { label: 'FACTORY FLOOR', caption: 'Multi-machine weaving stations', alt: 'Jingwei multi-machine weaving floor' }, setting: { label: 'NET DETAIL', caption: 'Finished net inspection', alt: 'Net knot and mesh detail' } } },
    process: { label: '04 / ORDER JOURNEY', title: 'From customer specification to package code, every state follows one line.' },
    quality: { label: '05 / QUALITY & EVIDENCE', title: 'Keep standards, batches and release status on one evidence chain.', detail: 'This is a standards baseline for system modeling after public verification. It is not a certificate and does not replace contract inspection requirements.', boundary: 'Public figures, case studies, certificates and capacity claims require written confirmation from Jingwei before launch.' },
    projects: { label: 'PROJECT REGISTER', title: 'Project stories use evidence grades, not inflated promises', note: 'Expand to authorized case studies later' },
    industry: { ariaLabel: 'Industrial context boundary', label: 'JINGWEI INDUSTRIAL CONTEXT', title: 'Netting is the core; industrial context stays within its boundary', detail: 'Public sources also mention marine ranching, aquaculture equipment and the Yuefuxian golden pompano line. Here they are context only, not claims about the standalone scale, credentials or products of Jingwei Netting Factory.' },
    inquiry: { label: '06 / SPECIFICATION REQUEST', title: 'Put the critical specifications in one place.', detail: 'Every submission enters manual review. Price, stock, capacity and lead time are confirmed only after the specification version and readiness check are locked.', noteTitle: 'Specification first', noteDetail: 'Missing critical fields never create a formal order or production task.' }
  },
  form: { productLegend: 'Product & specification', productType: 'Product type', material: 'Material', materialPlaceholder: 'e.g. polyester / nylon / polyethylene', construction: 'Construction', selectPlaceholder: 'Select one', yarnSpec: 'Yarn specification / ply', yarnPlaceholder: 'e.g. 210D / PLY3', meshSize: 'Mesh size / gauge', meshPlaceholder: 'e.g. 3/8 inch', dimensions: 'Finished dimensions', dimensionsPlaceholder: 'Length x width x depth with units', color: 'Color', colorPlaceholder: 'e.g. natural white / deep black-green', weight: 'Weight standard', weightPlaceholder: 'e.g. KG/PC and tolerance', finish: 'Finishing', finishPlaceholder: 'Dyeing, hardness or setting requirement', packing: 'Packing & marks', packingPlaceholder: 'Pieces/carton, bag color, print, side code, weight and marks', purchaseLegend: 'Purchase requirement', quantity: 'Required quantity', quantityPlaceholder: 'Quantity and unit', targetDate: 'Target date', country: 'Delivery region', countryPlaceholder: 'Country / region', notes: 'Use and additional requirements', notesPlaceholder: 'Application, split delivery, inspection or other notes', contactLegend: 'Contact details', company: 'Company', contact: 'Contact person', email: 'Email', phone: 'Phone / WhatsApp', consent: 'I agree that this information may be used for inquiry follow-up.', submitting: 'Submitting', submit: 'Submit specification request' },
  footer: 'Zhanjiang · Netting, rope and aquaculture equipment manufacturing', footerTop: 'Back to top'
})

const copy = computed(() => {
  const base = isEnglish.value ? EN_COPY : ZH_COPY
  const profile = publishedEnterpriseProfile.value
  if (!profile) return base
  return {
    ...base,
    brand: {
      ...base.brand,
      name: profile.displayName || profile.shortName || base.brand.name,
      homeLabel: isEnglish.value
        ? `Back to ${profile.displayName || base.brand.name} home`
        : `返回${profile.displayName || base.brand.name}首页`
    },
    hero: {
      ...base.hero,
      org: profile.factoryName || profile.legalName || base.hero.org
    }
  }
})
const brandLogoUrl = computed(() => publishedEnterpriseProfile.value?.logoUrl || '')
const publicContact = computed(() => [
  publishedEnterpriseProfile.value?.contact?.phone,
  publishedEnterpriseProfile.value?.contact?.email
].filter(Boolean).join(' · '))
const profileThemeStyle = computed(() => publishedEnterpriseProfile.value?.themeColor
  ? { '--net': publishedEnterpriseProfile.value.themeColor }
  : {})
const systemUrl = computed(() => {
  const configured = String(getEnterpriseConfig(globalThis)?.endpoints?.publicBaseUrl || '').replace(/\/+$/, '')
  return configured || JINWEI_SYSTEM_URL || (typeof window !== 'undefined' ? window.location.origin : '')
})

const HERO_SLIDES = Object.freeze([
  {
    id: 'entrance',
    image: 'research-gallery/gallery-001.png',
    zh: {
      kicker: 'FACTORY ENTRANCE / 厂区大门',
      titleLead: '经纬网业，',
      titleAccent: '从湛江连接深海。',
      detail: '从厂区大门开始，认识一家专注渔网、绳索与养殖网具的制造企业。',
      caption: '厂区大门',
      captionDetail: '湛江市经纬网厂 · 企业形象',
      alt: '湛江市经纬网厂厂区大门与中英文企业标识'
    },
    en: {
      kicker: 'FACTORY ENTRANCE / JINGWEI NETTING',
      titleLead: 'Jingwei Netting,',
      titleAccent: 'from Zhanjiang to offshore.',
      detail: 'Start at the gate of a manufacturing company focused on netting, rope and aquaculture equipment.',
      caption: 'Factory entrance',
      captionDetail: 'Zhanjiang Jingwei Netting Factory · Company identity',
      alt: 'Jingwei Netting Factory entrance with Chinese and English signage'
    }
  },
  {
    id: 'weaving-floor',
    image: 'research-gallery/gallery-002.png',
    zh: {
      kicker: 'WEAVING FLOOR / 织造现场',
      titleLead: '把每一根线，',
      titleAccent: '织成可交付的网。',
      detail: '多机台织造工位承接线材、网目与尺寸要求，形成可核对的生产规格。',
      caption: '多机台织造',
      captionDetail: '线材准备 · 织造工位 · 过程交接',
      alt: '经纬网厂多机台织造生产车间与线材工位'
    },
    en: {
      kicker: 'WEAVING FLOOR / PRODUCTION',
      titleLead: 'Turn every filament',
      titleAccent: 'into a deliverable net.',
      detail: 'Multi-machine weaving connects yarn, mesh and dimensions to a specification the team can check.',
      caption: 'Multi-machine weaving',
      captionDetail: 'Yarn preparation · weaving stations · process handoff',
      alt: 'Jingwei multi-machine weaving floor with yarn stations'
    }
  },
  {
    id: 'net-assembly',
    image: 'research-gallery/gallery-003.png',
    zh: {
      kicker: 'NET ASSEMBLY / 网衣装配',
      titleLead: '看得见的工位，',
      titleAccent: '撑起每一张大网。',
      detail: '大面积网衣装配与人工检视，把工艺路线落实到现场交接与批次记录。',
      caption: '大面积网衣装配',
      captionDetail: '网衣拼接 · 人工检视 · 尺寸复核',
      alt: '经纬网厂大面积网衣装配车间，工作人员在网面上检修'
    },
    en: {
      kicker: 'NET ASSEMBLY / FIELD WORK',
      titleLead: 'Visible workstations',
      titleAccent: 'support every large net.',
      detail: 'Large net assembly and manual inspection turn the process route into accountable handoffs and batch records.',
      caption: 'Large net assembly',
      captionDetail: 'Net joining · manual inspection · dimensional check',
      alt: 'Jingwei large net assembly floor with workers inspecting a net'
    }
  },
  {
    id: 'offshore-application',
    image: 'research-gallery/gallery-015.jpeg',
    zh: {
      kicker: 'OFFSHORE APPLICATION / 深远海应用',
      titleLead: '从网衣到网箱，',
      titleAccent: '协同每一处连接。',
      detail: '面向深远海养殖场景，按网衣、绳索、框架与连接件的系统边界展开项目评审。',
      caption: '深远海养殖平台',
      captionDetail: '网箱系统 · 工程协同 · 项目评审',
      alt: '深远海养殖平台与大型海上网箱应用场景'
    },
    en: {
      kicker: 'OFFSHORE APPLICATION / CAGE SYSTEMS',
      titleLead: 'From netting to cages,',
      titleAccent: 'coordinate every connection.',
      detail: 'For offshore aquaculture, review the system boundary across netting, rope, frames and connectors.',
      caption: 'Offshore aquaculture platform',
      captionDetail: 'Cage system · engineering coordination · project review',
      alt: 'Offshore aquaculture platform and large marine cage application'
    }
  }
])

const localizedHeroSlides = computed(() => HERO_SLIDES.map((slide) => ({
  id: slide.id,
  image: slide.image,
  ...(isEnglish.value ? slide.en : slide.zh)
})))

const setLocale = (nextLocale) => {
  locale.value = nextLocale === 'en-US' ? 'en-US' : 'zh-CN'
  if (typeof localStorage !== 'undefined') localStorage.setItem('jinwei.site.locale', locale.value)
  if (typeof document !== 'undefined') document.documentElement.lang = locale.value
  installPublicSeo()
}

const scrolled = ref(false)
const mobileNavOpen = ref(false)
const submitting = ref(false)
const submitState = reactive({ tone: 'normal', message: '' })
const loginOpen = ref(false)
const loginLoading = ref(false)
const loginMessage = ref('')
const loginTone = ref('normal')
const LOGIN_USERNAME_STORAGE_KEY = 'jinwei.login.username'
const rememberedLoginUsername = typeof localStorage !== 'undefined'
  ? String(localStorage.getItem(LOGIN_USERNAME_STORAGE_KEY) || '')
  : ''
const loginForm = reactive({ username: rememberedLoginUsername, password: '', remember: Boolean(rememberedLoginUsername) })
const activeHeroSlide = ref(0)
const heroAutoplayPaused = ref(false)
let heroAutoplayTimer = null

const independentSiteAssets = Object.freeze({
  hero: 'research-gallery/gallery-001.png',
  factoryWide: 'research-gallery/gallery-003.png',
  factoryLine: 'research-gallery/gallery-002.png',
  factoryCase: 'research-gallery/gallery-010.webp',
  products: Object.freeze({
    'knotted-net': 'research-gallery/gallery-008.webp',
    'knotless-net': 'research-gallery/gallery-009.webp',
    rope: 'research-gallery/gallery-013.webp',
    'cage-net': 'research-gallery/gallery-005.webp'
  }),
  solutions: Object.freeze({
    'commercial-fishing': 'research-gallery/gallery-011.webp',
    'offshore-aquaculture': 'research-gallery/gallery-006.webp',
    'industrial-intake': 'research-gallery/gallery-010.webp',
    'marine-ranch': 'research-gallery/gallery-026.jpeg',
    yuefuxian: 'research-gallery/gallery-021.jpeg'
  }),
  projects: Object.freeze({
    'field-process': 'research-gallery/gallery-003.png',
    'offshore-reported': 'research-gallery/gallery-015.jpeg',
    'industrial-review': 'research-gallery/gallery-010.webp'
  })
})

const productAsset = (id) => independentSiteAssets.products[id] || independentSiteAssets.products['knotless-net']
const solutionAsset = (id) => independentSiteAssets.solutions[id] || independentSiteAssets.solutions['commercial-fishing']
const projectAsset = (id) => independentSiteAssets.projects[id] || independentSiteAssets.projects['field-process']

const primarySolutions = JINWEI_PUBLIC_SOLUTIONS.filter((item) => item.id !== 'yuefuxian')
const associatedSeafood = JINWEI_PUBLIC_SOLUTIONS.find((item) => item.id === 'yuefuxian')

const productEnglish = Object.freeze({
  'knotted-net': { name: 'Knotted net', short: 'knotted', description: 'Combine material, ply, mesh, dimensions, color and setting direction into one checkable specification.' },
  'knotless-net': { name: 'Knotless net', short: 'knotless', description: 'Warp polyester or nylon yarn for knotless weaving, with hardness, color and multi-unit packing options.' },
  rope: { name: 'Rope', short: 'rope', description: 'Manage twisting and rope making by material, length or weight, inspection and packing unit.' },
  'cage-net': { name: 'Aquaculture cage', short: 'cage', description: 'Coordinate netting, rope, frame, floats and connectors through a project BOM.' }
})

const solutionEnglish = Object.freeze({
  'commercial-fishing': { title: 'Commercial fishing netting', description: 'Turn target species, operating method, construction, mesh and delivery unit into a reviewable specification.' },
  'offshore-aquaculture': { title: 'Offshore aquaculture cage systems', description: 'Coordinate netting, rope, frame, floats and connectors through a project BOM.' },
  'industrial-intake': { title: 'Industrial water netting', description: 'Review material, mesh geometry and inspection requirements for demanding water environments.' },
  'marine-ranch': { title: 'Marine ranch engineering coordination', description: 'Break netting, cages, rope and field delivery into traceable work packages.' },
  yuefuxian: { title: 'Yuefuxian golden pompano', description: 'An associated aquaculture business line, shown separately from netting manufacturing.' }
})

const projectEnglish = Object.freeze({
  'field-process': { title: 'Field chain from drawing to packing', type: 'Factory floor', status: 'Field evidence', description: 'Equipment, workstations and handoff routes shown through factory photography.' },
  'offshore-reported': { title: 'Offshore project lead in public reports', type: 'Engineering research', status: 'Reported lead', description: 'Publicly reported cage and platform application lead; authorize and verify per project.' },
  'industrial-review': { title: 'Industrial water netting review', type: 'Engineering review', status: 'Pending confirmation', description: 'Input list for material, mesh geometry, strength and abrasion; no performance promise.' }
})

const qualityEnglish = Object.freeze({
  'GB/T 6964-2010': { label: 'Mesh size / gauge', detail: 'Measurement method, unit and sampling record' },
  'GB/T 4925-2008': { label: 'Net strength & elongation', detail: 'Sample, method, result and release state' },
  'GB/T 21292-2007': { label: 'Mesh breaking strength', detail: 'Sampling batch and specimen ID' },
  'GB/T 18674-2018': { label: 'Fishing rope', detail: 'Length, weight, inspection and packing unit' },
  'GB/T 40749-2021': { label: 'Cage design inputs', detail: 'BOM, frame, floats and overall inspection' }
})

const specEnglish = Object.freeze({
  material: { label: 'Material', examples: 'PE / nylon / polyester / UHMWPE' },
  construction: { label: 'Construction', examples: 'Single knot / double knot / knotless' },
  yarnSpec: { label: 'Yarn specification', examples: 'Denier / ply / twist' },
  meshSize: { label: 'Mesh size / gauge', examples: 'Inches, MD or customer-defined basis' },
  dimensions: { label: 'Finished dimensions', examples: 'Length x width x depth; MTRS / YDS' },
  color: { label: 'Color', examples: 'Natural white / black-green / blue / brown / custom' },
  finish: { label: 'Finishing', examples: 'Dyeing / hardness / electric or steam setting' },
  weight: { label: 'Weight standard', examples: 'KG/PC and permitted tolerance' },
  packing: { label: 'Packing & marks', examples: 'Pieces/carton, bag, print, lip, side code' }
})

const constructionOptions = computed(() => isEnglish.value
  ? [{ value: '有结单结', label: 'Knotted · single' }, { value: '有结双结', label: 'Knotted · double' }, { value: '无结', label: 'Knotless' }, { value: '绳索', label: 'Rope' }, { value: '网箱组装', label: 'Cage assembly' }]
  : [{ value: '有结单结', label: '有结单结' }, { value: '有结双结', label: '有结双结' }, { value: '无结', label: '无结' }, { value: '绳索', label: '绳索' }, { value: '网箱组装', label: '网箱组装' }])

const localizedProducts = computed(() => JINWEI_PRODUCT_FAMILIES.map((item) => {
  const english = productEnglish[item.id] || {}
  const name = isEnglish.value ? (english.name || item.name) : item.name
  return { ...item, name, short: isEnglish.value ? (english.short || item.short) : item.short, description: isEnglish.value ? (english.description || item.description) : item.description, imageAlt: isEnglish.value ? `${name} manufacturing reference` : `${name}制造现场` }
}))

const localizeSolution = (item) => {
  const english = solutionEnglish[item.id] || {}
  return { ...item, title: isEnglish.value ? (english.title || item.title) : item.title, description: isEnglish.value ? (english.description || item.description) : item.description, englishTitle: isEnglish.value ? (item.englishTitle || english.title || item.title) : item.englishTitle, evidence: isEnglish.value ? ({ '历史样表 + 现场工艺': 'Historical workbook + field process', '项目线索，待企业确认': 'Project lead, confirmation pending', '公开文案方向，参数待确认': 'Public direction, parameters pending', '网衣细节参考，参数待确认': 'Net detail reference, parameters pending', '产业体系叙事，范围待确认': 'Industrial context, scope pending', '关联业务，资质与 SKU 待确认': 'Associated business, credentials and SKUs pending' }[item.evidence] || item.evidence) : item.evidence, imageAlt: isEnglish.value ? `${english.title || item.title} field reference` : `${item.title}现场参考` }
}
const localizedPrimarySolutions = computed(() => primarySolutions.map(localizeSolution))
const localizedAssociatedSeafood = computed(() => localizeSolution(associatedSeafood))
const localizedSpecFields = computed(() => JINWEI_SPEC_FIELDS.map((item) => ({ ...item, ...(isEnglish.value ? (specEnglish[item.key] || {}) : {}) })))
const localizedQualityBaseline = computed(() => JINWEI_QUALITY_BASELINE.map((item) => ({ ...item, ...(isEnglish.value ? (qualityEnglish[item.standard] || {}) : {}) })))
const localizedProjects = computed(() => JINWEI_PUBLIC_PROJECTS.map((item) => ({ ...item, ...(isEnglish.value ? (projectEnglish[item.id] || {}) : {}) })))
const localizedProcess = computed(() => publicProcess.map((item) => ({ no: item.no, title: isEnglish.value ? item.titleEn : item.title, detail: isEnglish.value ? item.detailEn : item.detail })))
const currentHeroSlide = computed(() => localizedHeroSlides.value[activeHeroSlide.value] || localizedHeroSlides.value[0])

const form = reactive({
  productFamily: 'knotless-net',
  material: '',
  construction: '',
  yarnSpec: '',
  meshSize: '',
  dimensions: '',
  color: '',
  weight: '',
  finish: '',
  packing: '',
  quantity: '',
  targetDate: '',
  country: '',
  notes: '',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  consentAccepted: false
})

const publicProcess = [
  { no: '01', title: '规格审核', detail: '把客户表达转换为带版本的规格清单，先处理冲突与缺项。', titleEn: 'Specification review', detailEn: 'Turn the customer brief into a versioned specification and resolve gaps first.' },
  { no: '02', title: '齐套与排产', detail: '核对原料、半成品、包材、外购到货和适配机台。', titleEn: 'Readiness & planning', detailEn: 'Check material, semi-finished goods, packing, purchased items and machine fit.' },
  { no: '03', title: '生产与交接', detail: '各工序按合同和批次扫码领用、报工、移交与接收。', titleEn: 'Production & handoff', detailEn: 'Scan issue, report, transfer and receipt by contract and batch at every step.' },
  { no: '04', title: '检验与追溯', detail: '来料、织造、补网、定型和成品检验关联同一追溯链。', titleEn: 'Inspection & traceability', detailEn: 'Link incoming, weaving, repair, setting and final inspection to one trace.' },
  { no: '05', title: '包装与交付', detail: '包装码绑定唛头、重量和合同归属，支持多批次发货。', titleEn: 'Packing & delivery', detailEn: 'Bind marks, weight and contract ownership to package codes for split delivery.' }
]

const assetUrl = (asset) => `${import.meta.env.BASE_URL}assets/jinwei/${asset}`

const scrollToSection = (id) => {
  mobileNavOpen.value = false
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const goFromMobile = (id) => scrollToSection(id)

const selectProduct = (id) => {
  form.productFamily = id
  scrollToSection('inquiry')
}

const stopHeroAutoplay = () => {
  if (heroAutoplayTimer !== null) {
    window.clearInterval(heroAutoplayTimer)
    heroAutoplayTimer = null
  }
}

const startHeroAutoplay = () => {
  if (heroAutoplayPaused.value || heroAutoplayTimer !== null || localizedHeroSlides.value.length < 2) return
  heroAutoplayTimer = window.setInterval(() => {
    activeHeroSlide.value = (activeHeroSlide.value + 1) % localizedHeroSlides.value.length
  }, 6500)
}

const setHeroSlide = (index) => {
  const total = localizedHeroSlides.value.length
  if (!total) return
  activeHeroSlide.value = (index + total) % total
  if (!heroAutoplayPaused.value) {
    stopHeroAutoplay()
    startHeroAutoplay()
  }
}

const pauseHeroAutoplay = () => {
  heroAutoplayPaused.value = true
  stopHeroAutoplay()
}

const resumeHeroAutoplay = (event) => {
  if (event?.relatedTarget && event.currentTarget?.contains?.(event.relatedTarget)) return
  heroAutoplayPaused.value = false
  startHeroAutoplay()
}

const openLogin = () => {
  mobileNavOpen.value = false
  loginMessage.value = ''
  loginTone.value = 'normal'
  loginOpen.value = true
  if (typeof document !== 'undefined') document.body.style.overflow = 'hidden'
}

const closeLogin = () => {
  if (loginLoading.value) return
  loginOpen.value = false
  if (typeof document !== 'undefined') document.body.style.overflow = ''
}

const submitPortalLogin = async () => {
  loginMessage.value = ''
  loginTone.value = 'normal'
  if (!loginForm.username || !loginForm.password) return
  loginLoading.value = true
  try {
    const payload = await requestPublicJson('/rpc/login', {
      service: 'api',
      method: 'POST',
      body: { username: loginForm.username, password: loginForm.password }
    })
    if (!payload?.token) throw new Error('invalid-login')

    let handoffPayload
    try {
      handoffPayload = await requestPublicJson('/company-site/auth/handoff', {
        service: 'agent',
        method: 'POST',
        headers: { Authorization: `Bearer ${payload.token}` }
      })
    } catch {
      throw new Error('handoff-failed')
    }
    if (!handoffPayload?.code) throw new Error('handoff-failed')

    if (typeof localStorage !== 'undefined') {
      if (loginForm.remember) localStorage.setItem(LOGIN_USERNAME_STORAGE_KEY, loginForm.username)
      else localStorage.removeItem(LOGIN_USERNAME_STORAGE_KEY)
    }
    loginTone.value = 'success'
    loginMessage.value = copy.value.login.verified
    const navigation = navigateExternalHttps(`${systemUrl.value}/auth/handoff?handoff=${encodeURIComponent(handoffPayload.code)}`)
    if (!navigation.ok) throw new Error('handoff-failed')
  } catch (error) {
    loginTone.value = 'error'
    loginMessage.value = error?.message === 'handoff-failed' ? copy.value.login.unavailable : copy.value.login.invalid
  } finally {
    loginLoading.value = false
  }
}

const onKeydown = (event) => {
  if (event.key === 'Escape' && loginOpen.value) closeLogin()
  if (loginOpen.value || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return
  if (event.key === 'ArrowRight') setHeroSlide(activeHeroSlide.value + 1)
  if (event.key === 'ArrowLeft') setHeroSlide(activeHeroSlide.value - 1)
}

const createIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `jinwei-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const submitInquiry = async () => {
  submitState.message = ''
  if (!form.consentAccepted) {
    submitState.tone = 'warning'
    submitState.message = tx('请确认询盘跟进授权后再提交。', 'Please confirm inquiry follow-up consent before submitting.')
    return
  }
  if (!form.email && !form.phone) {
    submitState.tone = 'warning'
    submitState.message = tx('请至少填写邮箱或电话 / WhatsApp。', 'Please provide an email or phone / WhatsApp number.')
    return
  }

    const product = localizedProducts.value.find((item) => item.id === form.productFamily)
    const specification = [
    `${tx('产品', 'Product')}: ${product?.name || form.productFamily}`,
    `${tx('材质', 'Material')}: ${form.material}`,
    `${tx('网结', 'Construction')}: ${form.construction}`,
    `${tx('线规格', 'Yarn specification')}: ${form.yarnSpec}`,
    `${tx('网眼/目数', 'Mesh size / gauge')}: ${form.meshSize}`,
    `${tx('尺寸', 'Dimensions')}: ${form.dimensions}`,
    `${tx('颜色', 'Color')}: ${form.color}`,
    `${tx('重量', 'Weight')}: ${form.weight || tx('待确认', 'Pending')}`,
    `${tx('后处理', 'Finishing')}: ${form.finish || tx('待确认', 'Pending')}`,
    `${tx('包装与唛头', 'Packing & marks')}: ${form.packing}`,
    `${tx('补充', 'Additional notes')}: ${form.notes || tx('无', 'None')}`
  ].join('\n')

  submitting.value = true
  try {
    const payload = await requestPublicJson('/company-site/public/leads', {
      service: 'agent',
      method: 'POST',
      headers: { 'Idempotency-Key': createIdempotencyKey() },
      body: {
        source: 'jinwei-independent-site',
        locale: locale.value,
        pagePath: window.location.pathname,
        companyName: form.companyName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        country: form.country,
        productSlugs: [form.productFamily],
        quantity: form.quantity,
        targetDate: form.targetDate,
        message: specification,
        consent: { accepted: true, purpose: 'inquiry_follow_up', policyVersion: 'v1' }
      }
    })
    submitState.tone = 'success'
    submitState.message = payload?.lead?.publicRef
      ? `${tx('已提交，询盘编号', 'Submitted. Inquiry reference')} ${payload.lead.publicRef}`
      : tx('规格询盘已提交，我们将进行人工审核。', 'Specification request submitted. Our team will review it manually.')
  } catch (error) {
    submitState.tone = 'warning'
    submitState.message = `${error?.displayMessage || tx('询盘服务暂时不可用', 'Inquiry service is temporarily unavailable')}. ${tx('本页不会在浏览器中保存你的联系信息。', 'This page does not store your contact details in the browser.')}`
  } finally {
    submitting.value = false
  }
}

const onScroll = () => {
  scrolled.value = window.scrollY > 24
  if (window.scrollY > 24) mobileNavOpen.value = false
}
const setMeta = (name, content) => {
  if (!content) return
  let node = document.head.querySelector(`meta[name="${name}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute('name', name)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

const installPublicSeo = () => {
  const profile = publishedEnterpriseProfile.value
  document.title = profile?.seo?.title || tx('湛江市经纬网厂 | 渔网、绳索与深水网箱', 'Jingwei Netting Factory | Nets, Rope & Offshore Cages')
  setMeta('description', profile?.seo?.description || profile?.description || tx('湛江市经纬网厂提供有结网、无结网、绳索、养殖网箱及工程协同方案。', 'Jingwei Netting Factory supplies knotted and knotless netting, rope, aquaculture cages and coordinated engineering packages.'))
  setMeta('keywords', profile?.seo?.keywords || tx('渔网厂家,无结网厂家,深水网箱,渔用绳索,海洋牧场', 'fishing net factory,knotless net,deep sea cage,fishing rope,marine ranching'))
  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', profile?.publicSiteUrl || `${window.location.origin}/company-site/jinwei`)
  let structuredData = document.head.querySelector('script[data-jinwei-structured-data]')
  if (!structuredData) {
    structuredData = document.createElement('script')
    structuredData.type = 'application/ld+json'
    structuredData.dataset.jinweiStructuredData = 'true'
    document.head.appendChild(structuredData)
  }
  structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: profile?.legalName || profile?.displayName || tx('湛江市经纬网厂', 'Jingwei Netting Factory'),
    url: profile?.publicSiteUrl || `${window.location.origin}/company-site/jinwei`,
    logo: profile?.logoUrl || undefined,
    description: profile?.description || tx('渔网、绳索、养殖网箱与工程协同', 'Netting, rope, aquaculture cages and engineering coordination'),
    email: profile?.contact?.email || undefined,
    telephone: profile?.contact?.phone || undefined
  })
}

const loadPublishedEnterpriseProfile = async () => {
  try {
    const payload = await requestPublicJson(`/company-site/public/site-config?locale=${encodeURIComponent(locale.value)}`, {
      service: 'agent',
      credentials: 'same-origin'
    })
    const profile = enterpriseProfileFromSiteConfig(payload, {
      enterpriseConfig: getEnterpriseConfig(globalThis)
    })
    if (profile.source !== 'published-site') return
    publishedEnterpriseProfile.value = profile
    installPublicSeo()
  } catch {
    // Keep the reviewed static page copy as an offline fallback.
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('keydown', onKeydown)
  document.documentElement.lang = locale.value
  installPublicSeo()
  loadPublishedEnterpriseProfile()
  startHeroAutoplay()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  stopHeroAutoplay()
})
return {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Close,
  DocumentChecked,
  EN_COPY,
  HERO_SLIDES,
  JINWEI_PRODUCT_FAMILIES,
  JINWEI_PUBLIC_PROJECTS,
  JINWEI_PUBLIC_SOLUTIONS,
  JINWEI_QUALITY_BASELINE,
  JINWEI_SPEC_FIELDS,
  JINWEI_SYSTEM_URL,
  Key,
  LOGIN_USERNAME_STORAGE_KEY,
  Loading,
  Lock,
  Menu,
  Setting,
  Top,
  View,
  Warning,
  ZH_COPY,
  activeHeroSlide,
  assetUrl,
  associatedSeafood,
  brandLogoUrl,
  closeLogin,
  computed,
  constructionOptions,
  copy,
  createIdempotencyKey,
  currentHeroSlide,
  enterpriseProfileFromSiteConfig,
  form,
  getEnterpriseConfig,
  goFromMobile,
  heroAutoplayPaused,
  heroAutoplayTimer,
  independentSiteAssets,
  installPublicSeo,
  isEnglish,
  loadPublishedEnterpriseProfile,
  locale,
  localizeSolution,
  localizedAssociatedSeafood,
  localizedHeroSlides,
  localizedPrimarySolutions,
  localizedProcess,
  localizedProducts,
  localizedProjects,
  localizedQualityBaseline,
  localizedSpecFields,
  loginForm,
  loginLoading,
  loginMessage,
  loginOpen,
  loginTone,
  mobileNavOpen,
  navigateExternalHttps,
  onBeforeUnmount,
  onKeydown,
  onMounted,
  onScroll,
  openLogin,
  pauseHeroAutoplay,
  primarySolutions,
  productAsset,
  productEnglish,
  profileThemeStyle,
  projectAsset,
  projectEnglish,
  publicContact,
  publicProcess,
  publishedEnterpriseProfile,
  qualityEnglish,
  reactive,
  ref,
  rememberedLoginUsername,
  resumeHeroAutoplay,
  scrollToSection,
  scrolled,
  selectProduct,
  setHeroSlide,
  setLocale,
  setMeta,
  solutionAsset,
  solutionEnglish,
  specEnglish,
  startHeroAutoplay,
  stopHeroAutoplay,
  submitInquiry,
  submitPortalLogin,
  submitState,
  submitting,
  systemUrl,
  tx,
}
}
