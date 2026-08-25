<template>
  <div class="jinwei-site">
    <header class="site-nav" :class="{ compact: scrolled }">
      <button class="brand-lockup" type="button" aria-label="返回经纬网业首页" @click="scrollToSection('top')">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span><strong>经纬网业</strong><small>JINGWEI NETTING</small></span>
      </button>
      <nav aria-label="页面导航">
        <button type="button" @click="scrollToSection('products')">产品</button>
        <button type="button" @click="scrollToSection('capability')">制造</button>
        <button type="button" @click="scrollToSection('process')">流程</button>
        <button type="button" @click="scrollToSection('inquiry')">规格询盘</button>
      </nav>
      <div class="nav-actions">
        <button class="system-link" type="button" title="打开经纬制造协同台" @click="router.push('/jinwei/manufacturing')">
          <el-icon><DataBoard /></el-icon><span>制造系统</span>
        </button>
        <button class="nav-cta" type="button" @click="scrollToSection('inquiry')">提交规格<el-icon><ArrowRight /></el-icon></button>
      </div>
    </header>

    <main>
      <section id="top" class="hero" aria-labelledby="hero-title">
        <img :src="assetUrl('hero-net.webp')" alt="经纬网厂车间内展开的无结网成品" fetchpriority="high">
        <div class="hero-shade" aria-hidden="true"></div>
        <div class="hero-content">
          <p class="hero-kicker">Zhanjiang · Netting manufacture</p>
          <h1 id="hero-title">湛江市经纬网厂</h1>
          <p class="hero-lead">有结网、无结网、绳索与养殖网箱，从线材准备、织造和人工检修，到定型、包装与分批交付。</p>
          <div class="hero-actions">
            <button class="hero-primary" type="button" @click="scrollToSection('inquiry')">按规格询盘<el-icon><ArrowRight /></el-icon></button>
            <button class="hero-secondary" type="button" @click="scrollToSection('capability')"><el-icon><View /></el-icon>查看制造现场</button>
          </div>
        </div>
        <div class="hero-index" aria-label="产品范围">
          <span>有结网</span><span>无结网</span><span>绳索</span><span>养殖网箱</span>
        </div>
      </section>

      <section class="proof-band" aria-label="制造依据">
        <div><span>01</span><strong>规格驱动</strong><small>材质、股数、网眼、尺寸、颜色与包装逐项确认</small></div>
        <div><span>02</span><strong>工序可追溯</strong><small>合同、批次、机台、人员、检验与包装码贯通</small></div>
        <div><span>03</span><strong>多路线协同</strong><small>本厂织造、外协回网、染色和分批交付统一衔接</small></div>
      </section>

      <section id="products" class="products-section section-shell">
        <div class="section-intro">
          <p class="section-label">PRODUCT RANGE</p>
          <h2>围绕用途定义网，而不是套用单一规格</h2>
          <p>每个询盘先形成可核对的规格版本，再进入库存齐套、机台匹配和交付评估。</p>
        </div>
        <div class="product-grid">
          <article v-for="(product, index) in JINWEI_PRODUCT_FAMILIES" :key="product.id" class="product-card">
            <div class="product-image"><img :src="assetUrl(product.asset)" :alt="`${product.name}制造现场`" loading="lazy"><span>{{ String(index + 1).padStart(2, '0') }}</span></div>
            <div class="product-copy">
              <h3>{{ product.name }}</h3>
              <p>{{ product.description }}</p>
              <button type="button" @click="selectProduct(product.id)">提交{{ product.short }}规格<el-icon><ArrowRight /></el-icon></button>
            </div>
          </article>
        </div>
      </section>

      <section class="spec-ribbon" aria-labelledby="spec-title">
        <div class="spec-ribbon-head">
          <p class="section-label">SPECIFICATION LOOM</p>
          <h2 id="spec-title">一张规格单，贯穿报价、排产、检验与包装</h2>
        </div>
        <div class="spec-lines">
          <div v-for="(field, index) in JINWEI_SPEC_FIELDS" :key="field.key" class="spec-cell">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ field.label }}</strong>
            <small>{{ field.examples }}</small>
          </div>
        </div>
      </section>

      <section id="capability" class="capability-section">
        <div class="section-shell capability-shell">
          <div class="capability-copy">
            <p class="section-label">FACTORY FLOOR</p>
            <h2>制造能力来自可见的设备、工位与交接</h2>
            <p>现场调研覆盖原料、拉丝与温控、整经盘头、织网、人工检修、热定型、包装及仓储。每一处实物标识，都会在系统中转成可扫描、可校验的批次记录。</p>
            <dl>
              <div><dt>原料准备</dt><dd>聚乙烯、尼龙、涤纶及外购纱线按批次接收</dd></div>
              <div><dt>织造路线</dt><dd>有结、无结、捻线与成绳按产品工艺分支</dd></div>
              <div><dt>后处理</dt><dd>人工补网、委外染色、电热或蒸汽定型</dd></div>
              <div><dt>交付控制</dt><dd>条/件换算、包装唛头、合同归属与分批出库</dd></div>
            </dl>
          </div>
          <div class="factory-gallery">
            <figure class="gallery-wide"><img :src="assetUrl('weaving-floor.webp')" alt="经纬网厂织网设备生产区域" loading="lazy"><figcaption><span>织造</span>多机台生产区</figcaption></figure>
            <figure><img :src="assetUrl('extrusion-line.webp')" alt="聚合物拉丝挤出生产线" loading="lazy"><figcaption><span>制线</span>挤出与拉丝</figcaption></figure>
            <figure><img :src="assetUrl('heat-setting.webp')" alt="网具热处理定型设备" loading="lazy"><figcaption><span>后处理</span>热定型</figcaption></figure>
          </div>
        </div>
      </section>

      <section id="process" class="process-section section-shell">
        <div class="section-intro process-intro">
          <p class="section-label">ORDER JOURNEY</p>
          <h2>从客户规格到包装码，状态不再散落在多张表里</h2>
        </div>
        <ol class="process-list">
          <li v-for="step in publicProcess" :key="step.no">
            <span>{{ step.no }}</span>
            <div><strong>{{ step.title }}</strong><p>{{ step.detail }}</p></div>
          </li>
        </ol>
      </section>

      <section id="inquiry" class="inquiry-section">
        <div class="section-shell inquiry-shell">
          <div class="inquiry-copy">
            <p class="section-label">SPECIFICATION REQUEST</p>
            <h2>把关键规格一次说清楚</h2>
            <p>提交后进入人工审核。价格、库存、产能与交期只有在规格版本锁定并完成齐套检查后才会确认。</p>
            <div class="inquiry-note">
              <el-icon><DocumentChecked /></el-icon>
              <div><strong>规格先行</strong><span>缺少关键字段时不会直接生成正式订单或生产任务。</span></div>
            </div>
          </div>

          <form class="inquiry-form" @submit.prevent="submitInquiry">
            <fieldset>
              <legend><span>01</span>产品与规格</legend>
              <div class="form-grid form-grid-three">
                <label><span>产品类型 *</span><select v-model="form.productFamily" required><option v-for="product in JINWEI_PRODUCT_FAMILIES" :key="product.id" :value="product.id">{{ product.name }}</option></select></label>
                <label><span>材质 *</span><input v-model.trim="form.material" required maxlength="120" placeholder="如：涤纶 / 尼龙 / 聚乙烯"></label>
                <label><span>网结类型 *</span><select v-model="form.construction" required><option value="" disabled>请选择</option><option>有结单结</option><option>有结双结</option><option>无结</option><option>绳索</option><option>网箱组装</option></select></label>
                <label><span>线规格 / 股数 *</span><input v-model.trim="form.yarnSpec" required maxlength="120" placeholder="如：210D / PLY3"></label>
                <label><span>网眼 / 目数 *</span><input v-model.trim="form.meshSize" required maxlength="120" placeholder="如：3/8 英寸"></label>
                <label><span>成品尺寸 *</span><input v-model.trim="form.dimensions" required maxlength="160" placeholder="长 x 宽 x 深，注明单位"></label>
                <label><span>颜色 *</span><input v-model.trim="form.color" required maxlength="100" placeholder="如：原白 / 深黑青"></label>
                <label><span>重量标准</span><input v-model.trim="form.weight" maxlength="120" placeholder="如：KG/PC 与允许偏差"></label>
                <label><span>后处理</span><input v-model.trim="form.finish" maxlength="160" placeholder="染色、硬度、定型要求"></label>
              </div>
              <label class="full-field"><span>包装与唛头 *</span><textarea v-model.trim="form.packing" required maxlength="500" rows="3" placeholder="条/件、袋色、印刷版、侧边编号、重量与唛头要求"></textarea></label>
            </fieldset>

            <fieldset>
              <legend><span>02</span>采购需求</legend>
              <div class="form-grid form-grid-three">
                <label><span>需求数量 *</span><input v-model.trim="form.quantity" required maxlength="120" placeholder="数量及单位"></label>
                <label><span>目标日期</span><input v-model="form.targetDate" type="date"></label>
                <label><span>交付地区</span><input v-model.trim="form.country" maxlength="100" placeholder="国家 / 地区"></label>
              </div>
              <label class="full-field"><span>用途与补充要求</span><textarea v-model.trim="form.notes" maxlength="1000" rows="3" placeholder="应用场景、分批交付、检验或其他要求"></textarea></label>
            </fieldset>

            <fieldset>
              <legend><span>03</span>联系信息</legend>
              <div class="form-grid form-grid-two">
                <label><span>企业名称 *</span><input v-model.trim="form.companyName" required maxlength="160"></label>
                <label><span>联系人 *</span><input v-model.trim="form.contactName" required maxlength="100"></label>
                <label><span>邮箱</span><input v-model.trim="form.email" type="email" maxlength="200"></label>
                <label><span>电话 / WhatsApp *</span><input v-model.trim="form.phone" required maxlength="80"></label>
              </div>
              <label class="consent-row"><input v-model="form.consentAccepted" type="checkbox"><span>我同意使用本次提交的信息进行询盘跟进。*</span></label>
            </fieldset>

            <div v-if="submitState.message" class="submit-feedback" :class="`is-${submitState.tone}`" role="status">
              <el-icon><CircleCheck v-if="submitState.tone === 'success'" /><Warning v-else /></el-icon>
              <span>{{ submitState.message }}</span>
            </div>
            <button class="submit-button" type="submit" :disabled="submitting">
              <el-icon v-if="submitting" class="is-loading"><Loading /></el-icon>
              <span>{{ submitting ? '正在提交' : '提交规格询盘' }}</span><el-icon v-if="!submitting"><ArrowRight /></el-icon>
            </button>
          </form>
        </div>
      </section>
    </main>

    <footer>
      <div class="footer-brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>经纬网业</strong></div>
      <p>湛江 · 渔网、绳索与养殖网具制造</p>
      <button type="button" @click="scrollToSection('top')" title="返回顶部"><el-icon><Top /></el-icon></button>
    </footer>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CircleCheck, DataBoard, DocumentChecked, Loading, Top, View, Warning } from '@element-plus/icons-vue'
import { JINWEI_PRODUCT_FAMILIES, JINWEI_SPEC_FIELDS } from '@/jinwei/model.js'

const router = useRouter()
const scrolled = ref(false)
const submitting = ref(false)
const submitState = reactive({ tone: 'normal', message: '' })

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
  { no: '01', title: '规格审核', detail: '把客户表达转换为带版本的规格清单，先处理冲突与缺项。' },
  { no: '02', title: '齐套与排产', detail: '核对原料、半成品、包材、外购到货和适配机台。' },
  { no: '03', title: '生产与交接', detail: '各工序按合同和批次扫码领用、报工、移交与接收。' },
  { no: '04', title: '检验与追溯', detail: '来料、织造、补网、定型和成品检验关联同一追溯链。' },
  { no: '05', title: '包装与交付', detail: '包装码绑定唛头、重量和合同归属，支持多批次发货。' }
]

const assetUrl = (asset) => `${import.meta.env.BASE_URL}assets/jinwei/${asset}`

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const selectProduct = (id) => {
  form.productFamily = id
  scrollToSection('inquiry')
}

const createIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `jinwei-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const submitInquiry = async () => {
  submitState.message = ''
  if (!form.consentAccepted) {
    submitState.tone = 'warning'
    submitState.message = '请确认询盘跟进授权后再提交。'
    return
  }
  if (!form.email && !form.phone) {
    submitState.tone = 'warning'
    submitState.message = '请至少填写邮箱或电话 / WhatsApp。'
    return
  }

  const product = JINWEI_PRODUCT_FAMILIES.find((item) => item.id === form.productFamily)
  const specification = [
    `产品：${product?.name || form.productFamily}`,
    `材质：${form.material}`,
    `网结：${form.construction}`,
    `线规格：${form.yarnSpec}`,
    `网眼/目数：${form.meshSize}`,
    `尺寸：${form.dimensions}`,
    `颜色：${form.color}`,
    `重量：${form.weight || '待确认'}`,
    `后处理：${form.finish || '待确认'}`,
    `包装与唛头：${form.packing}`,
    `补充：${form.notes || '无'}`
  ].join('\n')

  submitting.value = true
  try {
    const response = await fetch('/agent/company-site/public/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': createIdempotencyKey() },
      body: JSON.stringify({
        source: 'jinwei-independent-site',
        locale: 'zh-CN',
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
      })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || '询盘服务暂时不可用')
    submitState.tone = 'success'
    submitState.message = payload?.lead?.publicRef ? `已提交，询盘编号 ${payload.lead.publicRef}` : '规格询盘已提交，我们将进行人工审核。'
  } catch (error) {
    submitState.tone = 'warning'
    submitState.message = `${error?.message || '询盘服务暂时不可用'}。本页不会在浏览器中保存你的联系信息。`
  } finally {
    submitting.value = false
  }
}

const onScroll = () => { scrolled.value = window.scrollY > 24 }
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped>
.jinwei-site {
  --ink: #142620;
  --muted: #62716b;
  --paper: #f5f7f4;
  --white: #fff;
  --net: #1f6755;
  --ocean: #164656;
  --signal: #e1b444;
  --clay: #bd593f;
  --line: #d9e0dc;
  min-height: 100vh;
  color: var(--ink);
  background: var(--paper);
  font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif;
  letter-spacing: 0;
}

button, input, select, textarea { font: inherit; letter-spacing: 0; }
button { cursor: pointer; }
.section-shell { width: min(1320px, calc(100% - 64px)); margin: 0 auto; }
.section-label { margin: 0 0 12px; color: var(--net); font: 700 11px/1.2 "Arial Narrow", Arial, sans-serif; letter-spacing: 1.6px; }

.site-nav { position: fixed; z-index: 20; top: 0; right: 0; left: 0; display: grid; grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr); align-items: center; gap: 22px; height: 82px; padding: 0 36px; color: #fff; border-bottom: 1px solid rgba(255,255,255,.24); transition: height .2s ease, background .2s ease, color .2s ease, box-shadow .2s ease; }
.site-nav.compact { height: 66px; color: var(--ink); background: rgba(255,255,255,.97); border-color: var(--line); box-shadow: 0 8px 26px rgba(20,38,32,.08); }
.brand-lockup, .footer-brand { display: inline-flex; align-items: center; gap: 11px; width: fit-content; padding: 0; color: inherit; border: 0; background: transparent; text-align: left; }
.brand-lockup > span:last-child { display: grid; gap: 2px; }
.brand-lockup strong { font-size: 17px; line-height: 1; }
.brand-lockup small { font: 700 8px/1 "Arial Narrow", Arial, sans-serif; letter-spacing: 1.3px; }
.brand-mark { position: relative; display: grid; grid-template-columns: repeat(2, 9px); grid-template-rows: repeat(2, 9px); gap: 3px; width: 25px; height: 25px; transform: rotate(45deg); }
.brand-mark i { display: block; border: 2px solid currentColor; }
.site-nav nav { display: flex; align-items: center; justify-content: center; gap: 28px; }
.site-nav nav button { padding: 9px 0; color: inherit; border: 0; background: transparent; font-size: 13px; }
.site-nav nav button:hover { color: var(--signal); }
.nav-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.system-link, .nav-cta, .hero-primary, .hero-secondary, .submit-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 0 16px; border-radius: 3px; }
.system-link { color: inherit; border: 0; background: transparent; }
.nav-cta { color: #10231d; border: 1px solid var(--signal); background: var(--signal); font-weight: 700; }

.hero { position: relative; display: flex; min-height: 680px; height: 88vh; max-height: 900px; overflow: hidden; color: #fff; background: #243b34; }
.hero > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 55%; }
.hero-shade { position: absolute; inset: 0 38% 0 0; background: rgba(11,32,27,.78); }
.hero-content { position: relative; z-index: 1; align-self: center; width: min(760px, calc(100% - 64px)); margin-left: max(32px, calc((100% - 1320px) / 2)); padding-top: 56px; }
.hero-kicker { margin: 0 0 18px; color: #cbdcd5; font: 700 11px/1.2 "Arial Narrow", Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; }
.hero h1 { max-width: 650px; margin: 0; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 66px; font-weight: 700; line-height: 1.08; letter-spacing: 0; }
.hero-lead { max-width: 680px; margin: 24px 0 0; color: #e2ebe7; font-size: 18px; line-height: 1.75; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
.hero-primary, .hero-secondary { min-height: 48px; padding: 0 21px; font-weight: 700; }
.hero-primary { color: #11261f; border: 1px solid var(--signal); background: var(--signal); }
.hero-secondary { color: #fff; border: 1px solid rgba(255,255,255,.65); background: rgba(9,29,25,.28); }
.hero-index { position: absolute; z-index: 2; right: max(32px, calc((100% - 1320px) / 2)); bottom: 32px; display: grid; grid-template-columns: repeat(2, 150px); gap: 1px; background: rgba(255,255,255,.42); }
.hero-index span { display: flex; align-items: center; min-height: 42px; padding: 0 14px; background: rgba(12,35,30,.72); font-size: 12px; }

.proof-band { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); min-height: 118px; color: #fff; background: var(--ocean); }
.proof-band > div { display: grid; grid-template-columns: auto minmax(0,1fr); align-content: center; gap: 4px 14px; padding: 24px max(24px, calc((100vw - 1320px) / 6)); border-right: 1px solid rgba(255,255,255,.16); }
.proof-band > div:last-child { border-right: 0; }
.proof-band span { grid-row: 1 / 3; align-self: start; color: var(--signal); font: 700 13px "Arial Narrow", Arial, sans-serif; }
.proof-band strong { font-size: 14px; }
.proof-band small { color: #c8d9dd; font-size: 11px; line-height: 1.5; }

.products-section { padding: 104px 0 112px; }
.section-intro { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr); gap: 50px; align-items: end; margin-bottom: 42px; }
.section-intro .section-label { grid-column: 1 / -1; margin-bottom: -34px; }
.section-intro h2, .spec-ribbon h2, .capability-copy h2, .inquiry-copy h2 { margin: 0; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 40px; line-height: 1.28; letter-spacing: 0; }
.section-intro > p:last-child, .capability-copy > p, .inquiry-copy > p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.8; }
.product-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.product-card { display: grid; grid-template-columns: minmax(210px, .9fr) minmax(0, 1.1fr); min-height: 290px; overflow: hidden; border: 1px solid var(--line); border-radius: 4px; background: #fff; }
.product-image { position: relative; min-height: 290px; overflow: hidden; }
.product-image img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
.product-card:hover .product-image img { transform: scale(1.025); }
.product-image span { position: absolute; top: 14px; left: 14px; display: grid; place-items: center; width: 34px; height: 34px; color: #fff; background: rgba(18,38,32,.78); font: 700 11px "Arial Narrow", Arial, sans-serif; }
.product-copy { display: flex; flex-direction: column; justify-content: center; padding: 30px; }
.product-copy h3 { margin: 0 0 13px; font-size: 23px; }
.product-copy p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.75; }
.product-copy button { display: inline-flex; align-items: center; gap: 6px; width: fit-content; margin-top: 25px; padding: 8px 0; color: var(--net); border: 0; border-bottom: 1px solid var(--net); background: transparent; font-weight: 700; font-size: 12px; }

.spec-ribbon { padding: 70px max(32px, calc((100% - 1320px) / 2)); color: #fff; background: #192f28; }
.spec-ribbon-head { display: grid; grid-template-columns: minmax(280px, .8fr) minmax(0, 1.2fr); align-items: end; gap: 50px; margin-bottom: 40px; }
.spec-ribbon .section-label { color: var(--signal); }
.spec-ribbon h2 { font-size: 34px; }
.spec-lines { display: grid; grid-template-columns: repeat(9, minmax(124px, 1fr)); overflow-x: auto; border-top: 1px solid rgba(255,255,255,.28); border-bottom: 1px solid rgba(255,255,255,.28); scrollbar-width: thin; }
.spec-cell { position: relative; display: grid; align-content: start; gap: 8px; min-height: 160px; padding: 20px 16px; border-right: 1px solid rgba(255,255,255,.18); }
.spec-cell::after { content: ''; position: absolute; right: -3px; top: 50%; width: 5px; height: 5px; background: var(--signal); transform: rotate(45deg); }
.spec-cell:last-child { border-right: 0; }
.spec-cell:last-child::after { display: none; }
.spec-cell span { color: var(--signal); font: 700 10px "Arial Narrow", Arial, sans-serif; }
.spec-cell strong { font-size: 14px; }
.spec-cell small { color: #afc2ba; font-size: 10px; line-height: 1.55; }

.capability-section { padding: 110px 0; background: #e9efeb; }
.capability-shell { display: grid; grid-template-columns: minmax(320px, .72fr) minmax(0, 1.28fr); gap: 66px; align-items: center; }
.capability-copy h2 { margin-bottom: 22px; }
.capability-copy dl { margin: 32px 0 0; border-top: 1px solid #bdcac3; }
.capability-copy dl > div { display: grid; grid-template-columns: 98px minmax(0, 1fr); gap: 18px; padding: 14px 0; border-bottom: 1px solid #bdcac3; }
.capability-copy dt { color: var(--net); font-weight: 700; font-size: 12px; }
.capability-copy dd { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.factory-gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: 310px 230px; gap: 12px; }
.factory-gallery figure { position: relative; margin: 0; overflow: hidden; background: #cbd5cf; }
.factory-gallery .gallery-wide { grid-column: 1 / -1; }
.factory-gallery img { width: 100%; height: 100%; object-fit: cover; }
.factory-gallery figcaption { position: absolute; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 14px; color: #fff; background: rgba(15,35,29,.82); font-size: 11px; }
.factory-gallery figcaption span { color: var(--signal); font-weight: 700; }

.process-section { padding: 106px 0; }
.process-intro { grid-template-columns: minmax(0, 1fr); max-width: 840px; }
.process-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.process-list li { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 20px; min-height: 118px; padding: 25px 0; border-bottom: 1px solid var(--line); }
.process-list > li > span { color: var(--clay); font: 700 15px "Arial Narrow", Arial, sans-serif; }
.process-list strong { font-size: 19px; }
.process-list p { max-width: 760px; margin: 8px 0 0; color: var(--muted); font-size: 13px; line-height: 1.65; }

.inquiry-section { padding: 104px 0; color: #fff; background: var(--ocean); }
.inquiry-shell { display: grid; grid-template-columns: minmax(300px, .65fr) minmax(520px, 1.35fr); gap: 70px; align-items: start; }
.inquiry-copy { position: sticky; top: 96px; }
.inquiry-copy .section-label { color: var(--signal); }
.inquiry-copy h2 { margin-bottom: 22px; }
.inquiry-copy > p { color: #c7d9dd; }
.inquiry-note { display: flex; gap: 12px; margin-top: 30px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.25); }
.inquiry-note > .el-icon { flex: 0 0 auto; color: var(--signal); font-size: 22px; }
.inquiry-note div { display: grid; gap: 5px; }
.inquiry-note strong { font-size: 13px; }
.inquiry-note span { color: #b8cdd1; font-size: 11px; line-height: 1.55; }
.inquiry-form { padding: 34px; color: var(--ink); border-radius: 4px; background: #fff; }
.inquiry-form fieldset { margin: 0 0 34px; padding: 0; border: 0; }
.inquiry-form legend { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 18px; padding: 0 0 12px; border-bottom: 1px solid var(--line); font-weight: 750; font-size: 15px; }
.inquiry-form legend span { color: var(--clay); font: 700 11px "Arial Narrow", Arial, sans-serif; }
.form-grid { display: grid; gap: 15px; }
.form-grid-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.form-grid-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.inquiry-form label { display: grid; gap: 7px; min-width: 0; }
.inquiry-form label > span { color: #42544d; font-size: 11px; font-weight: 650; }
.inquiry-form input:not([type="checkbox"]), .inquiry-form select, .inquiry-form textarea { width: 100%; min-height: 43px; padding: 9px 11px; color: var(--ink); border: 1px solid #cbd5d0; border-radius: 2px; outline: none; background: #fbfcfb; font-size: 12px; }
.inquiry-form textarea { min-height: 78px; resize: vertical; line-height: 1.55; }
.inquiry-form input:focus, .inquiry-form select:focus, .inquiry-form textarea:focus { border-color: var(--net); box-shadow: 0 0 0 3px rgba(31,103,85,.12); }
.full-field { margin-top: 15px; }
.consent-row { grid-template-columns: 18px minmax(0, 1fr); align-items: center; gap: 9px !important; margin-top: 16px; }
.consent-row input { width: 17px; height: 17px; accent-color: var(--net); }
.consent-row span { font-weight: 500 !important; }
.submit-feedback { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 14px; padding: 11px 12px; border: 1px solid; font-size: 12px; line-height: 1.5; }
.submit-feedback.is-success { color: #205f4e; border-color: #83b3a4; background: #eef7f3; }
.submit-feedback.is-warning { color: #7d4d18; border-color: #d8af74; background: #fff8ec; }
.submit-button { width: 100%; min-height: 50px; color: #fff; border: 1px solid var(--net); background: var(--net); font-weight: 750; }
.submit-button:disabled { cursor: wait; opacity: .7; }

footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 120px; padding: 24px max(32px, calc((100% - 1320px) / 2)); color: #d5e0dc; background: #10241e; }
.footer-brand { color: #fff; }
footer p { margin: 0; color: #9fb3ab; font-size: 11px; }
footer > button { display: grid; place-items: center; width: 42px; height: 42px; color: #fff; border: 1px solid #526b61; border-radius: 50%; background: transparent; }

@media (max-width: 1080px) {
  .site-nav { grid-template-columns: minmax(190px, 1fr) auto; }
  .site-nav nav { display: none; }
  .hero-shade { right: 22%; }
  .hero-index { display: none; }
  .product-card { grid-template-columns: 1fr; }
  .product-image { min-height: 230px; }
  .capability-shell { grid-template-columns: 1fr; }
  .capability-copy { max-width: 760px; }
  .inquiry-shell { grid-template-columns: 1fr; gap: 40px; }
  .inquiry-copy { position: static; max-width: 760px; }
}

@media (max-width: 760px) {
  .section-shell { width: calc(100% - 28px); }
  .site-nav, .site-nav.compact { height: 62px; padding: 0 14px; }
  .brand-lockup small { display: none; }
  .system-link span { display: none; }
  .system-link { width: 40px; padding: 0; }
  .nav-cta { min-height: 38px; padding: 0 11px; font-size: 11px; }
  .hero { min-height: 620px; height: 82svh; max-height: 760px; }
  .hero > img { object-position: 60% center; }
  .hero-shade { right: 0; background: rgba(11,32,27,.68); }
  .hero-content { width: calc(100% - 28px); margin: 0 14px; padding-top: 34px; }
  .hero h1 { font-size: 42px; }
  .hero-lead { font-size: 15px; }
  .hero-actions { flex-direction: column; align-items: stretch; }
  .proof-band { grid-template-columns: 1fr; }
  .proof-band > div { min-height: 88px; padding: 18px 20px; border-right: 0; border-bottom: 1px solid rgba(255,255,255,.16); }
  .products-section, .process-section { padding: 74px 0; }
  .section-intro { grid-template-columns: 1fr; gap: 18px; margin-bottom: 28px; }
  .section-intro .section-label { margin-bottom: 0; }
  .section-intro h2, .spec-ribbon h2, .capability-copy h2, .inquiry-copy h2 { font-size: 30px; }
  .product-grid { grid-template-columns: 1fr; }
  .product-card { min-height: 0; }
  .product-image { min-height: 210px; }
  .product-copy { padding: 24px 20px; }
  .spec-ribbon { padding: 56px 14px; }
  .spec-ribbon-head { grid-template-columns: 1fr; gap: 14px; }
  .spec-lines { grid-template-columns: repeat(9, 154px); }
  .capability-section { padding: 74px 0; }
  .capability-shell { gap: 36px; }
  .factory-gallery { grid-template-rows: 230px 180px; }
  .process-list li { grid-template-columns: 44px minmax(0, 1fr); min-height: 104px; }
  .inquiry-section { padding: 70px 0; }
  .inquiry-form { padding: 24px 16px; }
  .form-grid-three, .form-grid-two { grid-template-columns: 1fr; }
  footer { align-items: flex-start; flex-wrap: wrap; padding: 28px 18px; }
  footer p { order: 3; width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .site-nav, .product-image img { transition: none; }
  html:focus-within { scroll-behavior: auto; }
}
</style>
