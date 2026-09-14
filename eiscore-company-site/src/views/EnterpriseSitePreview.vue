<template>
  <main
    class="enterprise-preview"
    :style="previewStyle"
  >
    <div v-if="loading" class="state-panel">正在加载企业案例…</div>
    <div v-else-if="errorMessage" class="state-panel state-error">
      <strong>企业案例暂时无法加载</strong>
      <span>{{ errorMessage }}</span>
    </div>
    <template v-else>
      <div class="preview-notice">
        <span>{{ preview.previewLabel }}</span>
        <span>资料状态：{{ factStatusLabel }}</span>
        <span>非生产发布</span>
      </div>

      <header class="site-header">
        <a class="brand" href="#top" aria-label="返回页面顶部">
          <span class="brand-mark">NP</span>
          <span><strong>{{ preview.brandName }}</strong><small>{{ preview.enterpriseName }}</small></span>
        </a>
        <nav aria-label="页面导航">
          <a href="#chain">产业链</a>
          <a href="#products">产品方向</a>
          <a href="#solutions">应用场景</a>
          <a href="#capabilities">协同能力</a>
        </nav>
      </header>

      <section id="top" class="hero-section">
        <div class="hero-copy">
          <p class="eyebrow">{{ preview.hero.eyebrow }}</p>
          <h1><span v-for="line in preview.hero.titleLines" :key="line">{{ line }}</span></h1>
          <p class="hero-summary">{{ preview.hero.summary }}</p>
          <div class="hero-actions">
            <a class="primary-action" href="#products">查看产品方向</a>
            <a class="secondary-action" href="#chain">了解业务链路</a>
          </div>
          <div class="signal-list">
            <span v-for="signal in preview.hero.signals" :key="signal">{{ signal }}</span>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="fruit fruit-one"><i></i></div>
          <div class="fruit fruit-two"><i></i></div>
          <div class="fruit fruit-three"><i></i></div>
          <div class="leaf leaf-one"></div>
          <div class="leaf leaf-two"></div>
          <div class="visual-card">
            <span>FROM ORIGIN</span>
            <strong>热带风味</strong>
            <small>原料 · 加工 · 品控 · 交付</small>
          </div>
        </div>
      </section>

      <section class="metric-strip" aria-label="案例概览">
        <article v-for="metric in preview.metrics" :key="metric.id">
          <strong>{{ metric.name }}</strong>
          <span>{{ metric.category || metric.summary }}</span>
        </article>
      </section>

      <section id="chain" class="content-section chain-section">
        <div class="section-heading">
          <p>ORIGIN TO DELIVERY / 01</p>
          <h2>从原料进入，到产品交付。</h2>
          <span>把食品加工现场的关键状态放进同一条可追踪链路。</span>
        </div>
        <div class="chain-grid">
          <article v-for="item in preview.businessChain" :key="item.id">
            <span>{{ item.number }}</span>
            <h3>{{ item.name }}</h3>
            <p>{{ item.summary }}</p>
          </article>
        </div>
      </section>

      <section id="products" class="content-section product-section">
        <div class="section-heading section-heading-light">
          <p>PRODUCT DIRECTIONS / 02</p>
          <h2>围绕热带水果，呈现多场景产品方向。</h2>
          <span>以下内容用于重构版页面检查，不构成规格、库存或交期承诺。</span>
        </div>
        <div class="product-grid">
          <article v-for="(product, index) in preview.products" :key="product.id" class="product-card">
            <span class="product-index">0{{ index + 1 }}</span>
            <div class="product-orbit"><i></i></div>
            <p>{{ product.category }}</p>
            <h3>{{ product.name }}</h3>
            <span>{{ product.summary }}</span>
            <div class="tag-list"><em v-for="tag in product.applications" :key="tag">{{ tag }}</em></div>
          </article>
        </div>
      </section>

      <section id="solutions" class="content-section solution-section">
        <div class="solution-intro">
          <p>APPLICATION / 03</p>
          <h2>不是只展示产品，<br>而是从应用需求开始。</h2>
        </div>
        <div class="solution-list">
          <article v-for="(solution, index) in preview.solutions" :key="solution.id">
            <span>0{{ index + 1 }}</span>
            <div><small>{{ solution.category }}</small><h3>{{ solution.name }}</h3><p>{{ solution.summary }}</p></div>
          </article>
        </div>
      </section>

      <section id="capabilities" class="content-section capability-section">
        <div class="section-heading">
          <p>EISCORE COLLABORATION / 04</p>
          <h2>让每一次批次流转，都有清晰的业务上下文。</h2>
        </div>
        <div class="capability-grid">
          <article v-for="item in preview.capabilities" :key="item.id">
            <span></span><h3>{{ item.name }}</h3><p>{{ item.summary }}</p>
          </article>
        </div>
      </section>

      <footer class="site-footer">
        <div><strong>{{ preview.brandName }}</strong><span>{{ preview.enterpriseName }}</span></div>
        <p>{{ preview.footerNote }}</p>
        <small>Powered by EISCore · Local enterprise case preview</small>
      </footer>
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { normalizeEnterprisePreview } from '@/domain/enterprise-preview.js'

const loading = ref(true)
const errorMessage = ref('')
const preview = ref(normalizeEnterprisePreview())

const previewStyle = computed(() => ({
  '--preview-ink': preview.value.theme.ink,
  '--preview-paper': preview.value.theme.paper,
  '--preview-accent': preview.value.theme.accent,
  '--preview-primary': preview.value.theme.primary
}))

const factStatusLabel = computed(() => ({
  confirmed: '已确认',
  example: '示例',
  pending: '待确认'
}[preview.value.factStatus] || preview.value.factStatus))

onMounted(async () => {
  try {
    const response = await fetch('/company-site/__enterprise-preview', { headers: { Accept: 'application/json' } })
    const payload = await response.json()
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.message || `HTTP ${response.status}`)
    preview.value = normalizeEnterprisePreview(payload)
    document.title = `${preview.value.brandName} · ${preview.value.previewLabel}`
  } catch (error) {
    errorMessage.value = error?.message || '未知错误'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap');

.enterprise-preview { min-height: 100vh; overflow: hidden; color: var(--preview-ink); background: var(--preview-paper); font-family: Outfit, "Microsoft YaHei", sans-serif; }
.preview-notice { display: flex; justify-content: center; gap: 28px; padding: 8px 24px; color: #fff; background: var(--preview-primary); font-size: 12px; letter-spacing: .08em; }
.site-header { position: relative; z-index: 5; display: flex; align-items: center; justify-content: space-between; max-width: 1240px; margin: 0 auto; padding: 26px 32px; }
.brand { display: flex; gap: 13px; align-items: center; color: inherit; text-decoration: none; }
.brand-mark { display: grid; width: 45px; height: 45px; place-items: center; border-radius: 50% 50% 46% 54%; color: #fff; background: var(--preview-primary); font-weight: 700; letter-spacing: .08em; }
.brand strong, .brand small { display: block; }.brand strong { font-family: "Noto Serif SC", serif; font-size: 21px; }.brand small { margin-top: 3px; opacity: .62; font-size: 10px; letter-spacing: .08em; }
.site-header nav { display: flex; gap: 32px; }.site-header nav a { color: inherit; font-size: 13px; text-decoration: none; }.site-header nav a:hover { color: var(--preview-primary); }
.hero-section { position: relative; display: grid; grid-template-columns: 1.04fr .96fr; min-height: 650px; max-width: 1340px; margin: 0 auto; padding: 70px 48px 90px; }
.hero-copy { position: relative; z-index: 2; padding-left: 28px; }.eyebrow, .section-heading > p, .solution-intro > p { margin: 0 0 24px; color: var(--preview-primary); font-size: 12px; font-weight: 600; letter-spacing: .19em; }
.hero-copy h1 { margin: 0; font-family: "Noto Serif SC", serif; font-size: clamp(58px, 7vw, 94px); font-weight: 600; line-height: 1.13; letter-spacing: -.06em; }.hero-copy h1 span { display: block; }
.hero-summary { max-width: 570px; margin: 32px 0 0; font-size: 17px; line-height: 1.9; opacity: .72; }
.hero-actions { display: flex; gap: 14px; margin-top: 36px; }.hero-actions a { padding: 14px 22px; border-radius: 999px; font-size: 13px; text-decoration: none; }.primary-action { color: #fff; background: var(--preview-primary); }.secondary-action { border: 1px solid color-mix(in srgb, var(--preview-ink) 24%, transparent); color: inherit; }
.signal-list { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 45px; }.signal-list span { padding-left: 16px; background: radial-gradient(circle at 4px 50%, var(--preview-accent) 0 3px, transparent 4px); font-size: 12px; opacity: .68; }
.hero-visual { position: relative; min-height: 530px; }.hero-visual::before { position: absolute; inset: 8% 4% 0 8%; border-radius: 49% 51% 32% 68% / 64% 34% 66% 36%; background: linear-gradient(145deg, color-mix(in srgb, var(--preview-accent) 68%, #fff), var(--preview-accent)); content: ""; transform: rotate(-4deg); }
.fruit { position: absolute; z-index: 2; border-radius: 50%; background: radial-gradient(circle at 34% 28%, #ffd46e 0 10%, #f3a331 42%, #e67827 72%, #bd4b1f 100%); box-shadow: inset -12px -14px 22px rgba(116, 52, 12, .18), 0 26px 45px rgba(92, 72, 27, .18); }.fruit i { position: absolute; top: -17%; left: 47%; width: 11%; height: 28%; border-radius: 99% 0; background: var(--preview-primary); transform: rotate(33deg); }.fruit-one { top: 16%; left: 23%; width: 230px; height: 230px; }.fruit-two { top: 37%; right: 3%; width: 180px; height: 180px; filter: saturate(.8); }.fruit-three { bottom: 5%; left: 15%; width: 145px; height: 145px; filter: hue-rotate(25deg); }
.leaf { position: absolute; z-index: 1; width: 180px; height: 80px; border-radius: 100% 0 100% 0; background: linear-gradient(120deg, var(--preview-primary), #56a066); }.leaf-one { top: 4%; right: 12%; transform: rotate(33deg); }.leaf-two { bottom: 9%; right: 8%; transform: rotate(-24deg) scale(.8); }
.visual-card { position: absolute; z-index: 3; right: 3%; bottom: 5%; display: flex; width: 225px; min-height: 150px; padding: 24px; border: 1px solid rgba(255,255,255,.5); border-radius: 22px; flex-direction: column; color: #fff; background: rgba(25,55,46,.82); box-shadow: 0 24px 45px rgba(31,61,47,.2); backdrop-filter: blur(12px); }.visual-card span { font-size: 9px; letter-spacing: .2em; }.visual-card strong { margin-top: auto; font-family: "Noto Serif SC", serif; font-size: 27px; }.visual-card small { margin-top: 8px; opacity: .7; }
.metric-strip { display: grid; grid-template-columns: repeat(3, 1fr); max-width: 1180px; margin: 0 auto 110px; border-block: 1px solid color-mix(in srgb, var(--preview-ink) 15%, transparent); }.metric-strip article { padding: 28px 42px; border-right: 1px solid color-mix(in srgb, var(--preview-ink) 15%, transparent); }.metric-strip article:last-child { border: 0; }.metric-strip strong, .metric-strip span { display: block; }.metric-strip strong { font-family: "Noto Serif SC", serif; font-size: 27px; }.metric-strip span { margin-top: 6px; font-size: 12px; opacity: .58; }
.content-section { max-width: 1180px; margin: 0 auto; padding: 105px 32px; }.section-heading { max-width: 720px; }.section-heading h2, .solution-intro h2 { margin: 0; font-family: "Noto Serif SC", serif; font-size: clamp(38px, 5vw, 60px); font-weight: 600; line-height: 1.35; letter-spacing: -.04em; }.section-heading > span { display: block; margin-top: 20px; line-height: 1.8; opacity: .62; }
.chain-grid { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 68px; border-top: 1px solid color-mix(in srgb, var(--preview-ink) 18%, transparent); }.chain-grid article { position: relative; min-height: 250px; padding: 32px 28px; border-right: 1px solid color-mix(in srgb, var(--preview-ink) 18%, transparent); }.chain-grid article:last-child { border: 0; }.chain-grid article > span { color: var(--preview-accent); font-size: 12px; }.chain-grid h3, .product-card h3, .solution-list h3, .capability-grid h3 { font-family: "Noto Serif SC", serif; }.chain-grid h3 { margin: 60px 0 12px; font-size: 24px; }.chain-grid p { margin: 0; font-size: 14px; line-height: 1.8; opacity: .65; }
.product-section { max-width: none; padding-inline: max(32px, calc((100vw - 1116px) / 2)); color: #fff; background: var(--preview-primary); }.section-heading-light > p { color: var(--preview-accent); }.product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 60px; }.product-card { position: relative; min-height: 430px; padding: 30px; overflow: hidden; border: 1px solid rgba(255,255,255,.18); border-radius: 28px; background: rgba(255,255,255,.06); }.product-index { opacity: .5; font-size: 11px; }.product-orbit { position: relative; height: 170px; }.product-orbit::before, .product-orbit::after { position: absolute; border-radius: 50%; content: ""; }.product-orbit::before { width: 145px; height: 145px; top: 15px; left: 50%; background: radial-gradient(circle at 33% 28%, #ffd96f, var(--preview-accent) 48%, #df6e26 100%); transform: translateX(-50%); }.product-orbit::after { width: 190px; height: 72px; top: 53px; left: 50%; border: 1px solid rgba(255,255,255,.38); transform: translateX(-50%) rotate(-14deg); }.product-card > p { margin: 12px 0 7px; color: var(--preview-accent); font-size: 10px; letter-spacing: .13em; }.product-card h3 { margin: 0 0 12px; font-size: 26px; }.product-card > span:not(.product-index) { font-size: 13px; line-height: 1.7; opacity: .68; }.tag-list { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }.tag-list em { padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 11px; font-style: normal; }
.solution-section { display: grid; grid-template-columns: .8fr 1.2fr; gap: 80px; }.solution-list { border-top: 1px solid color-mix(in srgb, var(--preview-ink) 18%, transparent); }.solution-list article { display: grid; grid-template-columns: 50px 1fr; padding: 28px 0; border-bottom: 1px solid color-mix(in srgb, var(--preview-ink) 18%, transparent); }.solution-list > article > span { color: var(--preview-accent); font-size: 11px; }.solution-list small { opacity: .52; }.solution-list h3 { margin: 5px 0 7px; font-size: 23px; }.solution-list p { margin: 0; font-size: 13px; line-height: 1.7; opacity: .65; }
.capability-section { padding-top: 70px; }.capability-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; margin-top: 58px; }.capability-grid article { padding: 32px 0; border-top: 2px solid var(--preview-primary); }.capability-grid article > span { display: block; width: 9px; height: 9px; border-radius: 50%; background: var(--preview-accent); }.capability-grid h3 { margin: 28px 0 12px; font-size: 24px; }.capability-grid p { margin: 0; line-height: 1.8; opacity: .65; }
.site-footer { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 40px; padding: 58px max(32px, calc((100vw - 1116px) / 2)); color: #fff; background: #112e25; }.site-footer strong, .site-footer span { display: block; }.site-footer strong { font-family: "Noto Serif SC", serif; font-size: 23px; }.site-footer span, .site-footer small { margin-top: 8px; opacity: .5; font-size: 10px; }.site-footer p { margin: 0; font-size: 12px; line-height: 1.8; opacity: .64; }
.state-panel { display: grid; min-height: 100vh; place-items: center; font-size: 18px; }.state-error { align-content: center; gap: 12px; color: #8a342c; }.state-error span { font-size: 13px; }
@media (max-width: 900px) { .site-header nav { display: none; }.hero-section { grid-template-columns: 1fr; padding-top: 45px; }.hero-copy { padding: 0; }.hero-visual { min-height: 470px; }.metric-strip, .product-grid, .capability-grid { grid-template-columns: 1fr; }.metric-strip article { border-right: 0; border-bottom: 1px solid color-mix(in srgb, var(--preview-ink) 15%, transparent); }.chain-grid { grid-template-columns: repeat(2, 1fr); }.solution-section, .site-footer { grid-template-columns: 1fr; }.site-footer { gap: 24px; } }
@media (max-width: 560px) { .preview-notice { justify-content: flex-start; gap: 12px; overflow-x: auto; white-space: nowrap; }.site-header { padding-inline: 20px; }.brand small { display: none; }.hero-section { padding: 42px 20px 60px; }.hero-copy h1 { font-size: 52px; }.hero-actions { align-items: stretch; flex-direction: column; text-align: center; }.fruit-one { width: 190px; height: 190px; }.fruit-two { width: 140px; height: 140px; }.metric-strip { margin-inline: 20px; }.content-section { padding: 78px 20px; }.chain-grid { grid-template-columns: 1fr; }.chain-grid article { border-right: 0; border-bottom: 1px solid color-mix(in srgb, var(--preview-ink) 18%, transparent); }.product-section { padding-inline: 20px; }.site-footer { padding-inline: 20px; } }
</style>
