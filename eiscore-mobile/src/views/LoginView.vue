<template>
  <div ref="pageRef" class="mobile-login" :style="pageStyle" @scroll.passive="handlePageScroll">
    <section class="mobile-hero" id="mobile-overview">
      <div class="hero-media" aria-hidden="true">
        <div
          v-for="(scene, index) in heroScenes"
          :key="scene.url || index"
          class="hero-scene"
          :class="{ active: index === activeSceneNumber }"
        >
          <img
            v-if="scene.url"
            class="hero-scene-bg"
            :src="scene.url"
            alt=""
            loading="eager"
            decoding="async"
          />
          <img
            v-if="scene.url"
            class="hero-scene-main"
            :src="scene.url"
            alt=""
            loading="eager"
            decoding="async"
          />
        </div>
        <div class="hero-texture"></div>
      </div>
      <div class="hero-shade"></div>

      <div class="hero-topbar">
        <div class="brand-lockup">
          <div class="brand-logo">
            <img v-if="branding.logo" :src="branding.logo" alt="企业标识" />
            <span v-else>{{ brandInitial }}</span>
          </div>
          <div>
            <strong>{{ companyName }}</strong>
            <span>{{ siteTagText }}</span>
          </div>
        </div>
        <button type="button" class="desktop-link" @click="goDesktop">
          桌面版
        </button>
      </div>

      <div class="hero-copy mobile-reveal is-visible">
        <p class="brand-kicker">{{ branding.announcement }}</p>
        <h1>{{ companyName }}</h1>
        <p class="brand-slogan">{{ branding.slogan }}</p>
        <div class="scene-note">
          <span>{{ heroSceneTitle }}</span>
          <small>{{ heroSceneSubtitle }}</small>
        </div>
        <div v-if="sceneProgressItems.length > 1" class="scene-progress" aria-hidden="true">
          <span
            v-for="item in sceneProgressItems"
            :key="item"
            :class="{ active: item === activeSceneNumber }"
          ></span>
        </div>
      </div>

      <div v-if="trustBadgeItems.length" class="trust-float" aria-label="企业能力标签">
        <span v-for="(item, index) in trustBadgeItems" :key="item.label" :style="{ '--delay': `${index * 120}ms` }">
          {{ item.label }}
        </span>
      </div>

      <div v-if="metricItems.length" class="metric-carousel" aria-label="企业实力">
        <article v-for="item in metricItems.slice(0, 4)" :key="`${item.label}-${item.value}`">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </article>
      </div>

      <section ref="loginCardRef" class="access-sheet mobile-reveal is-visible" aria-label="移动端登录">
        <div class="access-handle" aria-hidden="true"></div>
        <div class="access-pass">
          <div class="pass-mark">
            <img v-if="branding.logo" :src="branding.logo" alt="" />
            <span v-else>{{ brandInitial }}</span>
          </div>
        <div>
          <span>移动员工通行证</span>
          <strong>{{ companyName }}</strong>
        </div>
          <em v-if="displayPassBadgeText">{{ displayPassBadgeText }}</em>
        </div>
        <div class="access-header">
          <div class="access-title">
            <span>{{ branding.authKicker }}</span>
            <strong>{{ branding.authTitle }}</strong>
          </div>
          <div class="access-status">
            <i aria-hidden="true"></i>
            <small>{{ branding.authSafeNote }}</small>
          </div>
        </div>

        <van-form @submit="handleLogin" ref="formRef" class="access-form">
          <van-cell-group inset>
            <van-field
              v-model="form.username"
              name="username"
              label="账号"
              placeholder="请输入用户名"
              left-icon="manager-o"
              :rules="[{ required: true, message: '请输入用户名' }]"
              autocomplete="username"
            />
            <van-field
              v-model="form.password"
              name="password"
              label="密码"
              placeholder="请输入密码"
              left-icon="lock"
              :type="showPassword ? 'text' : 'password'"
              :right-icon="showPassword ? 'eye-o' : 'closed-eye'"
              @click-right-icon="showPassword = !showPassword"
              :rules="[{ required: true, message: '请输入密码' }]"
              autocomplete="current-password"
            />
          </van-cell-group>

          <div class="form-actions">
            <van-checkbox v-model="form.remember" shape="square" icon-size="16px">
              记住登录
            </van-checkbox>
            <span>{{ branding.authFootnote }}</span>
          </div>

          <div class="submit-area">
            <van-button
              round
              block
              type="primary"
              native-type="submit"
              :loading="loading"
              loading-text="登录中..."
              size="large"
            >
              {{ branding.primaryActionText }}
            </van-button>
          </div>
        </van-form>

        <button v-if="showSecondaryAction" type="button" class="secondary-link" @click="openSecondaryAction">
          {{ branding.secondaryActionText }}
        </button>
      </section>

      <button type="button" class="scroll-cue" @click="scrollToStory">
        <span>{{ branding.scrollCueText || '向下了解企业' }}</span>
        <i></i>
      </button>
    </section>

    <main class="company-content">
      <section v-if="carouselItems.length" ref="storyRef" class="story-section mobile-reveal">
        <div class="section-heading">
          <span>企业现场</span>
          <h2>把产地、加工和客户应用放进口袋里</h2>
        </div>
        <div class="story-lane">
          <article v-for="(item, index) in carouselItems" :key="item.url" class="story-card">
            <img :src="item.url" alt="" />
            <figcaption>
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.subtitle }}</small>
            </figcaption>
          </article>
        </div>
      </section>

      <section class="intro-section mobile-reveal" id="mobile-about">
        <div class="section-heading">
          <span>{{ branding.aboutSectionKicker }}</span>
          <h2>{{ branding.slogan }}</h2>
        </div>
        <p>{{ branding.description }}</p>
        <button v-if="showSecondaryAction" type="button" class="text-action" @click="openSecondaryAction">
          {{ branding.secondaryActionText }}
        </button>
      </section>

      <section v-if="businessChainItems.length" class="chain-section mobile-reveal">
        <div class="section-heading">
          <span>业务链路</span>
          <h2>{{ sanitizedBusinessChainTitle }}</h2>
        </div>
        <div class="chain-timeline">
          <article
            v-for="(item, index) in businessChainItems"
            :key="item.title || item.description"
            class="chain-item"
            :style="{ '--delay': `${index * 100}ms` }"
          >
            <strong>{{ String(index + 1).padStart(2, '0') }}</strong>
            <div>
              <span v-if="item.status">{{ item.status }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="capabilityItems.length" class="capability-section mobile-reveal">
        <div class="section-heading">
          <span>{{ branding.capabilitiesSectionKicker }}</span>
          <h2>{{ branding.capabilitiesSectionTitle }}</h2>
        </div>
        <div class="capability-stack">
          <article
            v-for="(item, index) in capabilityItems"
            :key="item.title || item.description"
            class="capability-card"
            :style="{ '--delay': `${index * 120}ms` }"
          >
            <img v-if="galleryImages[index]" :src="galleryImages[index].url" alt="" />
            <div>
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </article>
        </div>
      </section>
    </main>

    <nav v-show="showDock" class="mobile-dock" :class="{ single: !showSecondaryAction }" aria-label="移动端快捷入口">
      <button type="button" @click="scrollToLogin">{{ branding.primaryActionText }}</button>
      <button v-if="showSecondaryAction" type="button" @click="openSecondaryAction">{{ branding.secondaryActionText }}</button>
    </nav>

    <footer class="login-footer">
      <p v-if="displayFooterText">{{ displayFooterText }}</p>
      <p v-if="branding.icpText">{{ branding.icpText }}</p>
    </footer>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref, reactive, onBeforeUnmount, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showFailToast } from 'vant'
import { setAuth, parseJwt, isAuthenticated, getToken } from '@/utils/auth'

const NANPAI_LOGO_URL = 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3MisnwYo8JqKqQYw9AM49AM.jpg'

const defaultLoginBranding = {
  companyName: '广东南派食品有限公司',
  slogan: '深耕热带水果全产业链，打造高品质水果制品方案',
  description: '根据企业官网公开信息：公司成立于 2009 年，总部位于中国雷州半岛；拥有湛江、广西两大加工基地和多条水果加工生产线，面向茶饮、烘焙、饮料与生鲜客户提供一站式水果制品解决方案。',
  logo: NANPAI_LOGO_URL,
  siteTag: '热带水果制品解决方案提供商',
  announcement: '员工与合作伙伴入口',
  authKicker: '员工入口',
  authTitle: '账号登录',
  authSafeNote: '账号由管理员统一分配',
  authFootnote: '仅授权人员使用',
  primaryActionText: '员工登录',
  secondaryActionText: '了解平台',
  secondaryActionUrl: '/eiscore',
  showSecondaryAction: false,
  passBadgeText: '员工通行',
  businessChainTitle: '从产地到交付的服务路径',
  scrollCueText: '向下了解企业',
  aboutSectionKicker: '关于企业',
  metricsSectionKicker: '企业实力',
  metricsSectionTitle: '多年深耕热带水果产业',
  capabilitiesSectionKicker: '产品与服务',
  capabilitiesSectionTitle: '从产地原料到客户应用的完整服务',
  backgroundImage: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgx6CtnwYoh8fKtgcwgA84vAU!1500x1500.jpg',
  metrics: [
    { label: '成立时间', value: '2009' },
    { label: '加工基地', value: '2' },
    { label: '注册资金', value: '1000万' }
  ],
  trustBadges: [
    { label: '雷州半岛产地优势' },
    { label: '双加工基地' },
    { label: '多场景客户服务' }
  ],
  businessChain: [
    { title: '原料甄选', description: '依托热带水果产区资源，关注原料风味、成熟度与稳定供应。', status: '产地直采' },
    { title: '加工制造', description: '围绕果浆、果粒、果酱等产品形态，支持规模化与定制化生产。', status: '稳定交付' },
    { title: '客户服务', description: '面向茶饮、烘焙、饮料与生鲜渠道，提供产品方案和交付支持。', status: '多场景适配' }
  ],
  capabilities: [
    { title: '热带水果制品', description: '围绕芒果、菠萝、百香果等热带水果，提供多形态原料产品。' },
    { title: '规模化加工', description: '依托湛江、广西加工基地，保障稳定产能与产品一致性。' },
    { title: '应用方案支持', description: '结合茶饮、烘焙、饮料等使用场景，提供选型与应用建议。' }
  ],
  carouselImages: [
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg5uqnnwYoiNO9CjDcCziIBQ.jpg',
      title: '热带水果全产业链布局',
      subtitle: '覆盖种植、加工、研发、销售与服务'
    },
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3-CwnwYo_qL0ggIwjgI4nwM.jpg',
      title: '加工与品控能力',
      subtitle: '支持多品类水果制品的规模化生产'
    },
    {
      url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgheiwnwYoj7jo0QQwjgI4nwM.jpg',
      title: '面向多场景客户',
      subtitle: '服务茶饮、烘焙、饮料与生鲜渠道'
    }
  ],
  footerText: 'Copyright © 广东南派食品有限公司',
  icpText: ''
}

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const showPassword = ref(false)
const appSettings = ref({ themeColor: '#409EFF', loginBranding: defaultLoginBranding })
const activeSceneIndex = ref(0)
const pageRef = ref(null)
const storyRef = ref(null)
const loginCardRef = ref(null)
const showDock = ref(false)
const scrollY = ref(0)
let sceneTimer = null
let revealObserver = null

const form = reactive({
  username: '',
  password: '',
  remember: false
})

const safeArray = (input) => Array.isArray(input) ? input : []
const normalizeText = (value, fallback = '') => String(value || fallback || '').trim()
const stripPlatformBrand = (value = '') => normalizeText(value).replace(/eiscore/ig, '').replace(/\s{2,}/g, ' ').trim()
const sanitizePublicText = (value = '', fallback = '') => {
  const text = stripPlatformBrand(value || fallback)
    .replace(/更适合移动端/g, '')
    .replace(/更适合手机阅读的/g, '')
    .replace(/更适合手机阅读/g, '')
    .replace(/移动端/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return text || fallback
}

const normalizeList = (items, mapper, fallback = []) => {
  const source = safeArray(items).length ? safeArray(items) : fallback
  return source.map(mapper).filter(Boolean)
}

const normalizeBranding = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  return {
    ...defaultLoginBranding,
    ...source,
    companyName: normalizeText(source.companyName, defaultLoginBranding.companyName),
    slogan: normalizeText(source.slogan, defaultLoginBranding.slogan),
    description: normalizeText(source.description, defaultLoginBranding.description),
    logo: normalizeText(source.logo, defaultLoginBranding.logo),
    siteTag: normalizeText(source.siteTag, defaultLoginBranding.siteTag),
    announcement: normalizeText(source.announcement, defaultLoginBranding.announcement),
    authKicker: normalizeText(source.authKicker, defaultLoginBranding.authKicker),
    authTitle: normalizeText(source.authTitle, defaultLoginBranding.authTitle),
    authSafeNote: normalizeText(source.authSafeNote, defaultLoginBranding.authSafeNote),
    authFootnote: normalizeText(source.authFootnote, defaultLoginBranding.authFootnote),
    primaryActionText: normalizeText(source.primaryActionText, defaultLoginBranding.primaryActionText),
    secondaryActionText: normalizeText(source.secondaryActionText, defaultLoginBranding.secondaryActionText),
    secondaryActionUrl: normalizeText(source.secondaryActionUrl, defaultLoginBranding.secondaryActionUrl),
    showSecondaryAction: source.showSecondaryAction === true,
    passBadgeText: sanitizePublicText(source.passBadgeText, defaultLoginBranding.passBadgeText),
    businessChainTitle: sanitizePublicText(source.businessChainTitle, defaultLoginBranding.businessChainTitle),
    scrollCueText: normalizeText(source.scrollCueText, defaultLoginBranding.scrollCueText),
    aboutSectionKicker: normalizeText(source.aboutSectionKicker, defaultLoginBranding.aboutSectionKicker),
    metricsSectionKicker: normalizeText(source.metricsSectionKicker, defaultLoginBranding.metricsSectionKicker),
    metricsSectionTitle: normalizeText(source.metricsSectionTitle, defaultLoginBranding.metricsSectionTitle),
    capabilitiesSectionKicker: normalizeText(source.capabilitiesSectionKicker, defaultLoginBranding.capabilitiesSectionKicker),
    capabilitiesSectionTitle: normalizeText(source.capabilitiesSectionTitle, defaultLoginBranding.capabilitiesSectionTitle),
    backgroundImage: normalizeText(source.backgroundImage, defaultLoginBranding.backgroundImage),
    metrics: normalizeList(source.metrics, (item) => {
      const label = normalizeText(item?.label)
      const value = normalizeText(item?.value)
      return label || value ? { label, value } : null
    }, defaultLoginBranding.metrics).slice(0, 4),
    trustBadges: normalizeList(source.trustBadges, (item) => {
      const label = typeof item === 'string' ? item.trim() : normalizeText(item?.label)
      return label ? { label } : null
    }, defaultLoginBranding.trustBadges).slice(0, 5),
    businessChain: normalizeList(source.businessChain, (item) => {
      const title = normalizeText(item?.title)
      const description = normalizeText(item?.description)
      const status = normalizeText(item?.status)
      return title || description ? { title, description, status } : null
    }, defaultLoginBranding.businessChain).slice(0, 5),
    capabilities: normalizeList(source.capabilities, (item) => {
      const title = normalizeText(item?.title)
      const description = normalizeText(item?.description)
      return title || description ? { title, description } : null
    }, defaultLoginBranding.capabilities).slice(0, 4),
    carouselImages: normalizeList(source.carouselImages, (item) => {
      const url = typeof item === 'string' ? item.trim() : normalizeText(item?.url)
      if (!url) return null
      return {
        url,
        title: normalizeText(item?.title),
        subtitle: normalizeText(item?.subtitle)
      }
    }, defaultLoginBranding.carouselImages).slice(0, 6),
    footerText: stripPlatformBrand(source.footerText || defaultLoginBranding.footerText),
    icpText: normalizeText(source.icpText)
  }
}

const branding = computed(() => normalizeBranding(appSettings.value?.loginBranding))
const companyName = computed(() => branding.value.companyName)
const siteTagText = computed(() => branding.value.siteTag)
const brandInitial = computed(() => companyName.value.slice(0, 1))
const carouselItems = computed(() => branding.value.carouselImages)
const heroScenes = computed(() => {
  const items = carouselItems.value.length ? carouselItems.value : []
  if (!items.length && branding.value.backgroundImage) {
    return [{ url: branding.value.backgroundImage, title: companyName.value, subtitle: branding.value.slogan }]
  }
  return items
})
const activeScene = computed(() => heroScenes.value[activeSceneIndex.value % Math.max(heroScenes.value.length, 1)] || {})
const activeSceneNumber = computed(() => activeSceneIndex.value % Math.max(heroScenes.value.length, 1))
const sceneProgressItems = computed(() => heroScenes.value.map((_, index) => index))
const heroSceneTitle = computed(() => activeScene.value.title || branding.value.siteTag)
const heroSceneSubtitle = computed(() => activeScene.value.subtitle || introLead.value)
const galleryImages = computed(() => carouselItems.value.filter((item) => item.url))
const metricItems = computed(() => branding.value.metrics)
const trustBadgeItems = computed(() => branding.value.trustBadges)
const businessChainItems = computed(() => branding.value.businessChain)
const capabilityItems = computed(() => branding.value.capabilities)
const showSecondaryAction = computed(() => {
  if (!branding.value.showSecondaryAction) return false
  const url = branding.value.secondaryActionUrl
  if (!url || /^\/?eiscore\/?$/i.test(url)) return false
  return Boolean(branding.value.secondaryActionText)
})
const displayPassBadgeText = computed(() => sanitizePublicText(branding.value.passBadgeText, defaultLoginBranding.passBadgeText))
const sanitizedBusinessChainTitle = computed(() => sanitizePublicText(branding.value.businessChainTitle, defaultLoginBranding.businessChainTitle))
const displayFooterText = computed(() => {
  const text = stripPlatformBrand(branding.value.footerText)
  if (!text || /^copyright\s*©?$/i.test(text)) return `Copyright © ${companyName.value}`
  return text
})
const introLead = computed(() => {
  const text = branding.value.description
  const firstSentence = text.split(/[。！？]/).find(Boolean)
  return firstSentence ? `${firstSentence}。` : text
})

const safeThemeColor = computed(() => {
  const color = normalizeText(appSettings.value?.themeColor, '#409EFF')
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#409EFF'
})

const pageStyle = computed(() => ({
  '--mobile-login-theme': safeThemeColor.value,
  '--mobile-login-ink': '#0f172a',
  '--mobile-hero-shift': `${Math.min(scrollY.value * 0.08, 28)}px`,
  '--mobile-scroll-progress': `${Math.min(scrollY.value / 640, 1)}`
}))

const loadAppSettings = async () => {
  try {
    const token = getToken()
    const headers = { 'Accept-Profile': 'public' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch('/api/system_configs?key=eq.app_settings', { headers })
    if (!res.ok) return
    const list = await res.json()
    const row = Array.isArray(list) ? list[0] : null
    if (row?.value && typeof row.value === 'object') {
      appSettings.value = {
        themeColor: normalizeText(row.value.themeColor, '#409EFF'),
        loginBranding: normalizeBranding(row.value.loginBranding)
      }
    }
  } catch {
    // Use local defaults when public settings cannot be loaded.
  }
}

onMounted(async () => {
  await loadAppSettings()

  if (isAuthenticated()) {
    const redirect = route.query.redirect || '/'
    router.replace(redirect)
  }

  const saved = localStorage.getItem('mobile_remembered_user')
  if (saved) {
    form.username = saved
    form.remember = true
  }

  startSceneRotation()
  initReveal()
})

onBeforeUnmount(() => {
  if (sceneTimer) window.clearInterval(sceneTimer)
  if (revealObserver) revealObserver.disconnect()
})

function startSceneRotation() {
  if (sceneTimer) window.clearInterval(sceneTimer)
  if (heroScenes.value.length <= 1) return
  sceneTimer = window.setInterval(() => {
    activeSceneIndex.value = (activeSceneIndex.value + 1) % heroScenes.value.length
  }, 4200)
}

function initReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.mobile-reveal').forEach((el) => el.classList.add('is-visible'))
    return
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObserver?.unobserve(entry.target)
      }
    })
  }, { root: document.querySelector('.mobile-login'), threshold: 0.18 })
  document.querySelectorAll('.mobile-reveal').forEach((el) => revealObserver.observe(el))
}

async function handleLogin() {
  loading.value = true
  try {
    const res = await fetch('/api/rpc/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username.trim(),
        password: form.password.trim()
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '账号或密码错误')
    }

    const data = await res.json()
    const token = data.token
    if (!token) throw new Error('服务器未返回有效凭证')

    const payload = parseJwt(token)
    const permissions = Array.isArray(data.permissions)
      ? data.permissions
      : (Array.isArray(payload?.permissions) ? payload.permissions : [])

    let userInfo = {
      username: payload?.username || form.username,
      full_name: '',
      avatar: '',
      role: data.app_role || payload?.app_role || '',
      permissions
    }

    try {
      const encodedUsername = encodeURIComponent(payload.username)
      const headers = {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Authorization': `Bearer ${token}`
      }
      const urls = [
        `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id,sop_role`,
        `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id`
      ]
      for (const url of urls) {
        const userRes = await fetch(url, { headers })
        if (!userRes.ok) continue
        const list = await userRes.json()
        if (Array.isArray(list) && list.length > 0) {
          userInfo = { ...userInfo, ...list[0] }
          userInfo.sopRole = userInfo.sop_role || userInfo.sopRole || ''
          break
        }
      }
    } catch {
      // 用户详情获取失败不影响登录
    }

    setAuth(token, userInfo)

    if (form.remember) {
      localStorage.setItem('mobile_remembered_user', form.username)
    } else {
      localStorage.removeItem('mobile_remembered_user')
    }

    showToast({ message: '登录成功', type: 'success', duration: 1000 })

    const redirect = route.query.redirect || '/'
    setTimeout(() => router.replace(redirect), 500)
  } catch (e) {
    showFailToast(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

function goDesktop() {
  window.location.href = '/'
}

function openSecondaryAction() {
  const url = branding.value.secondaryActionUrl
  if (!url) return
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  if (url.startsWith('/mobile')) {
    window.location.href = url
    return
  }
  window.location.href = url
}

function scrollToStory() {
  storyRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToLogin() {
  loginCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function handlePageScroll(event) {
  scrollY.value = event.target?.scrollTop || 0
  showDock.value = scrollY.value > 240
}
</script>

<style scoped>
.mobile-login {
  height: 100%;
  min-height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  color: #152033;
  background:
    linear-gradient(180deg, #f8fbff 0%, #eef5f7 48%, #ffffff 100%);
}

.mobile-hero {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  color: #fff;
  padding: calc(16px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}

.hero-media,
.hero-shade,
.hero-texture {
  position: absolute;
  inset: 0;
}

.hero-media {
  bottom: auto;
  height: min(40svh, 340px);
  border-radius: 0 0 28px 28px;
  overflow: hidden;
  transform: translateY(var(--mobile-hero-shift, 0px));
  will-change: transform;
}

.hero-scene,
.hero-scene-bg,
.hero-scene-main {
  position: absolute;
  inset: 0;
}

.hero-scene {
  opacity: 0;
  transition: opacity 0.72s ease;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--mobile-login-theme) 18%, #0f172a), #172032);
}

.hero-scene.active {
  opacity: 1;
}

.hero-scene-bg,
.hero-scene-main {
  width: 100%;
  height: 100%;
  display: block;
}

.hero-scene-bg {
  object-fit: cover;
  object-position: center center;
  filter: saturate(1.06);
  transform: scale(1.02);
  opacity: 1;
}

.hero-scene-main {
  object-fit: cover;
  object-position: center center;
  transform: scale(1.01);
  opacity: 0.88;
  animation: imageDrift 10s ease-in-out infinite alternate;
}

.hero-texture {
  opacity: 0.42;
  mix-blend-mode: screen;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.8));
}

.hero-shade {
  bottom: auto;
  height: min(42svh, 360px);
  background:
    linear-gradient(180deg, rgba(3, 9, 16, 0.2) 0%, rgba(3, 9, 16, 0.42) 52%, rgba(3, 9, 16, 0.88) 100%),
    linear-gradient(135deg, color-mix(in srgb, var(--mobile-login-theme) 34%, transparent) 0%, transparent 42%);
}

.hero-topbar,
.hero-copy,
.metric-carousel,
.trust-float,
.access-sheet,
.scroll-cue {
  position: relative;
  z-index: 1;
}

.hero-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-logo {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 0 0 auto;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(18px);
}

.brand-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-lockup strong,
.brand-lockup span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-lockup strong {
  max-width: 202px;
  font-size: 15px;
  font-weight: 800;
}

.brand-lockup span {
  max-width: 202px;
  margin-top: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
}

.desktop-link,
.secondary-link,
.scroll-cue,
.text-action,
.mobile-dock button {
  border: 0;
  background: transparent;
  font: inherit;
}

.desktop-link {
  height: 34px;
  padding: 0 11px;
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  white-space: nowrap;
  backdrop-filter: blur(18px);
}

.hero-copy {
  margin-top: 20px;
  padding-bottom: 8px;
  animation: heroRise 0.82s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  opacity: calc(1 - var(--mobile-scroll-progress, 0) * 0.18);
}

.brand-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 11px;
  backdrop-filter: blur(18px);
}

.hero-copy h1 {
  margin: 10px 0 0;
  max-width: 8em;
  font-size: 31px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0;
  text-wrap: balance;
}

.brand-slogan {
  margin: 8px 0 0;
  max-width: 20em;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 750;
}

.scene-note {
  display: none;
  margin-top: 9px;
  gap: 4px;
  max-width: 88%;
  padding-left: 12px;
  border-left: 2px solid rgba(255, 255, 255, 0.56);
}

.scene-note span,
.scene-note small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-note span {
  font-size: 13px;
  font-weight: 800;
}

.scene-note small {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.scene-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
}

.scene-progress span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.34);
  transition: width 0.35s ease, background 0.35s ease;
}

.scene-progress span.active {
  width: 28px;
  background: #fff;
}

.trust-float {
  display: none;
  gap: 8px;
  overflow-x: auto;
  margin: 0 -16px 8px;
  padding: 0 16px;
  scrollbar-width: none;
}

.trust-float::-webkit-scrollbar,
.metric-carousel::-webkit-scrollbar,
.story-lane::-webkit-scrollbar,
.capability-stack::-webkit-scrollbar {
  display: none;
}

.trust-float span {
  flex: 0 0 auto;
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  backdrop-filter: blur(14px);
  animation: chipIn 0.7s ease both;
  animation-delay: var(--delay);
}

.metric-carousel {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  margin: 0 -16px;
  padding: 0 16px 7px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.metric-carousel article {
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(7, 17, 30, 0.26);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(16px);
  scroll-snap-align: start;
  animation: metricFloat 3.8s ease-in-out infinite;
}

.metric-carousel article:nth-child(2n) {
  animation-delay: 0.45s;
}

.metric-carousel strong,
.metric-carousel span {
  display: block;
}

.metric-carousel strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  line-height: 1;
}

.metric-carousel span {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
}

.access-sheet {
  margin: 6px -16px 0;
  padding: 8px 16px calc(12px + env(safe-area-inset-bottom));
  border-radius: 30px 30px 0 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(247, 250, 252, 0.93));
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-bottom: 0;
  box-shadow:
    0 24px 52px rgba(2, 8, 23, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
  overflow: hidden;
  backdrop-filter: blur(22px);
  animation: sheetDock 0.72s cubic-bezier(0.2, 0.8, 0.2, 1) 0.08s both;
}

.access-handle {
  width: 38px;
  height: 4px;
  margin: 0 auto 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.16);
}

.access-pass {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  margin: 0 0 10px;
  padding: 9px 11px;
  border-radius: 18px;
  color: #fff;
  background:
    linear-gradient(135deg, #0b1726 0%, color-mix(in srgb, var(--mobile-login-theme) 68%, #0b1726) 100%);
  box-shadow: 0 14px 28px color-mix(in srgb, var(--mobile-login-theme) 24%, transparent);
  isolation: isolate;
  overflow: hidden;
}

.access-pass::before,
.access-pass::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.access-pass::before {
  z-index: -1;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 18px 18px;
  opacity: 0.55;
}

.access-pass::after {
  width: 54px;
  left: -76px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34), transparent);
  transform: skewX(-18deg);
  animation: passScan 4.2s ease-in-out infinite;
}

.pass-mark {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.22);
  font-weight: 900;
}

.pass-mark img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.access-pass span,
.access-pass strong,
.access-pass em {
  display: block;
}

.access-pass span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
}

.access-pass strong {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.1;
}

.access-pass em {
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.78);
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0;
}

.access-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 6px 8px;
}

.access-title span,
.access-title strong,
.access-status small {
  display: block;
}

.access-title span {
  color: var(--mobile-login-theme);
  font-size: 12px;
  font-weight: 800;
}

.access-title strong {
  margin-top: 3px;
  color: #0f172a;
  font-size: 19px;
  line-height: 1;
}

.access-status {
  min-height: 30px;
  max-width: 46%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef5f2;
  color: #476056;
}

.access-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #18a058;
  box-shadow: 0 0 0 4px rgba(24, 160, 88, 0.12);
  flex: 0 0 auto;
}

.access-status small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.access-form :deep(.van-cell-group--inset) {
  margin: 0;
  border: 0;
  border-radius: 20px;
  overflow: hidden;
  background: #f1f5f9;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 0 rgba(15, 23, 42, 0.04);
}

.access-form :deep(.van-cell) {
  background: transparent;
  padding: 10px 14px;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.access-form :deep(.van-cell:focus-within) {
  background: #fff;
  box-shadow:
    inset 3px 0 0 var(--mobile-login-theme),
    0 12px 26px rgba(15, 23, 42, 0.08);
}

.access-form :deep(.van-field__left-icon) {
  color: color-mix(in srgb, var(--mobile-login-theme) 78%, #64748b);
  margin-right: 8px;
}

.access-form :deep(.van-field__label) {
  width: 40px;
  color: #1f2937;
  font-weight: 800;
}

.access-form :deep(.van-field__control) {
  color: #0f172a;
  font-weight: 700;
}

.access-form :deep(.van-field__control::placeholder) {
  color: #b7c0cc;
  font-weight: 500;
}

.form-actions {
  padding: 9px 8px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.form-actions span {
  color: #94a3b8;
  font-size: 12px;
}

.submit-area {
  padding: 13px 0 6px;
}

.submit-area :deep(.van-button--primary) {
  position: relative;
  overflow: hidden;
  min-height: 48px;
  background: var(--mobile-login-theme);
  border-color: var(--mobile-login-theme);
  font-weight: 900;
  letter-spacing: 0;
  box-shadow:
    0 18px 32px color-mix(in srgb, var(--mobile-login-theme) 32%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.submit-area :deep(.van-button--primary::after) {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0.2) 48%, transparent 58%);
  transform: translateX(-120%);
  animation: buttonSheen 3.8s ease-in-out infinite;
}

.submit-area :deep(.van-button--primary:active) {
  transform: translateY(1px) scale(0.99);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--mobile-login-theme) 24%, transparent);
}

.secondary-link {
  display: block;
  width: 100%;
  padding: 7px 16px 0;
  color: color-mix(in srgb, var(--mobile-login-theme) 82%, #0f172a);
  text-align: center;
  font-size: 13px;
  font-weight: 750;
}

.scroll-cue {
  align-self: center;
  margin: 7px auto 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  display: grid;
  justify-items: center;
  gap: 6px;
}

.scroll-cue i {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.54);
  animation: scrollCue 1.4s ease-in-out infinite;
}

.company-content {
  padding: 22px 0 84px;
  overflow: hidden;
}

.story-section,
.intro-section,
.chain-section,
.capability-section {
  padding: 0 16px;
  margin-top: 24px;
}

.section-heading {
  padding: 0 2px;
}

.section-heading span {
  display: block;
  color: var(--mobile-login-theme);
  font-size: 12px;
  font-weight: 850;
}

.section-heading h2 {
  margin: 7px 0 0;
  color: #101827;
  font-size: 24px;
  line-height: 1.18;
  font-weight: 900;
  letter-spacing: 0;
}

.story-lane {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  margin: 16px -16px 0;
  padding: 0 16px 6px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.story-card {
  position: relative;
  flex: 0 0 78%;
  height: 360px;
  margin: 0;
  overflow: hidden;
  border-radius: 28px;
  background: #0f172a;
  box-shadow: 0 26px 52px rgba(15, 23, 42, 0.18);
  scroll-snap-align: center;
}

.story-card img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.story-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 38%, rgba(2, 8, 23, 0.82) 100%);
}

.story-card figcaption {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 1;
  color: #fff;
}

.story-card span,
.story-card strong,
.story-card small {
  display: block;
}

.story-card span {
  width: fit-content;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 11px;
}

.story-card strong {
  margin-top: 10px;
  font-size: 21px;
  line-height: 1.2;
}

.story-card small {
  margin-top: 7px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 1.5;
}

.intro-section {
  position: relative;
  padding-top: 26px;
  padding-bottom: 26px;
}

.intro-section::before {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(15, 23, 42, 0.18), transparent);
}

.intro-section > p,
.chain-item p,
.capability-card p {
  margin: 14px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.78;
}

.text-action {
  margin-top: 18px;
  height: 38px;
  padding: 0 15px;
  border-radius: 999px;
  color: #fff;
  background: var(--mobile-login-theme);
  font-size: 13px;
  font-weight: 800;
}

.chain-timeline {
  position: relative;
  margin-top: 18px;
  padding-left: 8px;
}

.chain-timeline::before {
  content: '';
  position: absolute;
  left: 28px;
  top: 18px;
  bottom: 18px;
  width: 1px;
  background: linear-gradient(180deg, var(--mobile-login-theme), rgba(15, 23, 42, 0.1));
}

.chain-item {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 13px;
  padding: 0 0 18px;
  animation: riseIn 0.7s ease both;
  animation-delay: var(--delay);
}

.chain-item > strong {
  position: relative;
  z-index: 1;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: #fff;
  background: var(--mobile-login-theme);
  box-shadow: 0 12px 24px color-mix(in srgb, var(--mobile-login-theme) 28%, transparent);
  font-size: 14px;
}

.chain-item > div {
  padding: 15px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #e8edf4;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.chain-item span,
.capability-card span {
  display: inline-flex;
  color: color-mix(in srgb, var(--mobile-login-theme) 86%, #0f172a);
  font-size: 12px;
  font-weight: 800;
}

.chain-item h3,
.capability-card h3 {
  margin: 6px 0 0;
  color: #101827;
  font-size: 17px;
}

.capability-stack {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  margin: 16px -16px 0;
  padding: 0 16px 8px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.capability-card {
  flex: 0 0 82%;
  border-radius: 24px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e8edf4;
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.09);
  scroll-snap-align: start;
  animation: riseIn 0.7s ease both;
  animation-delay: var(--delay);
}

.capability-card img {
  width: 100%;
  height: 150px;
  display: block;
  object-fit: cover;
}

.capability-card div {
  padding: 16px;
}

.mobile-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(248, 251, 255, 0), rgba(248, 251, 255, 0.96) 38%);
  backdrop-filter: blur(16px);
}

.mobile-dock.single {
  grid-template-columns: 1fr;
}

.mobile-dock button {
  height: 44px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 850;
}

.mobile-dock button:first-child {
  color: #fff;
  background: var(--mobile-login-theme);
  box-shadow: 0 16px 28px color-mix(in srgb, var(--mobile-login-theme) 25%, transparent);
}

.mobile-dock button:last-child {
  padding: 0 16px;
  color: #0f172a;
  background: #fff;
  border: 1px solid #e8edf4;
}

.login-footer {
  padding: 18px 16px calc(28px + env(safe-area-inset-bottom));
  text-align: center;
}

.login-footer p {
  color: #94a3b8;
  font-size: 12px;
  margin: 4px 0 0;
}

.mobile-reveal {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}

.mobile-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

@keyframes imageDrift {
  from { transform: scale(1.01) translate3d(-0.8%, -0.4%, 0); }
  to { transform: scale(1.05) translate3d(0.8%, 0.4%, 0); }
}

@keyframes heroRise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sheetDock {
  from { opacity: 0; transform: translateY(26px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes passScan {
  0%, 54% { transform: translateX(0) skewX(-18deg); opacity: 0; }
  64% { opacity: 1; }
  100% { transform: translateX(460px) skewX(-18deg); opacity: 0; }
}

@keyframes metricFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

@keyframes chipIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scrollCue {
  0%, 100% { transform: scaleY(0.45); transform-origin: top; opacity: 0.45; }
  50% { transform: scaleY(1); opacity: 1; }
}

@keyframes buttonSheen {
  0%, 62% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}

@keyframes riseIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 360px) {
  .brand-lockup strong,
  .brand-lockup span {
    max-width: 152px;
  }

  .hero-copy h1 {
    font-size: 28px;
  }

  .brand-slogan {
    font-size: 12px;
  }

  .metric-carousel article {
    padding-inline: 8px;
  }

  .access-status {
    max-width: 42%;
  }

  .story-card {
    flex-basis: 84%;
    height: 330px;
  }

  .capability-card {
    flex-basis: 88%;
  }
}

@media (min-height: 820px) {
  .hero-copy {
    margin-top: 48px;
  }

  .trust-float {
    margin-top: 4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-media img,
  .hero-scene-main,
  .trust-float span,
  .metric-carousel article,
  .access-sheet,
  .access-pass::after,
  .scroll-cue i,
  .submit-area :deep(.van-button--primary::after),
  .chain-item,
  .capability-card {
    animation: none;
  }

  .mobile-reveal {
    transition: none;
  }
}
</style>
