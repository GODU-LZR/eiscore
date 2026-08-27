<template>
  <div class="jinwei-site">
    <header class="site-nav" :class="{ compact: scrolled }">
      <button class="brand-lockup" type="button" :aria-label="copy.brand.homeLabel" @click="scrollToSection('top')">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span><strong>{{ copy.brand.name }}</strong><small>{{ copy.brand.sub }}</small></span>
      </button>
      <nav :aria-label="copy.nav.ariaLabel">
        <button type="button" @click="scrollToSection('products')">{{ copy.nav.products }}</button>
        <button type="button" @click="scrollToSection('solutions')">{{ copy.nav.solutions }}</button>
        <button type="button" @click="scrollToSection('capability')">{{ copy.nav.capability }}</button>
        <button type="button" @click="scrollToSection('process')">{{ copy.nav.process }}</button>
        <button type="button" @click="scrollToSection('quality')">{{ copy.nav.quality }}</button>
      </nav>
      <div class="nav-actions">
        <button class="system-link" type="button" :title="copy.login.openTitle" @click="openLogin">
          <el-icon><Lock /></el-icon><span>{{ copy.login.short }}</span>
        </button>
        <a class="system-link system-link-external" :href="JINWEI_SYSTEM_URL" target="_blank" rel="noreferrer" :title="copy.nav.systemTitle">
          <el-icon><Setting /></el-icon><span>EISCore</span>
        </a>
        <button class="nav-cta" type="button" @click="scrollToSection('inquiry')">{{ copy.nav.inquiry }}<el-icon><ArrowRight /></el-icon></button>
        <button class="locale-toggle" type="button" :aria-label="copy.locale.toggleLabel" @click="setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')">
          <span :class="{ active: locale === 'zh-CN' }">中</span><i></i><span :class="{ active: locale === 'en-US' }">EN</span>
        </button>
        <button class="menu-toggle" type="button" :aria-expanded="mobileNavOpen" aria-controls="mobile-nav" :aria-label="copy.nav.menuLabel" @click="mobileNavOpen = !mobileNavOpen">
          <el-icon><Close v-if="mobileNavOpen" /><Menu v-else /></el-icon>
        </button>
      </div>
      <div v-if="mobileNavOpen" id="mobile-nav" class="mobile-nav" :aria-label="copy.nav.mobileLabel">
        <button type="button" @click="goFromMobile('products')">{{ copy.nav.products }}</button>
        <button type="button" @click="goFromMobile('solutions')">{{ copy.nav.solutions }}</button>
        <button type="button" @click="goFromMobile('capability')">{{ copy.nav.capability }}</button>
        <button type="button" @click="goFromMobile('process')">{{ copy.nav.process }}</button>
        <button type="button" @click="goFromMobile('quality')">{{ copy.nav.quality }}</button>
        <button type="button" class="mobile-login-link" @click="openLogin">{{ copy.login.title }}<el-icon><Lock /></el-icon></button>
        <button type="button" class="mobile-nav-cta" @click="goFromMobile('inquiry')">{{ copy.nav.inquiry }}<el-icon><ArrowRight /></el-icon></button>
      </div>
    </header>

    <Teleport to="body">
      <div v-if="loginOpen" class="login-overlay" role="presentation" @click.self="closeLogin">
        <section class="login-dialog" role="dialog" aria-modal="true" :aria-labelledby="copy.login.dialogTitleId">
          <button class="login-close" type="button" :aria-label="copy.login.closeLabel" @click="closeLogin"><el-icon><Close /></el-icon></button>
          <div class="login-dialog-brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>{{ copy.brand.name }}</strong><small>{{ copy.brand.sub }}</small></span></div>
          <p class="section-label">{{ copy.login.kicker }}</p>
          <h2 :id="copy.login.dialogTitleId">{{ copy.login.title }}</h2>
          <p class="login-dialog-lead">{{ copy.login.lead }}</p>
          <form class="login-form" @submit.prevent="submitPortalLogin">
            <label><span>{{ copy.login.username }}</span><input v-model.trim="loginForm.username" autocomplete="username" required :placeholder="copy.login.usernamePlaceholder"></label>
            <label><span>{{ copy.login.password }}</span><input v-model="loginForm.password" type="password" autocomplete="current-password" required :placeholder="copy.login.passwordPlaceholder"></label>
            <label class="login-remember"><input v-model="loginForm.remember" type="checkbox"><span>{{ copy.login.remember }}</span></label>
            <p v-if="loginMessage" class="login-message" :class="{ error: loginTone === 'error' }" role="status">{{ loginMessage }}</p>
            <button class="login-submit" type="submit" :disabled="loginLoading"><el-icon v-if="loginLoading" class="is-loading"><Loading /></el-icon><span>{{ loginLoading ? copy.login.checking : copy.login.submit }}</span><el-icon v-if="!loginLoading"><ArrowRight /></el-icon></button>
          </form>
          <p class="login-dialog-note"><el-icon><Key /></el-icon>{{ copy.login.note }}</p>
          <a class="login-admin-link" :href="`${JINWEI_SYSTEM_URL}/login`" target="_blank" rel="noreferrer">{{ copy.login.adminLink }}<el-icon><ArrowRight /></el-icon></a>
        </section>
      </div>
    </Teleport>

    <main>
      <section
        id="top"
        class="hero"
        aria-labelledby="hero-title"
        @mouseenter="pauseHeroAutoplay"
        @mouseleave="resumeHeroAutoplay"
        @focusin="pauseHeroAutoplay"
        @focusout="resumeHeroAutoplay"
      >
        <div class="hero-slides" role="region" :aria-roledescription="copy.hero.carouselRole" :aria-label="copy.hero.carouselLabel">
          <div
            v-for="(slide, index) in localizedHeroSlides"
            :key="slide.id"
            class="hero-slide"
            :class="{ active: activeHeroSlide === index }"
            :aria-hidden="activeHeroSlide !== index"
          >
            <img
              :src="assetUrl(slide.image)"
              :alt="slide.alt"
              :fetchpriority="index === 0 ? 'high' : 'auto'"
              :loading="index === 0 ? 'eager' : 'lazy'"
            >
          </div>
        </div>
        <div class="hero-shade" aria-hidden="true"></div>
        <div class="hero-content">
          <p class="hero-org">{{ copy.hero.org }}</p>
          <p class="hero-kicker">{{ currentHeroSlide.kicker }}</p>
          <h1 id="hero-title">{{ currentHeroSlide.titleLead }}<br><em>{{ currentHeroSlide.titleAccent }}</em></h1>
          <p class="hero-lead">{{ currentHeroSlide.detail }}</p>
          <div class="hero-actions">
            <button class="hero-primary" type="button" @click="scrollToSection('inquiry')">{{ copy.hero.primary }}<el-icon><ArrowRight /></el-icon></button>
            <button class="hero-secondary" type="button" @click="scrollToSection('capability')"><el-icon><View /></el-icon>{{ copy.hero.secondary }}</button>
          </div>
        </div>
        <div class="hero-slide-note" aria-live="polite">
          <span class="hero-slide-count">{{ String(activeHeroSlide + 1).padStart(2, '0') }} / {{ String(localizedHeroSlides.length).padStart(2, '0') }}</span>
          <strong>{{ currentHeroSlide.caption }}</strong>
          <small>{{ currentHeroSlide.captionDetail }}</small>
        </div>
        <div class="hero-controls" :aria-label="copy.hero.carouselControls">
          <button type="button" class="hero-control" :title="copy.hero.previous" :aria-label="copy.hero.previous" @click="setHeroSlide(activeHeroSlide - 1)"><el-icon><ArrowLeft /></el-icon></button>
          <div class="hero-dots" role="tablist" :aria-label="copy.hero.carouselSlides">
            <button
              v-for="(slide, index) in localizedHeroSlides"
              :key="slide.id"
              type="button"
              role="tab"
              class="hero-dot"
              :class="{ active: activeHeroSlide === index }"
              :aria-selected="activeHeroSlide === index"
              :aria-label="`${copy.hero.slideLabel} ${index + 1}: ${slide.caption}`"
              :title="slide.caption"
              @click="setHeroSlide(index)"
            ><span></span></button>
          </div>
          <button type="button" class="hero-control" :title="copy.hero.next" :aria-label="copy.hero.next" @click="setHeroSlide(activeHeroSlide + 1)"><el-icon><ArrowRight /></el-icon></button>
        </div>
        <div class="hero-coordinate" aria-hidden="true"><span>21°05'N</span><i></i><span>110°21'E</span></div>
      </section>

      <section class="proof-band" :aria-label="copy.proof.ariaLabel">
        <div v-for="(item, index) in copy.proof.items" :key="item.title"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></div>
      </section>

      <section id="products" class="products-section section-shell">
        <div class="section-intro">
          <p class="section-label">{{ copy.sections.products.label }}</p>
          <h2>{{ copy.sections.products.title }}</h2>
          <p>{{ copy.sections.products.detail }}</p>
        </div>
        <div class="product-grid">
          <article v-for="(product, index) in localizedProducts" :key="product.id" class="product-card">
            <div class="product-image"><img :src="assetUrl(productAsset(product.id))" :alt="product.imageAlt" loading="lazy"><span>{{ String(index + 1).padStart(2, '0') }}</span></div>
            <div class="product-copy">
              <h3>{{ product.name }}</h3>
              <p>{{ product.description }}</p>
              <button type="button" @click="selectProduct(product.id)">{{ tx('提交', 'Request') }} {{ product.short }} {{ tx('规格', 'spec') }}<el-icon><ArrowRight /></el-icon></button>
            </div>
          </article>
        </div>
      </section>

      <section id="solutions" class="solutions-section section-shell" aria-labelledby="solutions-title">
        <div class="section-intro solutions-intro">
          <p class="section-label">{{ copy.sections.solutions.label }}</p>
          <h2 id="solutions-title">{{ copy.sections.solutions.title }}</h2>
          <p>{{ copy.sections.solutions.detail }}</p>
        </div>
        <div class="solution-list">
          <article v-for="(solution, index) in localizedPrimarySolutions" :key="solution.id" class="solution-card">
            <div class="solution-index">{{ String(index + 1).padStart(2, '0') }}</div>
            <div class="solution-image"><img :src="assetUrl(solutionAsset(solution.id))" :alt="solution.imageAlt" loading="lazy"></div>
            <div class="solution-copy">
              <p>{{ solution.englishTitle }}</p>
              <h3>{{ solution.title }}</h3>
              <span>{{ solution.description }}</span>
              <small>{{ solution.evidence }}</small>
            </div>
          </article>
        </div>
        <div v-if="associatedSeafood" class="associate-rail">
          <span class="associate-label">{{ copy.sections.solutions.associatedLabel }}</span>
          <strong>{{ localizedAssociatedSeafood.title }}</strong>
          <p>{{ localizedAssociatedSeafood.description }}</p>
          <span class="associate-status">{{ localizedAssociatedSeafood.evidence }}</span>
        </div>
      </section>

      <section class="spec-ribbon" aria-labelledby="spec-title">
        <div class="spec-ribbon-head">
          <p class="section-label">{{ copy.sections.spec.label }}</p>
          <h2 id="spec-title">{{ copy.sections.spec.title }}</h2>
        </div>
        <div class="spec-lines">
          <div v-for="(field, index) in localizedSpecFields" :key="field.key" class="spec-cell">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ field.label }}</strong>
            <small>{{ field.examples }}</small>
          </div>
        </div>
      </section>

      <section id="capability" class="capability-section">
        <div class="section-shell capability-shell">
          <div class="capability-copy">
            <p class="section-label">{{ copy.sections.capability.label }}</p>
            <h2>{{ copy.sections.capability.title }}</h2>
            <p>{{ copy.sections.capability.detail }}</p>
            <dl>
              <div v-for="item in copy.sections.capability.rows" :key="item.title"><dt>{{ item.title }}</dt><dd>{{ item.detail }}</dd></div>
            </dl>
          </div>
          <div class="factory-gallery">
            <figure class="gallery-wide"><img :src="assetUrl(independentSiteAssets.factoryWide)" :alt="copy.sections.capability.images.weaving.alt" loading="lazy"><figcaption><span>{{ copy.sections.capability.images.weaving.label }}</span>{{ copy.sections.capability.images.weaving.caption }}</figcaption></figure>
            <figure><img :src="assetUrl(independentSiteAssets.factoryLine)" :alt="copy.sections.capability.images.extrusion.alt" loading="lazy"><figcaption><span>{{ copy.sections.capability.images.extrusion.label }}</span>{{ copy.sections.capability.images.extrusion.caption }}</figcaption></figure>
            <figure><img :src="assetUrl(independentSiteAssets.factoryCase)" :alt="copy.sections.capability.images.setting.alt" loading="lazy"><figcaption><span>{{ copy.sections.capability.images.setting.label }}</span>{{ copy.sections.capability.images.setting.caption }}</figcaption></figure>
          </div>
        </div>
      </section>

      <section id="process" class="process-section section-shell">
        <div class="section-intro process-intro">
          <p class="section-label">{{ copy.sections.process.label }}</p>
          <h2>{{ copy.sections.process.title }}</h2>
        </div>
        <ol class="process-list">
          <li v-for="step in localizedProcess" :key="step.no">
            <span>{{ step.no }}</span>
            <div><strong>{{ step.title }}</strong><p>{{ step.detail }}</p></div>
          </li>
        </ol>
      </section>

      <section id="quality" class="quality-section" aria-labelledby="quality-title">
        <div class="section-shell quality-shell">
          <div class="quality-copy">
            <p class="section-label">{{ copy.sections.quality.label }}</p>
            <h2 id="quality-title">{{ copy.sections.quality.title }}</h2>
            <p>{{ copy.sections.quality.detail }}</p>
            <div class="quality-boundary"><el-icon><Warning /></el-icon><span>{{ copy.sections.quality.boundary }}</span></div>
          </div>
          <div class="quality-grid">
            <article v-for="item in localizedQualityBaseline" :key="item.standard" class="quality-card">
              <code>{{ item.standard }}</code>
              <strong>{{ item.label }}</strong>
              <span>{{ item.detail }}</span>
            </article>
          </div>
        </div>
        <div class="section-shell project-shell">
          <div class="project-heading"><div><p class="section-label">{{ copy.sections.projects.label }}</p><h3>{{ copy.sections.projects.title }}</h3></div><span>{{ copy.sections.projects.note }}</span></div>
          <div class="project-grid">
            <article v-for="project in localizedProjects" :key="project.id" class="project-card">
              <img :src="assetUrl(projectAsset(project.id))" :alt="project.title" loading="lazy">
              <div><small>{{ project.type }} · {{ project.status }}</small><h4>{{ project.title }}</h4><p>{{ project.description }}</p></div>
            </article>
          </div>
        </div>
      </section>

      <section class="industry-note section-shell" :aria-label="copy.sections.industry.ariaLabel">
        <div><p class="section-label">{{ copy.sections.industry.label }}</p><h2>{{ copy.sections.industry.title }}</h2></div>
        <p>{{ copy.sections.industry.detail }}</p>
      </section>

      <section id="inquiry" class="inquiry-section">
        <div class="section-shell inquiry-shell">
          <div class="inquiry-copy">
            <p class="section-label">{{ copy.sections.inquiry.label }}</p>
            <h2>{{ copy.sections.inquiry.title }}</h2>
            <p>{{ copy.sections.inquiry.detail }}</p>
            <div class="inquiry-note">
              <el-icon><DocumentChecked /></el-icon>
              <div><strong>{{ copy.sections.inquiry.noteTitle }}</strong><span>{{ copy.sections.inquiry.noteDetail }}</span></div>
            </div>
          </div>

          <form class="inquiry-form" @submit.prevent="submitInquiry">
            <fieldset>
              <legend><span>01</span>{{ copy.form.productLegend }}</legend>
              <div class="form-grid form-grid-three">
                <label><span>{{ copy.form.productType }} *</span><select v-model="form.productFamily" required><option v-for="product in localizedProducts" :key="product.id" :value="product.id">{{ product.name }}</option></select></label>
                <label><span>{{ copy.form.material }} *</span><input v-model.trim="form.material" required maxlength="120" :placeholder="copy.form.materialPlaceholder"></label>
                <label><span>{{ copy.form.construction }} *</span><select v-model="form.construction" required><option value="" disabled>{{ copy.form.selectPlaceholder }}</option><option v-for="option in constructionOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
                <label><span>{{ copy.form.yarnSpec }} *</span><input v-model.trim="form.yarnSpec" required maxlength="120" :placeholder="copy.form.yarnPlaceholder"></label>
                <label><span>{{ copy.form.meshSize }} *</span><input v-model.trim="form.meshSize" required maxlength="120" :placeholder="copy.form.meshPlaceholder"></label>
                <label><span>{{ copy.form.dimensions }} *</span><input v-model.trim="form.dimensions" required maxlength="160" :placeholder="copy.form.dimensionsPlaceholder"></label>
                <label><span>{{ copy.form.color }} *</span><input v-model.trim="form.color" required maxlength="100" :placeholder="copy.form.colorPlaceholder"></label>
                <label><span>{{ copy.form.weight }}</span><input v-model.trim="form.weight" maxlength="120" :placeholder="copy.form.weightPlaceholder"></label>
                <label><span>{{ copy.form.finish }}</span><input v-model.trim="form.finish" maxlength="160" :placeholder="copy.form.finishPlaceholder"></label>
              </div>
              <label class="full-field"><span>{{ copy.form.packing }} *</span><textarea v-model.trim="form.packing" required maxlength="500" rows="3" :placeholder="copy.form.packingPlaceholder"></textarea></label>
            </fieldset>

            <fieldset>
              <legend><span>02</span>{{ copy.form.purchaseLegend }}</legend>
              <div class="form-grid form-grid-three">
                <label><span>{{ copy.form.quantity }} *</span><input v-model.trim="form.quantity" required maxlength="120" :placeholder="copy.form.quantityPlaceholder"></label>
                <label><span>{{ copy.form.targetDate }}</span><input v-model="form.targetDate" type="date"></label>
                <label><span>{{ copy.form.country }}</span><input v-model.trim="form.country" maxlength="100" :placeholder="copy.form.countryPlaceholder"></label>
              </div>
              <label class="full-field"><span>{{ copy.form.notes }}</span><textarea v-model.trim="form.notes" maxlength="1000" rows="3" :placeholder="copy.form.notesPlaceholder"></textarea></label>
            </fieldset>

            <fieldset>
              <legend><span>03</span>{{ copy.form.contactLegend }}</legend>
              <div class="form-grid form-grid-two">
                <label><span>{{ copy.form.company }} *</span><input v-model.trim="form.companyName" required maxlength="160"></label>
                <label><span>{{ copy.form.contact }} *</span><input v-model.trim="form.contactName" required maxlength="100"></label>
                <label><span>{{ copy.form.email }}</span><input v-model.trim="form.email" type="email" maxlength="200"></label>
                <label><span>{{ copy.form.phone }} *</span><input v-model.trim="form.phone" required maxlength="80"></label>
              </div>
              <label class="consent-row"><input v-model="form.consentAccepted" type="checkbox"><span>{{ copy.form.consent }} *</span></label>
            </fieldset>

            <div v-if="submitState.message" class="submit-feedback" :class="`is-${submitState.tone}`" role="status">
              <el-icon><CircleCheck v-if="submitState.tone === 'success'" /><Warning v-else /></el-icon>
              <span>{{ submitState.message }}</span>
            </div>
            <button class="submit-button" type="submit" :disabled="submitting">
              <el-icon v-if="submitting" class="is-loading"><Loading /></el-icon>
              <span>{{ submitting ? copy.form.submitting : copy.form.submit }}</span><el-icon v-if="!submitting"><ArrowRight /></el-icon>
            </button>
          </form>
        </div>
      </section>
    </main>

    <footer>
      <div class="footer-brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>{{ copy.brand.name }}</strong></div>
      <p>{{ copy.footer }}</p>
      <button type="button" @click="scrollToSection('top')" :title="copy.footerTop"><el-icon><Top /></el-icon></button>
    </footer>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

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

const locale = ref(typeof localStorage !== 'undefined' && localStorage.getItem('jinwei.site.locale') === 'en-US' ? 'en-US' : 'zh-CN')
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

const copy = computed(() => (isEnglish.value ? EN_COPY : ZH_COPY))

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
    const response = await fetch('/api/rpc/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginForm.username, password: loginForm.password })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.token) throw new Error('invalid-login')

    const handoffResponse = await fetch('/agent/company-site/auth/handoff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${payload.token}` }
    })
    const handoffPayload = await handoffResponse.json().catch(() => ({}))
    if (!handoffResponse.ok || !handoffPayload?.code) throw new Error('handoff-failed')

    if (typeof localStorage !== 'undefined') {
      if (loginForm.remember) localStorage.setItem(LOGIN_USERNAME_STORAGE_KEY, loginForm.username)
      else localStorage.removeItem(LOGIN_USERNAME_STORAGE_KEY)
    }
    loginTone.value = 'success'
    loginMessage.value = copy.value.login.verified
    window.location.assign(`${JINWEI_SYSTEM_URL}/auth/handoff?handoff=${encodeURIComponent(handoffPayload.code)}`)
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
    const response = await fetch('/agent/company-site/public/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': createIdempotencyKey() },
      body: JSON.stringify({
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
      })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || tx('询盘服务暂时不可用', 'Inquiry service is temporarily unavailable'))
    submitState.tone = 'success'
    submitState.message = payload?.lead?.publicRef
      ? `${tx('已提交，询盘编号', 'Submitted. Inquiry reference')} ${payload.lead.publicRef}`
      : tx('规格询盘已提交，我们将进行人工审核。', 'Specification request submitted. Our team will review it manually.')
  } catch (error) {
    submitState.tone = 'warning'
    submitState.message = `${error?.message || tx('询盘服务暂时不可用', 'Inquiry service is temporarily unavailable')}. ${tx('本页不会在浏览器中保存你的联系信息。', 'This page does not store your contact details in the browser.')}`
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
  document.title = tx('湛江市经纬网厂 | 渔网、绳索与深水网箱', 'Jingwei Netting Factory | Nets, Rope & Offshore Cages')
  setMeta('description', tx('湛江市经纬网厂提供有结网、无结网、绳索、养殖网箱及工程协同方案。', 'Jingwei Netting Factory supplies knotted and knotless netting, rope, aquaculture cages and coordinated engineering packages.'))
  setMeta('keywords', tx('渔网厂家,无结网厂家,深水网箱,渔用绳索,海洋牧场', 'fishing net factory,knotless net,deep sea cage,fishing rope,marine ranching'))
  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', `${window.location.origin}/company-site/jinwei`)
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
    name: tx('湛江市经纬网厂', 'Jingwei Netting Factory'),
    url: `${window.location.origin}/company-site/jinwei`,
    description: tx('渔网、绳索、养殖网箱与工程协同', 'Netting, rope, aquaculture cages and engineering coordination')
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('keydown', onKeydown)
  document.documentElement.lang = locale.value
  installPublicSeo()
  startHeroAutoplay()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  stopHeroAutoplay()
})
</script>

<style scoped>
.jinwei-site {
  --ink: #102733;
  --muted: #5f7076;
  --paper: #f4f6f5;
  --white: #fff;
  --net: #075b73;
  --ocean: #082f3d;
  --signal: #e5b34f;
  --clay: #b65b43;
  --line: #d4dfe1;
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
.system-link-external { color: inherit; text-decoration: none; }
.nav-cta { color: #10231d; border: 1px solid var(--signal); background: var(--signal); font-weight: 700; }

.hero { position: relative; display: flex; min-height: 680px; height: 88vh; max-height: 900px; overflow: hidden; color: #fff; background: #243b34; }
.hero-slides { position: absolute; inset: 0; }
.hero-slide { position: absolute; inset: 0; visibility: hidden; opacity: 0; transform: scale(1.025); transition: opacity .8s ease, transform 6.5s ease, visibility 0s linear .8s; }
.hero-slide.active { visibility: visible; opacity: 1; transform: scale(1); transition-delay: 0s; }
.hero-slide img { width: 100%; height: 100%; object-fit: cover; object-position: center 54%; }
.hero-shade { position: absolute; inset: 0 38% 0 0; background: rgba(11,32,27,.78); }
.hero-content { position: relative; z-index: 1; align-self: center; width: min(760px, calc(100% - 64px)); margin-left: max(32px, calc((100% - 1320px) / 2)); padding-top: 56px; }
.hero-kicker { margin: 0 0 18px; color: #cbdcd5; font: 700 11px/1.2 "Arial Narrow", Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; }
.hero h1 { max-width: 650px; margin: 0; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 66px; font-weight: 700; line-height: 1.08; letter-spacing: 0; }
.hero-lead { max-width: 680px; margin: 24px 0 0; color: #e2ebe7; font-size: 18px; line-height: 1.75; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
.hero-primary, .hero-secondary { min-height: 48px; padding: 0 21px; font-weight: 700; }
.hero-primary { color: #11261f; border: 1px solid var(--signal); background: var(--signal); }
.hero-secondary { color: #fff; border: 1px solid rgba(255,255,255,.65); background: rgba(9,29,25,.28); }
.hero-slide-note { position: absolute; z-index: 3; right: max(32px, calc((100% - 1320px) / 2)); bottom: 126px; display: grid; gap: 5px; width: min(270px, 30vw); padding: 16px 18px; border-left: 2px solid var(--signal); color: #fff; background: rgba(8,38,48,.78); }
.hero-slide-count { color: var(--signal); font: 700 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }
.hero-slide-note strong { font-size: 15px; line-height: 1.35; }
.hero-slide-note small { color: #d1e2e4; font-size: 10px; line-height: 1.5; }
.hero-controls { position: absolute; z-index: 4; right: max(32px, calc((100% - 1320px) / 2)); bottom: 34px; display: flex; align-items: center; gap: 10px; }
.hero-control, .hero-dot { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; color: #fff; border: 1px solid rgba(255,255,255,.62); border-radius: 0; background: rgba(8,38,48,.56); }
.hero-control:hover, .hero-control:focus-visible { color: var(--ink); border-color: var(--signal); background: var(--signal); }
.hero-dots { display: flex; align-items: center; gap: 6px; }
.hero-dot { width: 30px; border-color: transparent; background: transparent; }
.hero-dot span { display: block; width: 18px; height: 2px; background: rgba(255,255,255,.55); transition: width .2s ease, background .2s ease; }
.hero-dot:hover span, .hero-dot.active span { width: 28px; background: var(--signal); }
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

.solutions-section { padding: 104px 0 112px; background: #f8faf8; }
.solutions-intro { margin-bottom: 38px; }
.solution-list { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.solution-card { position: relative; display: grid; grid-template-rows: 128px auto; min-height: 310px; overflow: hidden; border: 1px solid var(--line); background: #fff; }
.solution-index { position: absolute; z-index: 1; top: 12px; left: 12px; display: grid; place-items: center; width: 30px; height: 30px; color: #fff; background: rgba(18,38,32,.82); font: 700 10px "Arial Narrow", Arial, sans-serif; }
.solution-image { overflow: hidden; background: #d6dfda; }
.solution-image img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
.solution-card:hover .solution-image img { transform: scale(1.04); }
.solution-copy { display: grid; align-content: start; gap: 7px; padding: 17px 16px 18px; }
.solution-copy p { margin: 0; color: var(--net); font: 700 9px/1.2 "Arial Narrow", Arial, sans-serif; letter-spacing: 1px; text-transform: uppercase; }
.solution-copy h3 { margin: 0; font-size: 16px; line-height: 1.35; }
.solution-copy span { color: var(--muted); font-size: 11px; line-height: 1.55; }
.solution-copy small { width: fit-content; margin-top: 4px; padding-top: 7px; color: #7b5a22; border-top: 1px solid #ead8ad; font-size: 10px; line-height: 1.35; }

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

.quality-section { padding: 104px 0 96px; background: #eef3ef; }
.quality-shell { display: grid; grid-template-columns: minmax(300px, .75fr) minmax(0, 1.25fr); gap: 64px; align-items: start; }
.quality-copy h2 { margin: 0 0 20px; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 38px; line-height: 1.3; }
.quality-copy > p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.8; }
.quality-boundary { display: flex; align-items: flex-start; gap: 9px; margin-top: 28px; padding: 13px 14px; color: #76501a; border: 1px solid #dfbd83; background: #fff8ed; font-size: 11px; line-height: 1.55; }
.quality-boundary .el-icon { flex: 0 0 auto; color: var(--signal); font-size: 16px; }
.quality-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.quality-card { display: grid; gap: 7px; min-height: 122px; padding: 15px; border: 1px solid #d4dfd8; background: #fff; }
.quality-card code { color: var(--net); font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
.quality-card strong { font-size: 14px; }
.quality-card span { color: var(--muted); font-size: 11px; line-height: 1.5; }
.project-shell { margin-top: 72px; }
.project-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.project-heading h3 { margin: 0; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 26px; line-height: 1.35; }
.project-heading > span { color: var(--muted); font-size: 11px; white-space: nowrap; }
.project-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.project-card { display: grid; grid-template-columns: 150px minmax(0, 1fr); min-height: 150px; border: 1px solid #d4dfd8; background: #fff; }
.project-card > img { width: 100%; height: 100%; min-height: 150px; object-fit: cover; }
.project-card > div { display: grid; align-content: start; gap: 7px; padding: 15px; }
.project-card small { color: var(--net); font-size: 10px; }
.project-card h4 { margin: 0; font-size: 14px; line-height: 1.4; }
.project-card p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
.industry-note { display: grid; grid-template-columns: minmax(300px, .75fr) minmax(0, 1.25fr); gap: 64px; align-items: center; padding-top: 72px; padding-bottom: 72px; }
.industry-note h2 { margin: 0; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 30px; line-height: 1.35; }
.industry-note > p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.8; }

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
  .hero-controls { right: 24px; }
  .product-card { grid-template-columns: 1fr; }
  .product-image { min-height: 230px; }
  .solution-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .quality-shell, .industry-note { grid-template-columns: 1fr; gap: 34px; }
  .project-grid { grid-template-columns: 1fr; }
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
  .hero-slide img { object-position: 60% center; }
  .hero-shade { right: 0; background: rgba(11,32,27,.68); }
  .hero-content { width: calc(100% - 28px); margin: 0 14px; padding-top: 34px; }
  .hero h1 { font-size: 42px; }
  .hero-lead { font-size: 15px; }
  .hero-actions { flex-direction: column; align-items: stretch; }
  .proof-band { grid-template-columns: 1fr; }
  .proof-band > div { min-height: 88px; padding: 18px 20px; border-right: 0; border-bottom: 1px solid rgba(255,255,255,.16); }
  .products-section, .solutions-section, .process-section { padding: 74px 0; }
  .section-intro { grid-template-columns: 1fr; gap: 18px; margin-bottom: 28px; }
  .section-intro .section-label { margin-bottom: 0; }
  .section-intro h2, .spec-ribbon h2, .capability-copy h2, .inquiry-copy h2 { font-size: 30px; }
  .product-grid { grid-template-columns: 1fr; }
  .product-card { min-height: 0; }
  .product-image { min-height: 210px; }
  .product-copy { padding: 24px 20px; }
  .solution-list { grid-template-columns: 1fr; }
  .solution-card { grid-template-rows: 170px auto; }
  .quality-section { padding: 74px 0 66px; }
  .quality-copy h2 { font-size: 30px; }
  .quality-grid { grid-template-columns: 1fr; }
  .project-shell { margin-top: 48px; }
  .project-heading { align-items: flex-start; flex-direction: column; gap: 8px; }
  .project-heading h3 { font-size: 23px; }
  .project-card { grid-template-columns: 120px minmax(0, 1fr); }
  .industry-note { padding-top: 54px; padding-bottom: 54px; }
  .industry-note h2 { font-size: 25px; }
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

/* Authenticated entry */
.locale-toggle { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 9px; color: inherit; border: 1px solid currentColor; border-radius: 0; background: transparent; font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
.locale-toggle span { opacity: .58; }
.locale-toggle span.active { color: var(--signal); opacity: 1; }
.site-nav.compact .locale-toggle span.active { color: var(--net); }
.locale-toggle i { width: 1px; height: 11px; background: currentColor; opacity: .45; }
.mobile-login-link { color: var(--net) !important; font-weight: 700; }

.login-overlay {
  --ink: #102733;
  --muted: #5f7076;
  --net: #075b73;
  --signal: #e5b34f;
  --line: #d4dfe1;
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(4, 27, 36, .72);
  backdrop-filter: blur(8px);
  font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif;
}
.login-dialog { position: relative; width: min(490px, 100%); max-height: min(760px, calc(100vh - 28px)); overflow: auto; padding: 34px; color: var(--ink); background: #f8fbfb; box-shadow: 0 28px 80px rgba(0, 13, 20, .34); }
.login-close { position: absolute; top: 13px; right: 13px; display: grid; place-items: center; width: 34px; height: 34px; padding: 0; color: var(--net); border: 1px solid #bad0d4; border-radius: 0; background: transparent; }
.login-dialog-brand { display: inline-flex; align-items: center; gap: 11px; margin-bottom: 30px; }
.login-dialog-brand > span:last-child { display: grid; gap: 3px; }
.login-dialog-brand strong { font-size: 16px; letter-spacing: .06em; }
.login-dialog-brand small { color: var(--net); font: 700 8px Arial, sans-serif; letter-spacing: .14em; }
.login-dialog h2 { margin: 0 0 12px; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 34px; line-height: 1.2; }
.login-dialog-lead { margin: 0 0 24px; color: var(--muted); font-size: 12px; line-height: 1.75; }
.login-form { display: grid; gap: 14px; }
.login-form label { display: grid; gap: 7px; }
.login-form label > span { color: #415a62; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.login-form input:not([type="checkbox"]) { width: 100%; min-height: 46px; padding: 10px 12px; color: var(--ink); border: 1px solid #c6d5d8; border-radius: 0; outline: none; background: #fff; font-size: 12px; }
.login-form input:focus { border-color: var(--net); box-shadow: 0 0 0 3px rgba(7, 91, 115, .12); }
.login-remember { display: flex !important; grid-template-columns: none !important; align-items: center; gap: 8px !important; }
.login-remember input { width: 16px; height: 16px; accent-color: var(--net); }
.login-remember span { font-weight: 500 !important; }
.login-message { margin: 0; padding: 10px 11px; color: #205f4e; border: 1px solid #83b3a4; background: #eef7f3; font-size: 11px; line-height: 1.5; }
.login-message.error { color: #8a3e27; border-color: #d5a18f; background: #fff3ef; }
.login-submit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 49px; margin-top: 3px; color: #fff; border: 1px solid var(--net); border-radius: 0; background: var(--net); font-size: 11px; font-weight: 750; letter-spacing: .08em; }
.login-submit:disabled { cursor: wait; opacity: .65; }
.login-dialog-note { display: flex; align-items: flex-start; gap: 8px; margin: 20px 0 0; padding-top: 17px; color: var(--muted); border-top: 1px solid var(--line); font-size: 10px; line-height: 1.6; }
.login-dialog-note .el-icon { flex: 0 0 auto; color: var(--net); font-size: 15px; }
.login-admin-link { display: inline-flex; align-items: center; gap: 5px; margin-top: 18px; color: var(--net); font-size: 11px; font-weight: 750; text-decoration: none; }

@media (max-width: 760px) {
  .locale-toggle { min-height: 32px; padding: 0 7px; font-size: 8px; }
  .system-link-external { display: none; }
  .login-dialog { padding: 27px 20px 24px; }
  .login-dialog h2 { font-size: 29px; }
}

@media (prefers-reduced-motion: reduce) {
  .site-nav, .product-image img, .hero-slide, .hero-dot span { transition: none; }
  html:focus-within { scroll-behavior: auto; }
}

/* Marine engineering dossier treatment */
.jinwei-site {
  --ink: #102733;
  --muted: #5f7076;
  --paper: #f4f6f5;
  --net: #075b73;
  --ocean: #082f3d;
  --signal: #e5b34f;
  --clay: #b65b43;
  --line: #d4dfe1;
  overflow-x: clip;
  background: var(--paper);
}

.jinwei-site :focus-visible {
  outline: 2px solid var(--signal);
  outline-offset: 4px;
}

.site-nav {
  height: 76px;
  padding: 0 max(24px, calc((100% - 1380px) / 2));
  background: rgba(8, 47, 61, .2);
  border-bottom-color: rgba(255, 255, 255, .3);
  backdrop-filter: blur(10px);
}

.site-nav.compact {
  height: 64px;
  color: var(--ink);
  background: rgba(244, 246, 245, .96);
  border-bottom-color: var(--line);
  box-shadow: 0 12px 32px rgba(8, 47, 61, .12);
}

.brand-lockup strong { font-size: 16px; letter-spacing: .06em; }
.brand-lockup small { color: var(--signal); }
.site-nav.compact .brand-lockup small { color: var(--net); }
.brand-mark { width: 24px; height: 24px; color: var(--signal); }
.site-nav.compact .brand-mark { color: var(--net); }
.site-nav nav { gap: 26px; }
.site-nav nav button { font-size: 12px; letter-spacing: .08em; }
.site-nav nav button:hover { color: var(--signal); }
.system-link { min-height: 36px; padding: 0 8px; font-size: 11px; letter-spacing: .08em; }
.nav-cta { min-height: 38px; padding: 0 14px; color: var(--ink); border-color: var(--signal); background: var(--signal); font-size: 11px; letter-spacing: .04em; }
.menu-toggle { display: none; place-items: center; width: 38px; height: 38px; padding: 0; color: inherit; border: 1px solid currentColor; background: transparent; }

.hero {
  min-height: 760px;
  height: 92vh;
  max-height: 980px;
  background: var(--ocean);
}
.hero-slide img { object-position: center 48%; filter: saturate(.82) contrast(1.06); }
.hero-shade { right: 42%; background: rgba(7, 36, 48, .82); }
.hero-content { z-index: 2; width: min(820px, calc(100% - 64px)); padding-top: 72px; }
.hero-org { margin: 0 0 10px; color: #f1f6f6; font-size: 12px; font-weight: 700; letter-spacing: .12em; }
.hero-kicker { margin-bottom: 22px; color: #b5d1d7; font-size: 10px; letter-spacing: .24em; }
.hero h1 { max-width: 820px; font-size: clamp(54px, 6.4vw, 92px); line-height: 1.02; letter-spacing: .01em; }
.hero h1 em { color: var(--signal); font-style: normal; }
.hero-lead { max-width: 650px; margin-top: 30px; color: #d5e6e9; font-size: 16px; line-height: 1.9; }
.hero-actions { margin-top: 38px; }
.hero-primary, .hero-secondary { min-height: 50px; border-radius: 0; font-size: 11px; letter-spacing: .08em; }
.hero-primary { color: var(--ink); border-color: var(--signal); background: var(--signal); }
.hero-secondary { border-color: rgba(255, 255, 255, .72); background: rgba(7, 36, 48, .24); }
.hero-slide-note { right: max(24px, calc((100% - 1380px) / 2)); bottom: 132px; width: min(320px, 27vw); border-left-width: 2px; }
.hero-controls { right: max(24px, calc((100% - 1380px) / 2)); bottom: 34px; }
.hero-coordinate { position: absolute; z-index: 3; top: 50%; right: max(24px, calc((100% - 1380px) / 2)); display: grid; gap: 11px; justify-items: end; transform: translateY(-50%); color: rgba(231, 245, 246, .78); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; }
.hero-coordinate i { display: block; width: 1px; height: 74px; background: var(--signal); }
.proof-band { min-height: 126px; background: #0d5369; }
.proof-band > div { padding: 26px max(20px, calc((100vw - 1380px) / 6)); border-right-color: rgba(219, 240, 242, .2); }
.proof-band span { color: var(--signal); font-size: 11px; letter-spacing: .12em; }
.proof-band strong { font-size: 13px; letter-spacing: .06em; }
.proof-band small { color: #d1e3e6; font-size: 10px; line-height: 1.65; }

.section-shell { width: min(1380px, calc(100% - 64px)); }
.section-label { color: var(--net); font-size: 10px; letter-spacing: .22em; }
.section-intro { grid-template-columns: minmax(0, 1.2fr) minmax(300px, .8fr); gap: 64px; margin-bottom: 48px; }
.section-intro .section-label { margin-bottom: -38px; }
.section-intro h2, .spec-ribbon h2, .capability-copy h2, .inquiry-copy h2 { font-size: clamp(32px, 4vw, 52px); line-height: 1.18; }
.section-intro > p:last-child, .capability-copy > p, .inquiry-copy > p { color: var(--muted); font-size: 14px; line-height: 1.9; }

.products-section { padding: 128px 0 136px; }
.product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.product-card { grid-template-columns: minmax(190px, .78fr) minmax(0, 1.22fr); min-height: 308px; border: 1px solid var(--line); border-top: 3px solid var(--net); border-radius: 0; box-shadow: 0 14px 30px rgba(16, 39, 51, .05); }
.product-image { min-height: 308px; background: #c3d2d5; }
.product-image img { filter: saturate(.86); }
.product-image span { top: 0; left: 0; width: 38px; height: 38px; border-radius: 0; background: var(--net); font-size: 10px; }
.product-copy { padding: 32px 30px; }
.product-copy h3 { margin-bottom: 14px; font-size: 22px; letter-spacing: .02em; }
.product-copy p { font-size: 12px; line-height: 1.8; }
.product-copy button { margin-top: 26px; color: var(--net); border-bottom-color: var(--signal); font-size: 11px; letter-spacing: .06em; }

.solutions-section { padding: 126px 0 136px; background: #e8f0f1; }
.solutions-intro { margin-bottom: 44px; }
.solution-list { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.solution-card { grid-template-rows: 156px auto; min-height: 334px; border: 1px solid #cbdcdf; border-radius: 0; background: #f8fbfb; }
.solution-index { top: 0; left: 0; width: 32px; height: 32px; border-radius: 0; background: var(--net); font-size: 10px; }
.solution-image { background: #b9cdd1; }
.solution-image img { filter: saturate(.78); }
.solution-copy { gap: 8px; padding: 20px 18px 21px; }
.solution-copy p { color: var(--net); font-size: 9px; letter-spacing: .14em; }
.solution-copy h3 { font-size: 16px; }
.solution-copy span { font-size: 11px; line-height: 1.65; }
.solution-copy small { color: #8c5c25; border-top-color: #e4c88f; font-size: 10px; }
.associate-rail { display: grid; grid-template-columns: auto minmax(140px, .35fr) minmax(0, 1fr) auto; align-items: center; gap: 18px; margin-top: 26px; padding: 18px 20px; border-top: 1px solid #b5cace; border-bottom: 1px solid #b5cace; }
.associate-label, .associate-status { color: var(--net); font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; }
.associate-rail strong { font-size: 15px; }
.associate-rail p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
.associate-status { color: #8c5c25; }

.spec-ribbon { padding: 84px max(32px, calc((100% - 1380px) / 2)); background: var(--ocean); }
.spec-ribbon-head { grid-template-columns: minmax(280px, .7fr) minmax(0, 1.3fr); gap: 60px; margin-bottom: 46px; }
.spec-ribbon h2 { font-size: clamp(32px, 3.8vw, 48px); }
.spec-lines { grid-template-columns: repeat(9, minmax(140px, 1fr)); border-top-color: rgba(219, 240, 242, .4); border-bottom-color: rgba(219, 240, 242, .4); }
.spec-cell { min-height: 174px; padding: 22px 16px; border-right-color: rgba(219, 240, 242, .2); }
.spec-cell::after { background: var(--signal); }
.spec-cell span { color: var(--signal); font-size: 9px; letter-spacing: .12em; }
.spec-cell strong { font-size: 13px; letter-spacing: .04em; }
.spec-cell small { color: #b9d0d4; font-size: 10px; line-height: 1.65; }

.capability-section { padding: 132px 0; background: #f4f6f5; }
.capability-shell { grid-template-columns: minmax(300px, .68fr) minmax(0, 1.32fr); gap: 76px; }
.capability-copy h2 { margin-bottom: 24px; }
.capability-copy dl { margin-top: 38px; border-top-color: #b9cbd0; }
.capability-copy dl > div { padding: 16px 0; border-bottom-color: #b9cbd0; }
.capability-copy dt { color: var(--net); font-size: 11px; letter-spacing: .06em; }
.capability-copy dd { color: var(--muted); font-size: 11px; line-height: 1.7; }
.factory-gallery { grid-template-rows: 340px 250px; gap: 14px; }
.factory-gallery figure { background: #bdcfd3; }
.factory-gallery img { filter: saturate(.8); }
.factory-gallery figcaption { padding: 12px 15px; background: rgba(8, 47, 61, .86); font-size: 10px; letter-spacing: .05em; }
.factory-gallery figcaption span { color: var(--signal); }

.process-section { padding: 132px 0; background: #fff; }
.process-intro { max-width: 940px; }
.process-list { border-top-color: var(--line); }
.process-list li { grid-template-columns: 76px minmax(0, 1fr); min-height: 126px; padding: 28px 0; border-bottom-color: var(--line); }
.process-list > li > span { color: var(--clay); font-size: 13px; letter-spacing: .12em; }
.process-list strong { font-size: 18px; letter-spacing: .02em; }
.process-list p { margin-top: 9px; color: var(--muted); font-size: 12px; line-height: 1.75; }

.quality-section { padding: 132px 0 112px; background: #e9f0ef; }
.quality-shell { grid-template-columns: minmax(300px, .72fr) minmax(0, 1.28fr); gap: 72px; }
.quality-copy h2 { font-size: clamp(32px, 3.6vw, 48px); }
.quality-copy > p { font-size: 13px; line-height: 1.9; }
.quality-boundary { color: #7a5422; border-color: #e3c68f; background: #fffaf0; font-size: 10px; }
.quality-grid { gap: 12px; }
.quality-card { min-height: 132px; padding: 17px; border: 1px solid #cbdcdf; border-radius: 0; background: #f8fbfb; }
.quality-card code { color: var(--net); font-size: 10px; }
.quality-card strong { font-size: 13px; }
.quality-card span { color: var(--muted); font-size: 10px; line-height: 1.6; }
.project-shell { margin-top: 78px; }
.project-heading h3 { font-size: 25px; }
.project-heading > span { font-size: 10px; }
.project-grid { gap: 14px; }
.project-card { grid-template-columns: 142px minmax(0, 1fr); min-height: 154px; border-color: #cbdcdf; border-radius: 0; background: #f8fbfb; }
.project-card > img { min-height: 154px; filter: saturate(.78); }
.project-card > div { gap: 8px; padding: 16px; }
.project-card small { color: var(--net); font-size: 9px; }
.project-card h4 { font-size: 13px; }
.project-card p { color: var(--muted); font-size: 10px; line-height: 1.6; }

.industry-note { padding-top: 84px; padding-bottom: 84px; }
.industry-note h2 { font-size: 30px; }
.industry-note > p { color: var(--muted); font-size: 13px; }
.inquiry-section { padding: 132px 0; background: var(--ocean); }
.inquiry-shell { grid-template-columns: minmax(300px, .62fr) minmax(520px, 1.38fr); gap: 82px; }
.inquiry-copy h2 { font-size: clamp(34px, 4vw, 52px); }
.inquiry-copy > p { color: #c8dce0; font-size: 13px; }
.inquiry-note { border-top-color: rgba(219, 240, 242, .3); }
.inquiry-note span { color: #b8d1d5; font-size: 10px; }
.inquiry-form { padding: 38px; border-radius: 0; box-shadow: 0 24px 52px rgba(0, 17, 24, .22); }
.inquiry-form legend { padding-bottom: 13px; border-bottom-color: var(--line); font-size: 14px; letter-spacing: .04em; }
.inquiry-form legend span { color: var(--clay); font-size: 10px; letter-spacing: .12em; }
.inquiry-form label > span { color: #415a62; font-size: 10px; letter-spacing: .04em; }
.inquiry-form input:not([type="checkbox"]), .inquiry-form select, .inquiry-form textarea { min-height: 44px; border-color: #c6d5d8; border-radius: 0; background: #fbfcfc; font-size: 11px; }
.inquiry-form input:focus, .inquiry-form select:focus, .inquiry-form textarea:focus { border-color: var(--net); box-shadow: 0 0 0 3px rgba(7, 91, 115, .12); }
.submit-button { min-height: 52px; border-radius: 0; background: var(--net); font-size: 11px; letter-spacing: .1em; }

footer { min-height: 132px; padding: 26px max(24px, calc((100% - 1380px) / 2)); background: #061f2a; }
.footer-brand strong { letter-spacing: .08em; }
footer p { color: #a9c4c9; font-size: 10px; letter-spacing: .06em; }
footer > button { width: 40px; height: 40px; border-radius: 0; border-color: #4c6b75; }

@media (max-width: 1080px) {
  .site-nav { grid-template-columns: minmax(190px, 1fr) auto; }
  .site-nav nav { display: none; }
  .menu-toggle { display: grid; }
  .mobile-nav { position: fixed; z-index: 19; top: 64px; right: 0; left: 0; display: grid; gap: 0; padding: 10px 16px 16px; color: var(--ink); border-bottom: 1px solid var(--line); background: rgba(244, 246, 245, .98); box-shadow: 0 16px 34px rgba(8, 47, 61, .16); }
  .mobile-nav button { display: flex; align-items: center; justify-content: space-between; min-height: 46px; padding: 0 4px; color: inherit; border: 0; border-bottom: 1px solid var(--line); background: transparent; text-align: left; font-size: 12px; }
  .mobile-nav button:last-child { border-bottom: 0; }
  .mobile-nav .mobile-nav-cta { margin-top: 10px; padding: 0 14px; color: var(--ink); border: 1px solid var(--signal); background: var(--signal); font-weight: 700; }
  .hero-coordinate { right: 24px; }
  .hero-slide-note { right: 24px; width: min(300px, 34vw); }
  .hero-controls { right: 24px; }
  .solution-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .capability-shell, .quality-shell, .inquiry-shell { grid-template-columns: minmax(0, 1fr); }
  .capability-copy, .inquiry-copy { max-width: 760px; }
  .inquiry-copy { position: static; }
  .project-grid { grid-template-columns: minmax(0, 1fr); }
  .associate-rail { grid-template-columns: auto minmax(130px, .45fr) minmax(0, 1fr); }
  .associate-status { grid-column: 2 / -1; }
}

@media (max-width: 760px) {
  .section-shell { width: calc(100% - 28px); }
  .site-nav, .site-nav.compact { grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; height: 62px; padding: 0 14px; }
  .nav-actions { gap: 6px; min-width: 0; }
  .nav-actions > .system-link:not(.system-link-external) { display: none; }
  .brand-lockup { min-width: 0; }
  .brand-lockup strong { font-size: 15px; white-space: nowrap; }
  .mobile-nav { top: 62px; max-height: calc(100dvh - 62px); overflow-y: auto; overscroll-behavior: contain; }
  .site-nav.compact + main .hero { padding-top: 0; }
  .nav-cta { min-height: 36px; padding: 0 10px; font-size: 10px; white-space: nowrap; }
  .hero { min-height: 700px; height: 86svh; max-height: 820px; }
  .hero-slide img { object-position: 63% center; }
  .hero-shade { right: 0; background: rgba(7, 36, 48, .7); }
  .hero-content { width: calc(100% - 28px); margin: 0 14px; padding-top: 42px; }
  .hero-org { max-width: 270px; font-size: 10px; line-height: 1.5; letter-spacing: .06em; }
  .hero-kicker { font-size: 9px; letter-spacing: .16em; }
  .hero h1 { font-size: clamp(38px, 11vw, 52px); line-height: 1.06; }
  .hero-lead { max-width: 100%; margin-top: 24px; font-size: 14px; line-height: 1.8; }
  .hero-actions { flex-direction: row; align-items: stretch; gap: 8px; margin-top: 28px; }
  .hero-primary, .hero-secondary { flex: 1; width: auto; min-height: 46px; padding: 0 10px; }
  .hero-slide-note { right: 14px; bottom: 92px; left: 14px; width: auto; padding: 10px 12px; }
  .hero-slide-note strong { font-size: 13px; }
  .hero-slide-note small { font-size: 9px; }
  .hero-controls { right: 14px; bottom: 20px; left: 14px; justify-content: space-between; }
  .hero-dots { flex: 1; justify-content: center; }
  .hero-coordinate { display: none; }
  .proof-band > div { min-height: 84px; padding: 18px 20px; }
  .products-section, .solutions-section, .process-section { padding: 82px 0; }
  .section-intro { grid-template-columns: 1fr; gap: 18px; margin-bottom: 32px; }
  .section-intro .section-label { margin-bottom: 0; }
  .section-intro h2, .spec-ribbon h2, .capability-copy h2, .inquiry-copy h2 { font-size: 31px; line-height: 1.22; }
  .product-grid { grid-template-columns: 1fr; }
  .product-card { grid-template-columns: 1fr; min-height: 0; }
  .product-image { min-height: 220px; }
  .product-copy { padding: 24px 20px 26px; }
  .solution-list { grid-template-columns: 1fr; }
  .solution-card { grid-template-rows: 176px auto; min-height: 0; }
  .associate-rail { grid-template-columns: 1fr; gap: 8px; margin-top: 22px; padding: 17px 14px; }
  .associate-status { grid-column: auto; }
  .spec-ribbon { padding: 62px 14px; }
  .spec-ribbon-head { grid-template-columns: 1fr; gap: 16px; }
  .spec-lines { grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; }
  .spec-cell { min-height: 142px; padding: 18px 13px; border-bottom: 1px solid rgba(219, 240, 242, .2); }
  .spec-cell:nth-child(even) { border-right: 0; }
  .spec-cell::after { display: none; }
  .spec-cell strong, .spec-cell small { overflow-wrap: anywhere; }
  .capability-section { padding: 82px 0; }
  .capability-shell { grid-template-columns: minmax(0, 1fr); gap: 40px; align-items: stretch; }
  .factory-gallery { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: 240px 180px; }
  .factory-gallery figure { min-width: 0; }
  .process-list li { grid-template-columns: 42px minmax(0, 1fr); min-height: 108px; padding: 23px 0; }
  .process-list strong { font-size: 16px; }
  .quality-section { padding: 82px 0 72px; }
  .quality-shell { grid-template-columns: minmax(0, 1fr); gap: 38px; }
  .quality-copy h2 { font-size: 31px; }
  .quality-grid, .project-grid { grid-template-columns: minmax(0, 1fr); }
  .project-shell { margin-top: 52px; }
  .project-heading { align-items: flex-start; flex-direction: column; gap: 8px; }
  .project-card { grid-template-columns: 108px minmax(0, 1fr); }
  .project-card > img { min-height: 144px; }
  .industry-note { grid-template-columns: 1fr; gap: 24px; padding-top: 58px; padding-bottom: 58px; }
  .industry-note h2 { font-size: 25px; }
  .inquiry-section { padding: 82px 0; }
  .inquiry-shell { grid-template-columns: minmax(0, 1fr); gap: 38px; }
  .inquiry-form { padding: 24px 16px; }
  .form-grid-three, .form-grid-two { grid-template-columns: minmax(0, 1fr); }
  .inquiry-form input:not([type="checkbox"]), .inquiry-form select, .inquiry-form textarea { font-size: 16px; }
  .login-overlay { place-items: start center; overflow-y: auto; padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom)); }
  .login-dialog { width: 100%; max-height: none; margin: auto 0; padding: 26px 18px 22px; }
  .login-dialog-brand { margin-bottom: 22px; padding-right: 42px; }
  .login-dialog h2 { font-size: 28px; }
  .login-form input:not([type="checkbox"]) { min-height: 48px; font-size: 16px; }
  .login-close { width: 40px; height: 40px; }
  footer { align-items: flex-start; flex-wrap: wrap; padding: 28px 18px; }
  footer p { order: 3; width: 100%; }
}

@media (max-width: 360px) {
  .site-nav, .site-nav.compact { column-gap: 8px; padding-right: 12px; padding-left: 12px; }
  .nav-actions { gap: 4px; }
  .nav-cta { min-height: 34px; padding: 0 8px; font-size: 9px; }
  .locale-toggle { min-height: 30px; padding: 0 6px; gap: 5px; font-size: 8px; }
  .menu-toggle { width: 34px; height: 34px; }
  .hero-actions { flex-direction: column; }
  .hero-primary, .hero-secondary { width: 100%; }
  .hero-slide-note { bottom: 72px; }
}
</style>
