<template>
  <main class="service-detail">
    <nav class="service-breadcrumb" :aria-label="english ? 'Breadcrumb' : '当前位置'">
      <RouterLink :to="homeLink">{{ english ? 'Home' : '首页' }}</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink :to="{ ...homeLink, hash: '#capabilities' }">{{ english ? 'Services' : '制造服务' }}</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ service?.title || (english ? 'Service' : '服务详情') }}</span>
    </nav>

    <template v-if="service">
      <section class="service-hero">
        <div class="service-hero-copy">
          <p class="service-eyebrow">{{ ui.kicker }}</p>
          <h1>{{ service.title }}</h1>
          <p class="service-intro">{{ service.summary }}</p>
          <div class="service-actions">
            <button type="button" class="service-primary" @click="$emit('purchase')">{{ ui.purchase }}</button>
            <button type="button" class="service-secondary" @click="$emit('support')">{{ ui.support }}</button>
          </div>
        </div>
        <figure class="service-hero-media">
          <img :src="service.imageUrl" :alt="service.imageAlt" fetchpriority="high" />
          <figcaption>{{ service.imageCaption }}</figcaption>
        </figure>
      </section>

      <nav class="service-topics" :aria-label="ui.navigation">
        <RouterLink v-for="page in pages" :key="page.id"
          :to="{ name: 'public-service', params: { serviceId: page.id }, query: { lang: locale } }"
          :aria-current="page.id === service.id ? 'page' : undefined"
          :class="{ 'is-active': page.id === service.id }">{{ page.title }}</RouterLink>
      </nav>

      <section v-for="(section, index) in service.sections" :key="section.title" class="service-section service-editorial">
        <div class="service-section-heading">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <h2>{{ section.title }}</h2>
          <p>{{ section.intro }}</p>
        </div>
        <dl class="service-content-list">
          <div v-for="item in section.items" :key="item.title">
            <dt>{{ item.title }}</dt>
            <dd>{{ item.description }}</dd>
          </div>
        </dl>
      </section>

      <section class="service-section service-requirements">
        <div class="service-section-heading">
          <h2>{{ service.requirementsTitle }}</h2>
          <p>{{ service.requirementsIntro }}</p>
        </div>
        <dl class="service-spec-list">
          <div v-for="item in service.requirements" :key="item.label">
            <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="service-section">
        <div class="service-section-heading"><h2>{{ service.stepsTitle }}</h2></div>
        <ol class="service-process">
          <li v-for="(step, index) in service.steps" :key="step.title">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <h3>{{ step.title }}</h3><p>{{ step.description }}</p>
          </li>
        </ol>
      </section>

      <section class="service-section service-faq">
        <div class="service-section-heading"><h2>{{ ui.faqTitle }}</h2></div>
        <div>
          <details v-for="item in service.faq" :key="item.question">
            <summary>{{ item.question }}<span aria-hidden="true">+</span></summary>
            <p>{{ item.answer }}</p>
          </details>
        </div>
      </section>

      <section v-if="products.length" class="service-section service-products">
        <div class="service-section-heading"><h2>{{ ui.productsTitle }}</h2><p>{{ ui.productsIntro }}</p></div>
        <ul>
          <li v-for="product in products" :key="product.code">
            <button type="button" class="service-product-link" @click="$emit('product', product)">
              <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.imageAlt || product.name" loading="lazy" />
              <span>{{ product.name }}</span>
            </button>
            <button type="button" class="service-add" @click="$emit('add-product', product)">{{ ui.addProduct }}<span aria-hidden="true">＋</span></button>
          </li>
        </ul>
      </section>

      <section class="service-contact">
        <div><h2>{{ service.contactTitle }}</h2><p>{{ service.contactIntro }}</p></div>
        <div class="service-actions">
          <button type="button" class="service-primary" @click="$emit('purchase')">{{ ui.purchase }}</button>
          <button type="button" class="service-secondary" @click="$emit('support')">{{ ui.support }}</button>
        </div>
      </section>
    </template>
    <section v-else class="service-unavailable" aria-live="polite">
      <h1>{{ loading ? (english ? 'Loading service details' : '正在加载服务详情') : (english ? 'Contact us for service details' : '联系咨询服务详情') }}</h1>
      <button v-if="!loading" type="button" class="service-primary" @click="$emit('support')">{{ english ? 'Contact customer service' : '咨询客服' }}</button>
    </section>
  </main>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { computed } from 'vue'

const props = defineProps({
  service: { type: Object, default: null },
  pages: { type: Array, default: () => [] },
  ui: { type: Object, default: () => ({}) },
  locale: { type: String, default: 'zh-CN' },
  products: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})
defineEmits(['purchase', 'support', 'product', 'add-product'])
const english = computed(() => props.locale.toLowerCase().startsWith('en'))
const homeLink = computed(() => ({ path: '/login', query: { lang: props.locale } }))
</script>

<style scoped>
.service-detail { width: min(1240px, calc(100% - 96px)); margin: 0 auto; padding: 110px 0 0; color: #152336; }
.service-detail * { box-sizing: border-box; }
.service-breadcrumb { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 13px; color: #697586; margin-bottom: 38px; }
.service-breadcrumb a { color: inherit; text-decoration: none; }
.service-breadcrumb a:hover { color: var(--login-theme); }
.service-hero { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 56px; padding-bottom: 50px; }
.service-eyebrow { color: var(--login-theme); font-size: 13px; font-weight: 700; margin: 0 0 16px; }
.service-hero h1 { font-size: clamp(32px, 3.4vw, 48px); letter-spacing: -.035em; line-height: 1.15; margin: 0 0 22px; }
.service-intro { max-width: 510px; font-size: 17px; line-height: 1.9; color: #596677; margin: 0 0 28px; }
.service-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.service-detail button { font: inherit; cursor: pointer; }
.service-primary, .service-secondary { padding: 12px 20px; border: 1px solid var(--login-theme); border-radius: 4px; white-space: nowrap; font-size: 14px !important; font-weight: 600 !important; }
.service-primary { color: #fff; background: var(--login-theme); }
.service-secondary { color: var(--login-theme); background: #fff; }
.service-primary:hover { filter: brightness(.92); }
.service-secondary:hover { background: #f1f6fc; }
.service-detail :is(button, a, summary):focus-visible { outline: 2px solid var(--login-theme); outline-offset: 4px; }
.service-hero-media { margin: 0; min-width: 0; }
.service-hero-media img { display: block; width: 100%; height: auto; object-fit: contain; object-position: center; border-radius: 4px; }
.service-hero-media figcaption { text-align: right; font-size: 12px; margin-top: 10px; color: #738092; }
.service-topics { display: flex; gap: 30px; border-bottom: 1px solid #dce2e9; }
.service-topics a { padding: 18px 0; font-size: 15px; font-weight: 600; text-decoration: none; color: #667388; white-space: nowrap; }
.service-topics a.is-active { color: var(--login-theme); box-shadow: inset 0 -2px var(--login-theme); }
.service-section { padding: 56px 0; border-bottom: 1px solid #e1e6ed; }
.service-editorial, .service-requirements, .service-faq { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr); gap: 64px; }
.service-section-heading > span { display: block; font-size: 13px; color: var(--login-theme); font-weight: 600; margin-bottom: 12px; }
.service-section h2, .service-contact h2 { font-size: 26px; line-height: 1.45; margin: 0 0 14px; letter-spacing: -.02em; }
.service-section-heading p, .service-contact p { margin: 0; font-size: 15px; color: #697586; line-height: 1.9; }
.service-content-list, .service-spec-list { margin: 0; }
.service-content-list > div { padding: 22px 0; border-bottom: 1px solid #e7ebf0; }
.service-content-list > div:first-child { padding-top: 0; }
.service-content-list > div:last-child { border: 0; padding-bottom: 0; }
.service-content-list dt { font-size: 18px; font-weight: 600; margin-bottom: 9px; }
.service-content-list dd, .service-spec-list dd { margin: 0; color: #5c6878; font-size: 15px; line-height: 1.9; }
.service-spec-list > div { display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 24px; padding: 15px 20px; }
.service-spec-list > div:nth-child(odd) { background: #f4f7fa; }
.service-spec-list dt { font-size: 14px; font-weight: 600; line-height: 1.9; }
.service-process { list-style: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 32px; padding: 22px 0 0; margin: 0; }
.service-process > li { border-left: 1px solid #dce2e9; padding-left: 20px; }
.service-process > li > span { color: var(--login-theme); font-size: 13px; font-weight: 600; }
.service-process h3 { margin: 12px 0 8px; font-size: 17px; }
.service-process p { margin: 0; color: #697586; line-height: 1.85; font-size: 14px; }
.service-faq details { border-bottom: 1px solid #e1e6ed; padding: 0 0 20px; margin-bottom: 20px; }
.service-faq details:last-child { margin-bottom: 0; }
.service-faq summary { display: flex; gap: 18px; justify-content: space-between; list-style: none; font-weight: 600; font-size: 16px; cursor: pointer; line-height: 1.7; }
.service-faq summary::-webkit-details-marker { display: none; }
.service-faq summary span { color: var(--login-theme); font-size: 22px; flex-shrink: 0; }
.service-faq details[open] summary span { transform: rotate(45deg); }
.service-faq details p { color: #697586; font-size: 15px; line-height: 1.9; margin: 15px 30px 0 0; }
.service-products ul { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 24px; padding: 0; margin: 28px 0 0; list-style: none; }
.service-products li { min-width: 0; }
.service-product-link { display: grid; gap: 14px; border: 0; background: #fff; padding: 0; width: 100%; text-align: left; }
.service-product-link img { width: 100%; aspect-ratio: 16/9; object-fit: contain; border-radius: 3px; background: #f3f6fa; }
.service-product-link span { font-size: 15px; font-weight: 600; line-height: 1.7; }
.service-add { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 12px 0; border: 0; background: #fff; color: var(--login-theme); font-size: 13px !important; white-space: nowrap; }
.service-add span { font-size: 20px; }
.service-contact { display: flex; align-items: center; justify-content: space-between; gap: 40px; padding: 48px 0 72px; }
.service-contact > div:first-child { max-width: 600px; }
.service-contact .service-actions { flex-shrink: 0; }
.service-unavailable { min-height: 60vh; padding: 60px 0; }
@media (max-width: 1000px) {
  .service-detail { width: calc(100% - 64px); }
  .service-hero { gap: 30px; }
  .service-editorial, .service-requirements, .service-faq { grid-template-columns: 1fr 1.6fr; gap: 32px; }
  .service-process { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
  .service-products ul { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .service-contact { align-items: flex-start; flex-direction: column; gap: 24px; }
}
@media (max-width: 760px) {
  .service-detail { width: calc(100% - 40px); padding-top: 100px; }
  .service-breadcrumb { gap: 8px; font-size: 12px; margin-bottom: 28px; }
  .service-hero, .service-editorial, .service-requirements, .service-faq { grid-template-columns: minmax(0, 1fr); gap: 26px; }
  .service-hero { padding-bottom: 30px; }
  .service-hero h1 { font-size: 32px; margin-bottom: 16px; }
  .service-intro { font-size: 15px; margin-bottom: 22px; }
  .service-section { padding: 36px 0; }
  .service-section h2, .service-contact h2 { font-size: 23px; }
  .service-topics { gap: 24px; }
  .service-topics a { font-size: 14px; padding: 16px 0; }
  .service-spec-list > div { padding: 14px 12px; grid-template-columns: 88px minmax(0, 1fr); gap: 12px; }
  .service-content-list dd, .service-spec-list dd { font-size: 14px; }
  .service-products ul { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .service-process { gap: 24px 16px; }
  .service-process > li { padding-left: 12px; }
  .service-contact { padding: 36px 0 90px; }
}
@media (max-width: 400px) {
  .service-primary, .service-secondary { padding: 11px 15px; }
}
</style>
