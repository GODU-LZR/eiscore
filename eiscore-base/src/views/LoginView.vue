<template>
  <div class="login-page" :class="{ 'is-scrolled': pageScrolled }" :style="pageStyle">
    <header class="site-header">
      <div class="brand-lockup">
        <div class="brand-mark" :class="{ 'has-logo': branding.logo }">
          <img v-if="branding.logo" :src="branding.logo" :alt="portalUi.logoAlt" />
          <span v-else>{{ brandInitial }}</span>
        </div>
        <div v-if="!branding.logo" class="site-name">
          <strong>{{ companyName }}</strong>
        </div>
      </div>
      <nav v-if="navItems.length" class="site-nav">
        <button
          v-for="item in navItems"
          :key="`${item.label}-${item.anchor}`"
          type="button"
          @click="scrollToSection(item.anchor)"
        >
          {{ item.label }}
        </button>
      </nav>
      <div class="header-actions">
        <div v-if="availableLocales.length > 1" class="locale-switch" :aria-label="portalUi.languageSwitchLabel">
          <button
            v-for="locale in availableLocales"
            :key="locale.value"
            type="button"
            :class="{ 'is-active': locale.value === activeLocale }"
            :disabled="switchingLocale"
            @click="switchLocale(locale.value)"
          >
            {{ locale.label }}
          </button>
        </div>
        <button ref="headerLoginRef" type="button" class="header-login" @click="focusLogin">
          {{ branding.headerLoginText }}
        </button>
      </div>
    </header>

    <main>
      <section class="hero-section" id="overview">
        <div
          class="hero-media"
          :class="{ 'has-image': heroImage }"
          aria-hidden="true"
          @mouseenter="stopHeroAutoplay"
          @mouseleave="startHeroAutoplay"
          @focusin="stopHeroAutoplay"
          @focusout="startHeroAutoplay"
        >
          <Transition name="hero-slide" mode="out-in">
            <img
              v-if="activeHeroSlide"
              :key="activeHeroSlide.url"
              :src="activeHeroSlide.url"
              alt=""
            />
          </Transition>
        </div>
        <div class="hero-shade" />

        <div class="hero-inner">
          <div v-if="!activeHeroSlide?.hasEmbeddedText" class="hero-copy reveal is-visible">
            <p class="brand-kicker">{{ siteTagText }}</p>
            <h1>{{ companyName }}</h1>
            <p class="brand-slogan">{{ publicHeroSlogan }}</p>
            <p class="brand-intro">{{ publicHeroIntro }}</p>
            <div v-if="trustBadgeItems.length" class="trust-strip" :aria-label="portalUi.trustAriaLabel">
              <span
                v-for="(item, index) in trustBadgeItems"
                :key="item.label"
                :style="{ transitionDelay: `${index * 90}ms` }"
              >
                {{ item.label }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="heroFacts.length && !activeHeroSlide?.hasEmbeddedText" class="hero-facts" :aria-label="portalUi.highlightsAriaLabel">
          <span v-for="item in heroFacts" :key="`${item.value}-${item.label}`">
            <strong>{{ item.value }}</strong>
            {{ item.label }}
          </span>
        </div>

        <div
          v-if="carouselItems.length > 1"
          class="hero-carousel"
          @mouseenter="stopHeroAutoplay"
          @mouseleave="startHeroAutoplay"
          @focusin="stopHeroAutoplay"
          @focusout="startHeroAutoplay"
        >
          <div v-if="!activeHeroSlide?.hasEmbeddedText" class="hero-carousel-caption" aria-live="polite">
            <span>{{ activeHeroSlide?.subtitle }}</span>
            <strong>{{ activeHeroSlide?.title }}</strong>
          </div>
          <div class="hero-carousel-controls">
            <button
              type="button"
              class="hero-carousel-arrow"
              :aria-label="activeLocale.toLowerCase().startsWith('en') ? 'Previous slide' : '上一张图片'"
              title="上一张"
              @click="previousHeroSlide"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div class="hero-carousel-dots" role="tablist" aria-label="首屏图片">
              <button
                v-for="(item, index) in carouselItems"
                :key="item.url"
                type="button"
                role="tab"
                class="hero-carousel-dot"
                :class="{ 'is-active': index === activeHeroIndex }"
                :aria-selected="index === activeHeroIndex"
                :aria-label="`${activeLocale.toLowerCase().startsWith('en') ? 'Slide' : '第'} ${index + 1}`"
                @click="setHeroSlide(index)"
              />
            </div>
            <button
              type="button"
              class="hero-carousel-arrow"
              :aria-label="activeLocale.toLowerCase().startsWith('en') ? 'Next slide' : '下一张图片'"
              title="下一张"
              @click="nextHeroSlide"
            >
              <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              class="hero-carousel-toggle"
              :aria-label="heroPaused ? (activeLocale.toLowerCase().startsWith('en') ? 'Play slideshow' : '播放轮播') : (activeLocale.toLowerCase().startsWith('en') ? 'Pause slideshow' : '暂停轮播')"
              :title="heroPaused ? '播放轮播' : '暂停轮播'"
              @click="toggleHeroAutoplay"
            >
              <span aria-hidden="true">{{ heroPaused ? '▶' : 'Ⅱ' }}</span>
            </button>
          </div>
        </div>

        <button type="button" class="scroll-cue" @click="scrollToSection('metrics')" :aria-label="portalUi.scrollAriaLabel">
          <span>{{ branding.scrollCueText }}</span>
          <i />
        </button>
      </section>

      <section
        class="product-3d-band"
        :aria-label="activeLocale.toLowerCase().startsWith('en') ? 'Product 3D viewer' : '产品三维展示'"
      >
        <div class="product-3d-band-inner">
          <PumpBomViewer
            v-if="viewerIsPump"
            class="hero-product-viewer login-product-viewer"
            :product-name="pumpViewerName"
            :category="viewerProduct.category"
            :accent-color="safeThemeColor"
            :locale="activeLocale"
          />
          <PineappleProcessViewer
            v-else-if="viewerIsPineapple"
            class="hero-product-viewer login-product-viewer"
            :product-name="viewerProduct.name"
            :category="viewerProduct.category"
            :summary="viewerProduct.summary"
            :accent-color="safeThemeColor"
            :locale="activeLocale"
          />
          <Product3DViewer
            v-else
            class="hero-product-viewer"
            :product-name="viewerProduct.name"
            :category="viewerProduct.category"
            :summary="viewerProduct.summary"
            :accent-color="safeThemeColor"
            :locale="activeLocale"
          />
        </div>
      </section>

      <section class="metrics-band reveal" id="metrics">
        <div class="company-profile">
          <div class="company-profile-intro">
            <span>{{ branding.metricsSectionKicker }}</span>
            <h2>{{ publicMetricsTitle }}</h2>
            <p>{{ branding.description }}</p>
          </div>
          <dl v-if="metricItems.length" class="company-facts">
            <div v-for="item in metricItems" :key="`${item.label}-${item.value}`" class="company-fact">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="story-section reveal" id="about">
        <div class="story-copy">
          <span>{{ branding.aboutSectionKicker }}</span>
          <h2>{{ publicHeroSlogan }}</h2>
          <p>{{ branding.description }}</p>
          <button v-if="branding.showSecondaryAction" type="button" class="text-link" @click="openSecondaryAction">
            {{ branding.secondaryActionText }}
          </button>
        </div>
        <div v-if="highlightImage" class="story-media" aria-hidden="true">
          <img :src="highlightImage" alt="" />
        </div>
      </section>

      <section
        v-if="businessChainItems.length || capabilityItems.length"
        class="operation-section reveal"
        id="capabilities"
      >
        <div class="operation-heading">
          <span>{{ publicCapabilitiesKicker }}</span>
          <h2>{{ publicCapabilitiesTitle }}</h2>
          <p>{{ publicCapabilitiesIntro }}</p>
        </div>

        <div v-if="manufacturingSeries.length" class="manufacturing-series-grid">
          <article v-for="item in manufacturingSeries" :key="item.title || item.description" class="manufacturing-series-card">
            <figure class="manufacturing-series-media">
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.imageAlt" loading="lazy" />
              <span v-else aria-hidden="true">{{ item.title.slice(0, 1) }}</span>
              <figcaption>{{ item.number }}</figcaption>
            </figure>
            <div class="manufacturing-series-body">
              <span class="manufacturing-series-label">{{ item.status || item.label }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
              <button type="button" class="manufacturing-link" @click="scrollToSection('products')">
                {{ manufacturingProductAction }}<span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        </div>

        <div v-if="manufacturingServiceItems.length" class="manufacturing-service-list">
          <article v-for="item in manufacturingServiceItems" :key="item.title || item.description" class="manufacturing-service-item">
            <span class="manufacturing-service-number">{{ item.number }}</span>
            <div>
              <span class="manufacturing-series-label">{{ item.status || item.label }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
            <button type="button" class="manufacturing-link" @click="scrollToSection('solutions')">
              {{ manufacturingServiceAction }}<span aria-hidden="true">→</span>
            </button>
          </article>
        </div>
      </section>

      <section v-if="publicProducts.length" class="public-products-section reveal" id="products">
        <div class="public-section-heading">
          <span>{{ portal.productSectionKicker }}</span>
          <h2>{{ portal.productSectionTitle }}</h2>
        </div>
        <div class="public-product-grid">
          <article v-for="(product, index) in publicProducts" :key="product.id" class="public-product-card">
            <div class="product-card-media" :class="{ 'is-placeholder': !product.imageUrl }">
              <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.imageAlt" loading="lazy" />
              <span v-else class="product-card-placeholder" aria-hidden="true">{{ product.name.slice(0, 1) }}</span>
              <span class="product-order">{{ String(index + 1).padStart(2, '0') }}</span>
              <small v-if="product.imageLabel">{{ product.imageLabel }}</small>
            </div>
            <div class="product-card-body">
              <span class="product-category">{{ product.category }}</span>
              <h3>{{ product.name }}</h3>
              <p>{{ product.summary }}</p>
              <small v-if="product.code" class="product-card-code">{{ product.code }}</small>
              <div v-if="product.applications.length" class="product-tags">
                <span v-for="application in product.applications.slice(0, 4)" :key="application">{{ application }}</span>
              </div>
              <button type="button" class="product-card-link" @click="scrollToSection('solutions')">
                {{ productActionText }}<span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="publicSolutions.length" class="public-solutions-section reveal" id="solutions">
        <div class="solution-intro">
          <div class="solution-heading">
            <span>{{ publicSolutionsKicker }}</span>
            <h2>{{ publicSolutionsTitle }}</h2>
          </div>
          <figure v-if="activeSolutionMedia?.imageUrl" class="solution-feature-media">
            <Transition name="solution-image" mode="out-in">
              <img
                :key="activeSolutionMedia.id"
                :src="activeSolutionMedia.imageUrl"
                :alt="activeSolutionMedia.imageAlt"
                loading="lazy"
              />
            </Transition>
            <figcaption>
              <span>{{ activeSolutionMedia.imageLabel }}</span>
              <strong>{{ activeSolutionMedia.name }}</strong>
            </figcaption>
          </figure>
        </div>
        <div class="public-solution-list">
          <article
            v-for="(solution, index) in publicSolutions"
            :key="solution.id"
            :class="{ 'is-active': index === activeSolutionIndex }"
            tabindex="0"
            @mouseenter="selectSolution(index)"
            @focusin="selectSolution(index)"
            @click="selectSolution(index)"
          >
            <strong>{{ String(index + 1).padStart(2, '0') }}</strong>
            <div>
              <div v-if="solution.imageUrl" class="solution-row-media">
                <img :src="solution.imageUrl" :alt="solution.imageAlt" loading="lazy" />
                <span>{{ solution.imageLabel }}</span>
              </div>
              <small>{{ solution.category }}</small>
              <h3>{{ solution.name }}</h3>
              <p>{{ solution.summary }}</p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="carouselItems.length" class="gallery-section reveal">
        <div class="gallery-track">
          <figure v-for="(item, index) in marqueeItems" :key="`gallery-${index}`">
            <img :src="item.url" :alt="item.title" />
            <figcaption>
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section v-if="leaderItems.length" class="leader-section reveal">
        <div class="section-heading narrow">
          <span>{{ branding.leadersSectionKicker }}</span>
          <h2>{{ branding.leadersSectionTitle }}</h2>
        </div>
        <div class="leader-grid">
          <article v-for="(leader, index) in leaderItems" :key="`leader-${index}`" class="leader-card">
            <el-avatar :size="54" :src="leader.avatar || ''">
              {{ (leader.name || '').slice(0, 1) }}
            </el-avatar>
            <div>
              <h4>{{ leader.name }}</h4>
              <p class="leader-title">{{ leader.title }}</p>
              <p class="leader-intro">{{ leader.intro }}</p>
            </div>
          </article>
        </div>
      </section>
    </main>

    <Teleport to="body">
      <Transition name="auth-dialog">
        <div v-if="loginVisible" class="auth-overlay" @click.self="closeLogin">
          <section
            class="auth-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-login-title"
            :aria-label="portalUi.authAriaLabel"
            @keydown.esc="closeLogin"
          >
            <button type="button" class="auth-close" :aria-label="loginCloseLabel" @click="closeLogin">
              <span aria-hidden="true">×</span>
            </button>
            <div class="auth-card">
              <div class="auth-card-header">
                <span>{{ branding.authKicker }}</span>
                <h2 id="employee-login-title">{{ branding.authTitle }}</h2>
                <p class="auth-subtitle">{{ branding.announcement }}</p>
              </div>

              <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" class="login-form" size="large">
                <el-form-item prop="username">
                  <el-input v-model="loginForm.username" :placeholder="portalUi.usernamePlaceholder" prefix-icon="User" />
                </el-form-item>

                <el-form-item prop="password">
                  <el-input
                    v-model="loginForm.password"
                    type="password"
                    :placeholder="portalUi.passwordPlaceholder"
                    prefix-icon="Lock"
                    show-password
                    @keyup.enter="handleLogin"
                  />
                </el-form-item>

                <el-form-item>
                  <div class="form-meta">
                    <el-checkbox v-model="loginForm.remember">{{ portalUi.rememberText }}</el-checkbox>
                    <span class="safe-note">{{ branding.authSafeNote }}</span>
                  </div>
                </el-form-item>

                <el-form-item>
                  <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
                    {{ branding.primaryActionText }}
                  </el-button>
                </el-form-item>
              </el-form>

              <p class="auth-footnote">{{ branding.authFootnote }}</p>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>

    <footer class="site-footer">
      <span>{{ branding.footerText }}</span>
      <span v-if="branding.icpText">{{ branding.icpText }}</span>
    </footer>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref, reactive, watch, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useSystemStore } from '@/stores/system'
import { mix } from '@/utils/theme'
import { getEnterpriseConfig } from '@eiscore/platform/enterprise-config'
import { normalizeLoginBranding } from '@eiscore/platform/login-branding'
import { applyEnterpriseSeoHead, buildEnterpriseSeoHead } from '@eiscore/platform/enterprise-seo'
import { completeHarnessAuth } from '@/services/harness-auth-client'

const Product3DViewer = defineAsyncComponent(() => import('@/components/Product3DViewer.vue'))
const PineappleProcessViewer = defineAsyncComponent(() => import('@/components/PineappleProcessViewer.vue'))
const PumpBomViewer = defineAsyncComponent(() => import('@/components/PumpBomViewer.vue'))

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const systemStore = useSystemStore()
const loading = ref(false)
const loginVisible = ref(false)
const loginFormRef = ref(null)
const headerLoginRef = ref(null)
const pageScrolled = ref(false)
const switchingLocale = ref(false)
const activeSolutionIndex = ref(0)
const activeHeroIndex = ref(0)
const heroPaused = ref(false)
let heroTimer = null
let restoreSeoHead = () => {}

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const safeThemeColor = computed(() => {
  const color = String(systemStore.enterpriseProfile?.themeColor || systemStore.config?.themeColor || '#409EFF').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#409EFF'
})

const branding = computed(() => {
  const source = systemStore.config?.loginBranding || {}
  return normalizeLoginBranding(source, { enterpriseConfig: getEnterpriseConfig(globalThis) })
})

const companyName = computed(() => branding.value.companyName)
const portal = computed(() => systemStore.enterpriseProfile?.portal || {})
const portalUi = computed(() => portal.value.ui || {})
const activeLocale = computed(() => systemStore.enterpriseLocale || systemStore.enterpriseProfile?.locale || 'zh-CN')
const productActionText = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'View applications' : '查看应用方向'
))
const publicMetricsTitle = computed(() => branding.value.metricsSectionTitle || (
  activeLocale.value.toLowerCase().startsWith('en') ? 'Focused motor and pump manufacturing' : '专注电机与水泵制造'
))
const publicHeroSlogan = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en')
    ? 'Motors and pumps for equipment, water supply and project service.'
    : '电机与水泵系列，面向设备配套与供水工程。'
))
const publicHeroIntro = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en')
    ? 'Series selection, coordinated delivery and service parts for equipment and water systems.'
    : '覆盖系列选型、配套交付与服务备件，面向设备和供水系统。'
))
const publicCapabilitiesKicker = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'Manufacturing service' : '制造服务'
))
const publicCapabilitiesTitle = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'Development, manufacturing and service' : '产品开发、制造与服务'
))
const publicCapabilitiesIntro = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en')
    ? 'Motor and pump series supported by controlled production, inspection and delivery coordination.'
    : '围绕电机与水泵系列，提供产品开发、受控制造、检测与交付协同。'
))
const manufacturingProductAction = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'View products' : '查看产品'
))
const manufacturingServiceAction = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'View service' : '了解服务'
))
const publicSolutionsKicker = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'Application service' : '应用服务'
))
const publicSolutionsTitle = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'Selection and production support' : '选型与生产协同'
))
const loginCloseLabel = computed(() => (
  activeLocale.value.toLowerCase().startsWith('en') ? 'Close sign in' : '关闭登录'
))
const availableLocales = computed(() => {
  const values = Array.isArray(systemStore.enterpriseProfile?.enabledLocales)
    ? systemStore.enterpriseProfile.enabledLocales
    : []
  return values.map((value) => ({
    value,
    label: value.toLowerCase().startsWith('zh') ? '中文' : value.toLowerCase().startsWith('en') ? 'EN' : value
  }))
})
const loginRules = computed(() => ({
  username: [{ required: true, message: portalUi.value.usernameRequired, trigger: 'blur' }],
  password: [{ required: true, message: portalUi.value.passwordRequired, trigger: 'blur' }]
}))
const PRODUCT_DETAILS = Object.freeze({
  'LUNDU-MOTOR-YC': {
    category: '单相异步电动机',
    summary: 'YC、YL、YY 系列单相异步电动机，面向小型设备、通风、供水及通用动力配套。',
    applications: ['单相动力', '通用设备', '配套采购']
  },
  'LUNDU-MOTOR-YE3': {
    category: '三相异步电动机',
    summary: 'YE3 系列三相异步电动机，面向泵组、风机、传动设备及工业动力配套。',
    applications: ['三相动力', '泵组配套', '工业设备']
  },
  'LUNDU-PUMP-PST': {
    category: '标准管道离心泵',
    summary: 'PST 标准管道离心泵，适用于建筑给排水、循环输送与一般工业管路配套。',
    applications: ['管路输送', '循环供水', '工程配套']
  },
  'LUNDU-PUMP-WQ': {
    category: '潜水排污泵',
    summary: '潜水排污泵系列，面向排水、排污及工程现场的潜水输送工况。',
    applications: ['排水', '排污', '工程现场']
  },
  'LUNDU-PUMP-JET': {
    category: 'JET 自吸喷射泵',
    summary: 'JET 自吸喷射泵，面向小型供水、增压及需要自吸能力的配套场景。',
    applications: ['自吸供水', '增压', '小型系统']
  }
})
const PRODUCT_IMAGE_BY_CODE = Object.freeze({
  'LUNDU-MOTOR-YE3': '/enterprise-assets/site/framed/product-ye3-card.jpg',
  'LUNDU-MOTOR-YC': '/enterprise-assets/site/framed/product-yc-card.jpg',
  'LUNDU-PUMP-PST': '/enterprise-assets/site/framed/product-pst-card.jpg',
  'LUNDU-PUMP-WQ': '/enterprise-assets/site/framed/product-wq-card.jpg',
  'LUNDU-PUMP-JET': '/enterprise-assets/site/framed/product-jet-card.jpg'
})
const publicProducts = computed(() => (Array.isArray(portal.value.products) ? portal.value.products : []).map((product) => {
  const detail = PRODUCT_DETAILS[product.code]
  const imageUrl = product.imageUrl || PRODUCT_IMAGE_BY_CODE[product.code] || ''
  if (!detail || activeLocale.value.toLowerCase().startsWith('en')) return { ...product, imageUrl }
  return {
    ...product,
    imageUrl,
    category: detail.category,
    summary: detail.summary,
    applications: detail.applications
  }
}))
const manufacturingSeriesCodes = ['LUNDU-MOTOR-YE3', 'LUNDU-PUMP-WQ', 'LUNDU-PUMP-PST']
const manufacturingSeries = computed(() => businessChainItems.value.slice(0, 3).map((item, index) => {
  const product = publicProducts.value.find((entry) => entry.code === manufacturingSeriesCodes[index])
  return {
    ...item,
    number: String(index + 1).padStart(2, '0'),
    label: activeLocale.value.toLowerCase().startsWith('en') ? 'Product series' : '产品系列',
    imageUrl: product?.imageUrl || PRODUCT_IMAGE_BY_CODE[manufacturingSeriesCodes[index]] || galleryImages.value[index]?.url || '',
    imageAlt: product?.imageAlt || item.title
  }
}))
const manufacturingServiceItems = computed(() => businessChainItems.value.slice(3).map((item, index) => ({
  ...item,
  number: String(index + 4).padStart(2, '0'),
  label: activeLocale.value.toLowerCase().startsWith('en') ? 'Manufacturing service' : '制造服务'
})))
const viewerProduct = computed(() => {
  const product = publicProducts.value[0] || {}
  return {
    name: String(product.name || companyName.value || '').trim(),
    category: String(product.category || (activeLocale.value.toLowerCase().startsWith('en') ? 'PRODUCT SYSTEM' : '产品系统')).trim(),
    summary: String(product.summary || '').trim()
  }
})
const viewerIsPineapple = computed(() => /菠萝|pineapple/i.test(
  viewerProduct.value.name + ' ' + viewerProduct.value.category
))
const pumpViewerProduct = computed(() => (
  publicProducts.value.find((product) => /泵|pump/i.test(
    `${product?.name || ''} ${product?.category || ''}`
  )) || null
))
const viewerIsPump = computed(() => Boolean(pumpViewerProduct.value) || /泵|pump/i.test(
  `${companyName.value} ${branding.value.description} ${viewerProduct.value.category}`
))
const pumpViewerName = computed(() => (
  pumpViewerProduct.value?.name ||
  (activeLocale.value.toLowerCase().startsWith('en') ? 'Pump assembly' : '水泵总成')
))
const publicSolutions = computed(() => Array.isArray(portal.value.solutions) ? portal.value.solutions : [])
const activeSolutionMedia = computed(() => (
  publicSolutions.value[activeSolutionIndex.value] || publicSolutions.value[0] || null
))
const siteTagText = computed(() => branding.value.siteTag)
const brandInitial = computed(() => companyName.value.slice(0, 1))
const heroImage = computed(() => branding.value.backgroundImage || carouselItems.value[0]?.url || '')
const activeHeroSlide = computed(() => carouselItems.value[activeHeroIndex.value] || carouselItems.value[0] || null)
const introLead = computed(() => {
  const text = branding.value.description.trim()
  const chinese = activeLocale.value.toLowerCase().startsWith('zh')
  const firstSentence = text.split(chinese ? /[。！？]/ : /[.!?]/).find(Boolean)
  return firstSentence ? `${firstSentence}${chinese ? '。' : '.'}` : text
})
const highlightImage = computed(() => carouselItems.value[1]?.url || carouselItems.value[0]?.url || heroImage.value)
const galleryImages = computed(() => {
  const items = carouselItems.value.length ? carouselItems.value : [{ url: heroImage.value }]
  return items.filter((item) => item.url)
})
const marqueeItems = computed(() => {
  if (!carouselItems.value.length) return []
  return [...carouselItems.value, ...carouselItems.value]
})
const heroFacts = computed(() => metricItems.value.slice(0, 3))

const navItems = computed(() => branding.value.navItems
  .map((item) => ({
    label: String(item?.label || '').trim(),
    anchor: String(item?.anchor || '').trim()
  }))
  .filter((item) => item.label)
  .slice(0, 6))

const metricItems = computed(() => branding.value.metrics
  .map((item) => ({
    label: String(item?.label || '').trim(),
    value: String(item?.value || '').trim()
  }))
  .filter((item) => item.label || item.value)
  .slice(0, 4))

const trustBadgeItems = computed(() => branding.value.trustBadges
  .map((item) => ({
    label: typeof item === 'string' ? item.trim() : String(item?.label || '').trim()
  }))
  .filter((item) => item.label)
  .slice(0, 5))

const businessChainItems = computed(() => branding.value.businessChain
  .map((item) => ({
    title: String(item?.title || '').trim(),
    description: String(item?.description || '').trim(),
    status: String(item?.status || '').trim()
  }))
  .filter((item) => item.title || item.description)
  .slice(0, 5))

const capabilityItems = computed(() => branding.value.capabilities
  .map((item) => ({
    title: String(item?.title || '').trim(),
    description: String(item?.description || '').trim()
  }))
  .filter((item) => item.title || item.description)
  .slice(0, 4))

const carouselItems = computed(() => branding.value.carouselImages
  .map((item) => ({
    url: String(item?.url || '').trim(),
    title: String(item?.title || '').trim(),
    subtitle: String(item?.subtitle || '').trim(),
    hasEmbeddedText: item?.hasEmbeddedText === true
  }))
  .filter((item) => item.url))

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const stopHeroAutoplay = () => {
  if (heroTimer) {
    window.clearInterval(heroTimer)
    heroTimer = null
  }
}

const startHeroAutoplay = () => {
  stopHeroAutoplay()
  if (heroPaused.value || prefersReducedMotion() || carouselItems.value.length < 2) return
  heroTimer = window.setInterval(() => {
    activeHeroIndex.value = (activeHeroIndex.value + 1) % carouselItems.value.length
  }, 6500)
}

const setHeroSlide = (index) => {
  if (index < 0 || index >= carouselItems.value.length) return
  activeHeroIndex.value = index
  startHeroAutoplay()
}

const previousHeroSlide = () => {
  const length = carouselItems.value.length
  if (length < 2) return
  setHeroSlide((activeHeroIndex.value - 1 + length) % length)
}

const nextHeroSlide = () => {
  const length = carouselItems.value.length
  if (length < 2) return
  setHeroSlide((activeHeroIndex.value + 1) % length)
}

const toggleHeroAutoplay = () => {
  heroPaused.value = !heroPaused.value
  if (heroPaused.value) stopHeroAutoplay()
  else startHeroAutoplay()
}

const leaderItems = computed(() => branding.value.leaders
  .map((item) => ({
    name: String(item?.name || '').trim(),
    title: String(item?.title || '').trim(),
    intro: String(item?.intro || '').trim(),
    avatar: String(item?.avatar || '').trim()
  }))
  .filter((item) => item.name)
  .slice(0, 3))

const pageStyle = computed(() => {
  const theme = safeThemeColor.value
  const ink = mix(theme, '#0f172a', 0.72)
  const surface = mix(theme, '#ffffff', 0.18)
  const tintLight = mix(theme, '#ffffff', 0.22)
  const background = branding.value.backgroundImage
    ? `linear-gradient(180deg, #f8fafc 0%, #eef2f7 46%, #ffffff 100%)`
    : `linear-gradient(180deg, #f8fafc 0%, ${mix(surface, '#f8fafc', 0.78)} 48%, #ffffff 100%)`

  return {
    '--login-theme': theme,
    '--login-theme-light': tintLight,
    '--login-ink': ink,
    backgroundImage: background
  }
})

const handleScroll = () => {
  pageScrolled.value = window.scrollY > 28
}

const scrollToSection = (anchor) => {
  if (!anchor) return
  const el = document.getElementById(anchor)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const focusLogin = async () => {
  loginVisible.value = true
  await nextTick()
  requestAnimationFrame(() => {
    loginFormRef.value?.$el?.querySelector?.('input')?.focus?.()
  })
}

const selectSolution = (index) => {
  if (index >= 0 && index < publicSolutions.value.length) activeSolutionIndex.value = index
}

const closeLogin = async () => {
  loginVisible.value = false
  loginFormRef.value?.clearValidate?.()
  await nextTick()
  headerLoginRef.value?.focus?.()
}

watch(loginVisible, (visible) => {
  document.body.classList.toggle('employee-login-open', visible)
})

watch(activeLocale, () => {
  activeSolutionIndex.value = 0
  activeHeroIndex.value = 0
  startHeroAutoplay()
})

watch(carouselItems, () => {
  if (activeHeroIndex.value >= carouselItems.value.length) activeHeroIndex.value = 0
  startHeroAutoplay()
})

const openSecondaryAction = () => {
  const url = branding.value.secondaryActionUrl
  if (!url) return
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  router.push(url)
}

const refreshSeoHead = () => {
  restoreSeoHead()
  const head = buildEnterpriseSeoHead(systemStore.enterpriseProfile, { pathname: window.location.pathname })
  restoreSeoHead = applyEnterpriseSeoHead(document, head)
}

const switchLocale = async (locale) => {
  if (!locale || locale === activeLocale.value || switchingLocale.value) return
  switchingLocale.value = true
  try {
    await systemStore.loadEnterpriseProfile(locale)
    systemStore.initTheme()
    const url = new URL(window.location.href)
    url.searchParams.set('lang', locale)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    refreshSeoHead()
  } finally {
    switchingLocale.value = false
  }
}

onMounted(async () => {
  const requestedLocale = new URLSearchParams(window.location.search).get('lang') || ''
  await systemStore.loadConfig({ locale: requestedLocale })
  systemStore.initTheme()
  startHeroAutoplay()
  refreshSeoHead()
  if (
    route.query.login === '1' ||
    typeof route.query.redirect === 'string' ||
    (typeof route.query.dsh_return === 'string' && route.query.dsh_return)
  ) {
    loginVisible.value = true
    await nextTick()
    loginFormRef.value?.$el?.querySelector?.('input')?.focus?.()
  }
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
  requestAnimationFrame(() => {
    const targets = Array.from(document.querySelectorAll('.reveal'))
    if (!targets.length) return
    if (!('IntersectionObserver' in window)) {
      targets.forEach((item) => item.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.18 })
    targets.forEach((item) => observer.observe(item))
  })
})

onBeforeUnmount(() => {
  stopHeroAutoplay()
  window.removeEventListener('scroll', handleScroll)
  document.body.classList.remove('employee-login-open')
  restoreSeoHead()
})

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map((char) => (
      '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)
    )).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    return {}
  }
}

const handleLogin = async () => {
  if (!loginFormRef.value) return

  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true

    try {
      const response = await fetch('/api/rpc/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.username?.trim(),
          password: loginForm.password?.trim()
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || portalUi.value.loginFailed)
      }

      const data = await response.json()
      const realToken = data.token
      if (!realToken) throw new Error(portalUi.value.tokenMissing)

      const payload = parseJwt(realToken)
      const permissions = Array.isArray(data.permissions)
        ? data.permissions
        : (Array.isArray(payload.permissions) ? payload.permissions : [])
      let roleId = ''
      let avatarUrl = ''
      let sopRole = ''

      if (data.app_role || payload.app_role) {
        try {
          const roleRes = await fetch(`/api/roles?code=eq.${data.app_role || payload.app_role}`, {
            method: 'GET',
            headers: {
              'Accept-Profile': 'public',
              'Content-Profile': 'public',
              Authorization: `Bearer ${realToken}`
            }
          })
          if (roleRes.ok) {
            const roleList = await roleRes.json()
            if (Array.isArray(roleList) && roleList.length > 0) roleId = roleList[0].id
          }
        } catch (e) {}
      }

      const resolveAvatarUrl = async (avatar, token) => {
        if (!avatar || typeof avatar !== 'string') return ''
        if (!avatar.startsWith('file:')) return avatar
        const fileId = avatar.replace('file:', '')
        try {
          const fileRes = await fetch(`/api/files?id=eq.${fileId}&select=content_base64,mime_type`, {
            headers: {
              'Accept-Profile': 'public',
              Authorization: `Bearer ${token}`
            }
          })
          if (!fileRes.ok) return ''
          const fileList = await fileRes.json()
          const row = Array.isArray(fileList) ? fileList[0] : null
          if (!row?.content_base64) return ''
          const mime = row.mime_type || 'application/octet-stream'
          return `data:${mime};base64,${row.content_base64}`
        } catch (e) {
          return ''
        }
      }

      try {
        const encodedUsername = encodeURIComponent(payload.username)
        const headers = {
          'Accept-Profile': 'public',
          'Content-Profile': 'public',
          Authorization: `Bearer ${realToken}`
        }
        const urls = [
          `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id,sop_role`,
          `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id`,
          `/api/users?username=eq.${encodedUsername}&select=username,full_name,avatar,role,sop_role`,
          `/api/users?username=eq.${encodedUsername}&select=username,full_name,avatar,role`
        ]
        for (const url of urls) {
          const userRes = await fetch(url, { method: 'GET', headers })
          if (!userRes.ok) continue
          const userList = await userRes.json()
          const row = Array.isArray(userList) ? userList[0] : null
          if (row) {
            avatarUrl = await resolveAvatarUrl(row.avatar || '', realToken)
            if (!roleId && row.role_id) roleId = row.role_id
            sopRole = row.sop_role || row.sopRole || ''
            break
          }
        }
      } catch (e) {}

      const userData = {
        token: realToken,
        user: {
          id: payload.username,
          name: payload.username,
          username: payload.username,
          role: data.app_role || payload.app_role || payload.role || 'user',
          role_id: roleId,
          dbRole: payload.role || 'web_user',
          permissions,
          avatar: avatarUrl || payload.avatar || 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
          sop_role: sopRole || payload.sop_role || payload.sopRole || '',
          sopRole: sopRole || payload.sop_role || payload.sopRole || ''
        }
      }

      userStore.login(userData)
      ElMessage.success(`${portalUi.value.loginSuccess} ${userData.user.name}`)
      const dshReturn = typeof route.query.dsh_return === 'string' ? route.query.dsh_return : ''
      if (dshReturn) {
        const returnUrl = new URL(dshReturn, window.location.origin)
        if (returnUrl.origin !== window.location.origin || returnUrl.pathname !== '/harness-embed-api/eiscore/auth/handoff') {
          throw new Error('无效的 Harness 回调地址')
        }
        const handoffResponse = await fetch('/agent/company-site/auth/handoff', {
          method: 'POST',
          headers: { Authorization: `Bearer ${realToken}`, Accept: 'application/json' }
        })
        const handoff = await handoffResponse.json().catch(() => ({}))
        if (!handoffResponse.ok || !handoff.code) throw new Error('Harness 登录交接失败，请重试')
        if (!await completeHarnessAuth({ code: handoff.code, callbackPath: returnUrl.pathname })) {
          throw new Error('Harness 登录交接失败，请重试')
        }
        window.location.assign('/harness')
        return
      }
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
      const safeRedirect = /^\/(?!\/)/.test(redirect) ? redirect : '/'
      if (safeRedirect.startsWith('/mobile/')) {
        window.location.assign(safeRedirect)
      } else {
        router.push(safeRedirect)
      }
    } catch (error) {
      ElMessage.error(error.message || portalUi.value.loginError)
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped lang="scss">
@import "../styles/login-view.scss";
</style>
