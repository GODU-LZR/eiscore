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
        <button type="button" class="quote-trigger" @click="openQuoteList">
          <span aria-hidden="true">▢</span>
          {{ commerceUi.listLabel }}<b v-if="quoteCount">{{ quoteCount }}</b>
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
              <div class="product-card-actions">
                <button type="button" class="product-card-link" @click="openProductDetail(product)">
                  {{ commerceUi.detailLabel }}<span aria-hidden="true">→</span>
                </button>
                <button type="button" class="product-card-quote" @click="addToQuote(product)">
                  {{ commerceUi.addLabel }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-if="publicProducts.length" class="commerce-section reveal" id="procurement">
        <div>
          <span class="commerce-kicker">{{ commerceUi.kicker }}</span>
          <h2>{{ commerceUi.title }}</h2>
          <p>{{ commerceUi.intro }}</p>
        </div>
        <div class="commerce-actions">
          <button type="button" class="commerce-primary" @click="openQuoteList">{{ commerceUi.listLabel }}<b v-if="quoteCount"> · {{ quoteCount }}</b></button>
          <button type="button" class="commerce-secondary" @click="openSalesAgent">{{ commerceUi.agentLabel }}</button>
        </div>
        <div class="commerce-steps" :aria-label="commerceUi.flowLabel">
          <span><b>01</b>{{ commerceUi.stepInquiry }}</span>
          <span><b>02</b>{{ commerceUi.stepQuote }}</span>
          <span><b>03</b>{{ commerceUi.stepOrder }}</span>
          <span><b>04</b>{{ commerceUi.stepPayment }}</span>
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
      <Transition name="commerce-dialog">
        <div v-if="productDetail" class="commerce-overlay" @click.self="productDetail = null">
          <section class="commerce-modal product-detail-modal" role="dialog" aria-modal="true">
            <button type="button" class="commerce-close" :aria-label="commerceUi.closeLabel" @click="productDetail = null">×</button>
            <div class="product-detail-media"><img v-if="productDetail.imageUrl" :src="productDetail.imageUrl" :alt="productDetail.imageAlt || productDetail.name" /></div>
            <div class="product-detail-copy">
              <span>{{ productDetail.category }}</span>
              <h2>{{ productDetail.name }}</h2>
              <p>{{ productDetail.summary }}</p>
              <small v-if="productDetail.code">{{ productDetail.code }}</small>
              <div v-if="productDetail.applications?.length" class="product-tags"><span v-for="item in productDetail.applications" :key="item">{{ item }}</span></div>
              <div class="commerce-modal-actions">
                <button type="button" class="commerce-primary" @click="addToQuote(productDetail); productDetail = null">{{ commerceUi.addLabel }}</button>
                <button type="button" class="commerce-secondary" @click="openSalesAgent">{{ commerceUi.agentLabel }}</button>
              </div>
            </div>
          </section>
        </div>
      </Transition>

      <Transition name="commerce-dialog">
        <div v-if="quoteVisible" class="commerce-overlay" @click.self="quoteVisible = false">
          <section class="commerce-modal quote-modal" role="dialog" aria-modal="true" :aria-label="commerceUi.listLabel">
            <button type="button" class="commerce-close" :aria-label="commerceUi.closeLabel" @click="quoteVisible = false">×</button>
            <div class="commerce-modal-heading"><span>{{ commerceUi.kicker }}</span><h2>{{ commerceUi.listTitle }}</h2><p>{{ commerceUi.listIntro }}</p></div>
            <div v-if="quoteItems.length" class="quote-lines">
              <article v-for="item in quoteItems" :key="item.code" class="quote-line">
                <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
                <div><strong>{{ item.name }}</strong><small>{{ item.category }}</small></div>
                <label><span class="sr-only">{{ commerceUi.quantityLabel }}</span><input v-model.number="item.quantity" type="number" min="1" max="99999" @change="normalizeQuoteQuantity(item)" /></label>
                <button type="button" class="quote-remove" :aria-label="commerceUi.removeLabel" @click="removeFromQuote(item.code)">×</button>
              </article>
            </div>
            <div v-else class="quote-empty">{{ commerceUi.emptyList }}</div>
            <div class="quote-flow">
              <span class="is-current"><b>01</b>{{ commerceUi.stepInquiry }}</span><i />
              <span><b>02</b>{{ commerceUi.stepQuote }}</span><i /><span><b>03</b>{{ commerceUi.stepOrder }}</span><i /><span><b>04</b>{{ commerceUi.stepPayment }}</span>
            </div>
            <div class="commerce-status-panel">
              <span class="commerce-status-label">{{ commerceUi.statusLabel }}</span>
              <strong>{{ commerceStageLabel }}</strong>
              <p>{{ commerceStageDescription }}</p>
              <button v-if="commerceStage === 'quote'" type="button" class="commerce-secondary" @click="advanceCommerceStage('order')">{{ commerceUi.confirmQuoteLabel }}</button>
              <button v-else-if="commerceStage === 'order'" type="button" class="commerce-secondary" @click="advanceCommerceStage('payment')">{{ commerceUi.confirmOrderLabel }}</button>
              <button v-else-if="commerceStage === 'payment'" type="button" class="commerce-secondary" @click="reservePayment">{{ commerceUi.paymentButtonLabel }}</button>
            </div>
            <div class="lead-form">
              <div class="lead-form-heading"><h3>{{ commerceUi.contactTitle }}</h3><p>{{ commerceUi.contactIntro }}</p></div>
              <div class="lead-fields">
                <input v-model.trim="leadForm.companyName" :placeholder="commerceUi.companyPlaceholder" autocomplete="organization" />
                <input v-model.trim="leadForm.contactName" :placeholder="commerceUi.namePlaceholder" autocomplete="name" />
                <input v-model.trim="leadForm.email" type="email" :placeholder="commerceUi.emailPlaceholder" autocomplete="email" />
                <input v-model.trim="leadForm.phone" :placeholder="commerceUi.phonePlaceholder" autocomplete="tel" />
                <input v-model.trim="leadForm.targetDate" type="date" :aria-label="commerceUi.dateLabel" />
                <textarea v-model.trim="leadForm.message" rows="3" :placeholder="commerceUi.messagePlaceholder" />
              </div>
              <div v-if="commerceStage === 'inquiry'" class="commerce-modal-actions"><button type="button" class="commerce-primary" :disabled="salesBusy || !quoteItems.length" @click="submitLead">{{ salesBusy ? commerceUi.sendingLabel : commerceUi.submitLabel }}</button><button type="button" class="commerce-secondary" @click="openSalesAgent">{{ commerceUi.agentLabel }}</button></div>
              <p class="commerce-reservation">{{ commerceUi.paymentReservation }}</p>
            </div>
          </section>
        </div>
      </Transition>

      <Transition name="commerce-dialog">
        <div v-if="agentVisible" class="commerce-overlay" @click.self="agentVisible = false">
          <section class="commerce-modal agent-modal" role="dialog" aria-modal="true" :aria-label="commerceUi.agentLabel">
            <button type="button" class="commerce-close" :aria-label="commerceUi.closeLabel" @click="agentVisible = false">×</button>
            <div class="commerce-modal-heading"><span>{{ commerceUi.kicker }}</span><h2>{{ commerceUi.agentTitle }}</h2><p>{{ commerceUi.agentIntro }}</p></div>
            <div class="agent-messages"><div v-for="(message, index) in agentMessages" :key="`${index}-${message.role}`" :class="['agent-message', message.role]">{{ message.content }}</div><div v-if="salesBusy" class="agent-message assistant">{{ commerceUi.thinkingLabel }}</div></div>
            <form class="agent-composer" @submit.prevent="sendSalesMessage"><input v-model.trim="agentDraft" :placeholder="commerceUi.agentPlaceholder" :disabled="salesBusy" /><button type="submit" :disabled="salesBusy || !agentDraft">{{ commerceUi.sendLabel }}</button></form>
            <button type="button" class="agent-quote-link" @click="openQuoteList">{{ commerceUi.openListLabel }}</button>
          </section>
        </div>
      </Transition>

      <Transition name="commerce-dialog">
        <div v-if="paymentVisible" class="commerce-overlay" @click.self="paymentVisible = false">
          <section class="commerce-modal payment-modal" role="dialog" aria-modal="true" :aria-label="commerceStatusUi.paymentTitle">
            <button type="button" class="commerce-close" :aria-label="commerceUi.closeLabel" @click="paymentVisible = false">×</button>
            <div class="commerce-modal-heading"><span>{{ commerceUi.stepPayment }}</span><h2>{{ commerceStatusUi.paymentTitle }}</h2><p>{{ commerceStatusUi.paymentDescription }}</p></div>
            <div class="payment-reserved-card"><strong>{{ commerceStatusUi.paymentReserved }}</strong><span>{{ commerceStatusUi.paymentMethods }}</span></div>
            <button type="button" class="commerce-secondary" @click="paymentVisible = false; quoteVisible = true">{{ commerceStatusUi.backToInquiry }}</button>
          </section>
        </div>
      </Transition>

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
const quoteVisible = ref(false)
const productDetail = ref(null)
const agentVisible = ref(false)
const paymentVisible = ref(false)
const quoteItems = ref([])
const agentMessages = ref([])
const agentDraft = ref('')
const salesSessionId = ref('')
const salesBusy = ref(false)
const commerceStage = ref('inquiry')
const paymentReserved = ref(false)
const leadForm = reactive({ companyName: '', contactName: '', email: '', phone: '', targetDate: '', message: '' })
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
const isEnglish = computed(() => activeLocale.value.toLowerCase().startsWith('en'))
const commerceUi = computed(() => isEnglish.value ? {
  kicker: 'Procurement', title: 'Plan your purchase', intro: 'Select a product, send an inquiry and let the sales team confirm specification, price, lead time and payment terms.', listLabel: 'Inquiry list', detailLabel: 'Details', addLabel: 'Add to inquiry', agentLabel: 'Ask sales Agent', flowLabel: 'Purchase flow', stepInquiry: 'Inquiry', stepQuote: 'Quote', stepOrder: 'Order', stepPayment: 'Payment', closeLabel: 'Close', listTitle: 'Your inquiry list', listIntro: 'Add products and quantities, then send one request for quotation.', quantityLabel: 'Quantity', removeLabel: 'Remove', emptyList: 'No products selected yet.', contactTitle: 'Contact and requirements', contactIntro: 'A sales representative will confirm the quote before any order or payment is created.', companyPlaceholder: 'Company name', namePlaceholder: 'Contact name', emailPlaceholder: 'Business email', phonePlaceholder: 'Phone or WhatsApp', dateLabel: 'Target delivery date', messagePlaceholder: 'Specification, destination, voltage, head/flow or other requirements', sendingLabel: 'Sending...', submitLabel: 'Send inquiry', paymentReservation: 'Payment: interface reserved; no charge is made on this page.', agentTitle: 'Lundu sales Agent', agentIntro: 'Ask about product selection, applications, lead time or quotation preparation.', thinkingLabel: 'Checking the published product information...', agentPlaceholder: 'Describe your product or project requirements', sendLabel: 'Send', openListLabel: 'Open inquiry list', statusLabel: 'Order status', inquiryStatus: 'Waiting for inquiry', quoteStatus: 'Waiting for sales quote', orderStatus: 'Waiting for order confirmation', paymentStatus: 'Payment interface reserved', statusInquiryDescription: 'Submit products and contact details to start a sales review.', statusQuoteDescription: 'The sales team will confirm specification, price, inventory and lead time.', statusOrderDescription: 'Review the confirmed commercial terms before creating an order.', statusPaymentDescription: 'Payment provider integration is reserved; no funds are captured here.', confirmQuoteLabel: 'Review quote', confirmOrderLabel: 'Confirm order', paymentButtonLabel: 'Open payment placeholder'
} : {
  kicker: '采购协同', title: '从选型到询价', intro: '选择产品、提交询单，由销售人员确认规格、价格、交期和支付条款。', listLabel: '询价单', detailLabel: '产品详情', addLabel: '加入询价单', agentLabel: '询问销售 Agent', flowLabel: '采购流程', stepInquiry: '询价', stepQuote: '报价', stepOrder: '订单', stepPayment: '支付', closeLabel: '关闭', listTitle: '我的询价单', listIntro: '添加产品和数量，一次提交采购需求。', quantityLabel: '数量', removeLabel: '移除', emptyList: '暂未选择产品。', contactTitle: '联系方式与需求', contactIntro: '销售人员会先确认报价，确认后再进入订单和支付。', companyPlaceholder: '公司名称', namePlaceholder: '联系人', emailPlaceholder: '商务邮箱', phonePlaceholder: '电话或 WhatsApp', dateLabel: '目标交付日期', messagePlaceholder: '规格、目的地、电压、流量/扬程或其他要求', sendingLabel: '提交中...', submitLabel: '提交询价', paymentReservation: '支付：已预留接口，本页面不会产生扣款。', agentTitle: '伦度销售 Agent', agentIntro: '可询问产品选型、应用场景、交期或报价准备。', thinkingLabel: '正在核对已发布的产品资料……', agentPlaceholder: '描述产品或项目需求', sendLabel: '发送', openListLabel: '打开询价单', statusLabel: '采购状态', inquiryStatus: '待提交询价', quoteStatus: '待销售报价', orderStatus: '待确认订单', paymentStatus: '支付接口已预留', statusInquiryDescription: '提交产品、数量和联系方式，开始销售审核。', statusQuoteDescription: '销售人员会确认规格、价格、库存和交期。', statusOrderDescription: '核对确认后的商务条款，再创建订单。', statusPaymentDescription: '支付渠道适配器已预留，本页面不会产生扣款。', confirmQuoteLabel: '确认报价', confirmOrderLabel: '确认订单', paymentButtonLabel: '打开支付占位'
})
const quoteCount = computed(() => quoteItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0))
const commerceStatusUi = computed(() => isEnglish.value ? {
  paymentTitle: 'Payment interface reserved', paymentDescription: 'The payment provider adapter is ready for a future integration. No payment credentials are collected and no charge is made here.', paymentReserved: 'Awaiting confirmed order and payment provider configuration', paymentMethods: 'Reserved adapter: payment intent, redirect or invoice collection', backToInquiry: 'Back to inquiry list'
} : {
  paymentTitle: '支付接口预留', paymentDescription: '支付适配器已预留，等待订单确认和支付渠道配置。本页面不会收集密钥，也不会产生扣款。', paymentReserved: '等待已确认订单与支付渠道配置', paymentMethods: '预留适配器：支付意图、跳转支付或发票收款', backToInquiry: '返回询价单'
})
const commerceStageLabel = computed(() => {
  const ui = commerceUi.value
  return commerceStage.value === 'quote' ? ui.quoteStatus : commerceStage.value === 'order' ? ui.orderStatus : commerceStage.value === 'payment' ? ui.paymentStatus : ui.inquiryStatus
})
const commerceStageDescription = computed(() => {
  const ui = commerceUi.value
  return commerceStage.value === 'quote' ? ui.statusQuoteDescription : commerceStage.value === 'order' ? ui.statusOrderDescription : commerceStage.value === 'payment' ? ui.statusPaymentDescription : ui.statusInquiryDescription
})
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

const openProductDetail = (product) => {
  productDetail.value = product || null
}

const normalizeQuoteQuantity = (item) => {
  item.quantity = Math.min(99999, Math.max(1, Number.parseInt(item.quantity, 10) || 1))
}

const addToQuote = (product) => {
  if (!product?.code) return
  const existing = quoteItems.value.find((item) => item.code === product.code)
  if (existing) {
    existing.quantity = Math.min(99999, Number(existing.quantity || 1) + 1)
  } else {
    quoteItems.value.push({ ...product, quantity: 1 })
  }
  quoteVisible.value = true
}

const removeFromQuote = (code) => {
  quoteItems.value = quoteItems.value.filter((item) => item.code !== code)
}

const openQuoteList = () => {
  quoteVisible.value = true
  agentVisible.value = false
  productDetail.value = null
}

const advanceCommerceStage = (stage) => {
  commerceStage.value = stage
  if (stage !== 'payment') paymentReserved.value = false
}

const reservePayment = () => {
  paymentReserved.value = true
  paymentVisible.value = true
}

const openSalesAgent = async () => {
  agentVisible.value = true
  quoteVisible.value = false
  productDetail.value = null
  if (!agentMessages.value.length) {
    agentMessages.value.push({ role: 'assistant', content: commerceUi.value.agentIntro })
  }
  try {
    await ensureSalesSession()
  } catch (error) {
    agentMessages.value.push({ role: 'assistant', content: error.message || commerceUi.value.thinkingLabel })
  }
}

const ensureSalesSession = async () => {
  if (salesSessionId.value) return salesSessionId.value
  const stored = window.localStorage?.getItem('lundu-sales-session') || ''
  if (stored) salesSessionId.value = stored
  if (salesSessionId.value) return salesSessionId.value
  const response = await fetch('/agent/sales/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ channel: 'website', locale: activeLocale.value, consent: true })
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.session?.id) throw new Error(data.message || '销售 Agent 暂时不可用')
  salesSessionId.value = data.session.id
  window.localStorage?.setItem('lundu-sales-session', salesSessionId.value)
  return salesSessionId.value
}

const sendSalesMessage = async () => {
  const message = agentDraft.value.trim()
  if (!message || salesBusy.value) return
  agentDraft.value = ''
  agentMessages.value.push({ role: 'user', content: message })
  salesBusy.value = true
  try {
    const sessionId = await ensureSalesSession()
    const response = await fetch(`/agent/sales/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ message })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || '销售 Agent 暂时不可用')
    agentMessages.value.push({ role: 'assistant', content: data.answer || commerceUi.value.thinkingLabel })
  } catch (error) {
    agentMessages.value.push({ role: 'assistant', content: error.message || '销售 Agent 暂时不可用' })
  } finally {
    salesBusy.value = false
  }
}

const submitLead = async () => {
  if (!quoteItems.value.length || salesBusy.value) return
  if (!leadForm.companyName && !leadForm.contactName) {
    ElMessage.warning(commerceUi.value.namePlaceholder)
    return
  }
  if (!leadForm.email && !leadForm.phone) {
    ElMessage.warning(commerceUi.value.emailPlaceholder)
    return
  }
  salesBusy.value = true
  try {
    const sessionId = await ensureSalesSession()
    const response = await fetch(`/agent/sales/sessions/${encodeURIComponent(sessionId)}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        consent: true,
        pagePath: window.location.pathname,
        companyName: leadForm.companyName,
        contactName: leadForm.contactName,
        email: leadForm.email,
        phone: leadForm.phone,
        targetDate: leadForm.targetDate,
        productSlugs: quoteItems.value.map((item) => item.code),
        quantity: quoteItems.value.map((item) => `${item.name} × ${item.quantity}`).join('; '),
        message: leadForm.message
      })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || '询价提交失败，请稍后重试')
    ElMessage.success(isEnglish.value ? 'Inquiry sent. Sales will follow up.' : '询价已提交，销售人员会尽快联系。')
    commerceStage.value = 'quote'
    quoteVisible.value = true
  } catch (error) {
    ElMessage.error(error.message || '询价提交失败，请稍后重试')
  } finally {
    salesBusy.value = false
  }
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

watch(quoteItems, (items) => {
  try {
    window.localStorage?.setItem('lundu-inquiry-list', JSON.stringify(items.map(({ quantity, code }) => ({ quantity, code }))))
  } catch {}
}, { deep: true })

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
  try {
    const storedQuotes = JSON.parse(window.localStorage?.getItem('lundu-inquiry-list') || '[]')
    if (Array.isArray(storedQuotes)) {
      quoteItems.value = storedQuotes.map((item) => {
        const product = publicProducts.value.find((entry) => entry.code === item?.code)
        return product ? { ...product, quantity: Math.min(99999, Math.max(1, Number.parseInt(item.quantity, 10) || 1)) } : null
      }).filter(Boolean)
    }
  } catch {}
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
        const handoffResponse = await fetch('/company-site/auth/handoff', {
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
