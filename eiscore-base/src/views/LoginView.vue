<template>
  <div class="login-page" :class="{ 'is-scrolled': pageScrolled }" :style="pageStyle">
    <header class="site-header">
      <div class="brand-lockup">
        <div class="brand-mark">
          <img v-if="branding.logo" :src="branding.logo" alt="企业标识" />
          <span v-else>{{ brandInitial }}</span>
        </div>
        <div class="site-name">
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
      <button type="button" class="header-login" @click="focusLogin">
        {{ branding.headerLoginText }}
      </button>
    </header>

    <main>
      <section class="hero-section" id="overview">
        <div class="hero-media" aria-hidden="true">
          <img v-if="heroImage" :src="heroImage" alt="" />
        </div>
        <div class="hero-shade" />

        <div class="hero-inner">
          <div class="hero-copy reveal is-visible">
            <p class="brand-kicker">{{ siteTagText }}</p>
            <h1>{{ companyName }}</h1>
            <p class="brand-slogan">{{ branding.slogan }}</p>
            <p class="brand-intro">{{ introLead }}</p>
            <div v-if="trustBadgeItems.length" class="trust-strip" aria-label="企业能力标签">
              <span
                v-for="(item, index) in trustBadgeItems"
                :key="item.label"
                :style="{ transitionDelay: `${index * 90}ms` }"
              >
                {{ item.label }}
              </span>
            </div>
          </div>

          <section class="auth-panel" aria-label="员工登录">
            <div class="auth-card reveal is-visible" ref="authCardRef">
              <div class="auth-card-header">
                <span>{{ branding.authKicker }}</span>
                <h2>{{ branding.authTitle }}</h2>
                <p class="auth-subtitle">{{ branding.announcement }}</p>
              </div>

              <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" class="login-form" size="large">
                <el-form-item prop="username">
                  <el-input v-model="loginForm.username" placeholder="用户名" prefix-icon="User" />
                </el-form-item>

                <el-form-item prop="password">
                  <el-input
                    v-model="loginForm.password"
                    type="password"
                    placeholder="密码"
                    prefix-icon="Lock"
                    show-password
                    @keyup.enter="handleLogin"
                  />
                </el-form-item>

                <el-form-item>
                  <div class="form-meta">
                    <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
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

        <div v-if="heroFacts.length" class="hero-facts" aria-label="企业亮点">
          <span v-for="item in heroFacts" :key="`${item.value}-${item.label}`">
            <strong>{{ item.value }}</strong>
            {{ item.label }}
          </span>
        </div>

        <button type="button" class="scroll-cue" @click="scrollToSection('metrics')" aria-label="查看企业实力">
          <span>{{ branding.scrollCueText }}</span>
          <i />
        </button>
      </section>

      <section class="metrics-band reveal" id="metrics">
        <div class="section-heading narrow">
          <span>{{ branding.metricsSectionKicker }}</span>
          <h2>{{ branding.metricsSectionTitle }}</h2>
        </div>
        <div v-if="metricItems.length" class="metrics-section">
          <article v-for="item in metricItems" :key="`${item.label}-${item.value}`" class="metric-card">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </article>
        </div>
      </section>

      <section class="story-section reveal" id="about">
        <div class="story-copy">
          <span>{{ branding.aboutSectionKicker }}</span>
          <h2>{{ branding.slogan }}</h2>
          <p>{{ branding.description }}</p>
          <button type="button" class="text-link" @click="openSecondaryAction">
            {{ branding.secondaryActionText }}
          </button>
        </div>
        <div class="story-media" aria-hidden="true">
          <img v-if="highlightImage" :src="highlightImage" alt="" />
        </div>
      </section>

      <section
        v-if="businessChainItems.length || capabilityItems.length"
        class="operation-section reveal"
        id="capabilities"
      >
        <div class="section-heading narrow">
          <span>{{ branding.capabilitiesSectionKicker }}</span>
          <h2>{{ branding.capabilitiesSectionTitle }}</h2>
        </div>

        <div v-if="businessChainItems.length" class="chain-list">
          <article v-for="(item, index) in businessChainItems" :key="item.title || item.description" class="chain-item">
            <strong>{{ String(index + 1).padStart(2, '0') }}</strong>
            <div>
              <span v-if="item.status">{{ item.status }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </article>
        </div>

        <div v-if="capabilityItems.length" class="capability-list">
          <article v-for="(item, index) in capabilityItems" :key="item.title || item.description" class="capability-card">
            <img v-if="galleryImages[index]" :src="galleryImages[index].url" alt="" />
            <div>
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="carouselItems.length" class="gallery-section reveal">
        <div class="gallery-track">
          <figure v-for="(item, index) in marqueeItems" :key="`gallery-${index}`">
            <img :src="item.url" alt="" />
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

    <footer class="site-footer">
      <span>{{ branding.footerText }}</span>
      <span v-if="branding.icpText">{{ branding.icpText }}</span>
    </footer>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useSystemStore } from '@/stores/system'
import { mix } from '@/utils/theme'

const NANPAI_LOGO_URL = 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3MisnwYo8JqKqQYw9AM49AM.jpg'

const router = useRouter()
const userStore = useUserStore()
const systemStore = useSystemStore()
const loading = ref(false)
const loginFormRef = ref(null)
const authCardRef = ref(null)
const pageScrolled = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const safeThemeColor = computed(() => {
  const color = String(systemStore.config?.themeColor || '#409EFF').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#409EFF'
})

const branding = computed(() => {
  const source = systemStore.config?.loginBranding || {}
  return {
    companyName: String(source.companyName || ''),
    slogan: String(source.slogan || '深耕热带水果全产业链，打造高品质水果制品方案'),
    description: String(source.description || '公司立足热带水果产区，面向茶饮、烘焙、饮料与生鲜客户提供水果制品和应用方案支持。'),
    logo: String(source.logo || NANPAI_LOGO_URL),
    siteTag: String(source.siteTag || '热带水果制品解决方案提供商'),
    announcement: String(source.announcement || '员工与合作伙伴入口'),
    headerLoginText: String(source.headerLoginText || '员工通道'),
    authKicker: String(source.authKicker || '员工入口'),
    authTitle: String(source.authTitle || '账号登录'),
    authSafeNote: String(source.authSafeNote || '账号由管理员统一分配'),
    authFootnote: String(source.authFootnote || '该入口仅供授权人员使用'),
    primaryActionText: String(source.primaryActionText || '员工登录'),
    secondaryActionText: String(source.secondaryActionText || '了解平台'),
    secondaryActionUrl: String(source.secondaryActionUrl || '/eiscore'),
    scrollCueText: String(source.scrollCueText || '向下了解企业'),
    metricsSectionKicker: String(source.metricsSectionKicker || '企业实力'),
    metricsSectionTitle: String(source.metricsSectionTitle || '多年深耕热带水果产业'),
    aboutSectionKicker: String(source.aboutSectionKicker || '关于企业'),
    capabilitiesSectionKicker: String(source.capabilitiesSectionKicker || '产品与服务'),
    capabilitiesSectionTitle: String(source.capabilitiesSectionTitle || '从产地原料到客户应用的完整服务'),
    leadersSectionKicker: String(source.leadersSectionKicker || '管理团队'),
    leadersSectionTitle: String(source.leadersSectionTitle || '管理团队'),
    backgroundImage: String(source.backgroundImage || ''),
    navItems: Array.isArray(source.navItems) ? source.navItems : [],
    metrics: Array.isArray(source.metrics) ? source.metrics : [],
    trustBadges: Array.isArray(source.trustBadges) ? source.trustBadges : [],
    businessChain: Array.isArray(source.businessChain) ? source.businessChain : [],
    capabilities: Array.isArray(source.capabilities) ? source.capabilities : [],
    carouselImages: Array.isArray(source.carouselImages) ? source.carouselImages : [],
    leaders: Array.isArray(source.leaders) ? source.leaders : [],
    footerText: String(source.footerText || 'Copyright © EISCore'),
    icpText: String(source.icpText || '')
  }
})

const looksLikeSystemName = (value) => /数字化|系统|平台|EISCore|信息化/i.test(String(value || ''))
const displayText = (value, fallback) => {
  const text = String(value || '').trim()
  if (!text || looksLikeSystemName(text)) return fallback
  return text
}

const companyName = computed(() => displayText(branding.value.companyName, '广东南派食品有限公司'))
const siteTagText = computed(() => displayText(branding.value.siteTag, '热带水果制品解决方案提供商'))
const brandInitial = computed(() => companyName.value.slice(0, 1))
const heroImage = computed(() => branding.value.backgroundImage || carouselItems.value[0]?.url || '')
const introLead = computed(() => {
  const text = branding.value.description.trim()
  const firstSentence = text.split(/[。！？]/).find(Boolean)
  return firstSentence ? `${firstSentence}。` : text
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
    subtitle: String(item?.subtitle || '').trim()
  }))
  .filter((item) => item.url))

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

const focusLogin = () => {
  authCardRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  requestAnimationFrame(() => {
    loginFormRef.value?.$el?.querySelector?.('input')?.focus?.()
  })
}

const openSecondaryAction = () => {
  const url = branding.value.secondaryActionUrl
  if (!url) return
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  router.push(url)
}

onMounted(async () => {
  await systemStore.loadConfig()
  systemStore.initTheme()
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
  window.removeEventListener('scroll', handleScroll)
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
        throw new Error(errData.message || '登录失败，账号或密码错误')
      }

      const data = await response.json()
      const realToken = data.token
      if (!realToken) throw new Error('服务器未返回有效 Token')

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
      ElMessage.success(`登录成功，欢迎 ${userData.user.name}`)
      router.push('/')
    } catch (error) {
      ElMessage.error(error.message || '登录出现异常')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  overflow-x: hidden;
  color: #111827;
  background: #f6f3ee;
}

.site-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 22px;
  min-height: 76px;
  padding: 14px clamp(18px, 4vw, 68px);
  box-sizing: border-box;
  color: #fff;
  background: linear-gradient(180deg, rgba(2, 6, 23, 0.56), rgba(2, 6, 23, 0));
  transition: min-height 220ms ease, background 220ms ease, border-color 220ms ease, color 220ms ease;
}

.is-scrolled .site-header {
  min-height: 66px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
  color: #111827;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
}

.is-scrolled .brand-mark {
  background: var(--login-theme);
  color: #fff;
}

.is-scrolled .site-nav button,
.is-scrolled .header-login {
  color: #111827;
}

.is-scrolled .header-login {
  border-color: rgba(17, 24, 39, 0.18);
  background: rgba(255, 255, 255, 0.72);
}

.brand-lockup {
  display: flex;
  align-items: center;
  min-width: 280px;
  gap: 12px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.92);
  color: var(--login-theme);
  font-size: 18px;
  font-weight: 800;
  flex: 0 0 auto;
}

.brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.site-name {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.site-name strong {
  font-size: 16px;
  line-height: 1.2;
  white-space: nowrap;
}

.site-nav {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.site-nav button,
.header-login {
  height: 38px;
  padding: 0 14px;
  border-radius: 4px;
  border: 1px solid transparent;
  color: #fff;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
}

.site-nav button:hover {
  background: rgba(255, 255, 255, 0.14);
}

.is-scrolled .site-nav button:hover {
  background: color-mix(in srgb, var(--login-theme) 10%, #ffffff);
  color: var(--login-theme);
}

.header-login {
  border-color: rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(14px);
}

.header-login:hover {
  transform: translateY(-1px);
  background: var(--login-theme);
  border-color: var(--login-theme);
}

.hero-section {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  isolation: isolate;
  color: #fff;
}

.hero-media,
.hero-shade {
  position: absolute;
  inset: 0;
}

.hero-media {
  animation: heroZoom 18s ease-out forwards;
}

.hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
}

.hero-shade {
  z-index: 1;
  background:
    linear-gradient(90deg, rgba(2, 6, 23, 0.78) 0%, rgba(2, 6, 23, 0.54) 46%, rgba(2, 6, 23, 0.24) 100%),
    linear-gradient(180deg, rgba(2, 6, 23, 0.12) 0%, rgba(2, 6, 23, 0.64) 100%);
}

.hero-inner {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 410px);
  align-items: center;
  gap: clamp(28px, 5vw, 86px);
  width: min(1500px, 100%);
  margin: 0 auto;
  padding: 116px clamp(18px, 5vw, 76px) 82px;
  box-sizing: border-box;
}

.hero-copy {
  max-width: 780px;
  animation: copyRise 900ms ease both;
}

.brand-kicker {
  width: fit-content;
  margin: 0 0 22px;
  padding-left: 42px;
  position: relative;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  font-weight: 700;
}

.brand-kicker::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 30px;
  height: 1px;
  background: rgba(255, 255, 255, 0.72);
}

.hero-copy h1 {
  max-width: 860px;
  margin: 0;
  color: #fff;
  font-size: clamp(48px, 7vw, 104px);
  line-height: 0.98;
  font-weight: 800;
  letter-spacing: 0;
}

.brand-slogan {
  max-width: 760px;
  margin: 28px 0 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: clamp(22px, 2.3vw, 34px);
  line-height: 1.38;
  font-weight: 700;
}

.brand-intro {
  max-width: 660px;
  margin: 18px 0 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: 16px;
  line-height: 1.85;
}

.trust-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 30px;
}

.trust-strip span {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  font-weight: 700;
  opacity: 0;
  transform: translateY(12px);
  animation: chipIn 560ms ease forwards;
  animation-delay: 620ms;
}

.auth-panel {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.auth-card {
  position: relative;
  width: min(100%, 410px);
  padding: 30px;
  box-sizing: border-box;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 62px rgba(2, 6, 23, 0.28);
  color: #111827;
  backdrop-filter: blur(18px);
  overflow: hidden;
  animation: cardFloatIn 760ms ease 180ms both;
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.auth-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 28px 70px rgba(2, 6, 23, 0.32);
}

.auth-card-header span {
  position: relative;
  display: block;
  margin-bottom: 9px;
  color: var(--login-theme);
  font-size: 13px;
  font-weight: 800;
}

.auth-card-header span::after {
  content: '';
  display: inline-block;
  width: 28px;
  height: 1px;
  margin-left: 8px;
  vertical-align: middle;
  background: color-mix(in srgb, var(--login-theme) 68%, #cbd5e1);
}

.auth-card h2 {
  margin: 0;
  color: #111827;
  font-size: 30px;
  line-height: 1.15;
  font-weight: 800;
}

.auth-subtitle {
  margin: 10px 0 24px;
  color: #6b7280;
  line-height: 1.65;
}

.login-form :deep(.el-input__wrapper) {
  min-height: 46px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px #d7dce3 inset;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
  background: rgba(255, 255, 255, 0.92);
}

.login-form :deep(.el-input__wrapper.is-focus) {
  transform: translateY(-1px);
  background: #ffffff;
  box-shadow:
    0 0 0 1px var(--login-theme) inset,
    0 8px 18px rgba(17, 24, 39, 0.08);
}

.login-form :deep(.el-form-item) {
  transition: transform 180ms ease;
}

.login-form :deep(.el-form-item:focus-within) {
  transform: translateY(-1px);
}

.form-meta {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.safe-note {
  color: #64748b;
  font-size: 13px;
}

.login-btn {
  width: 100%;
  height: 46px;
  border-radius: 4px;
  font-weight: 800;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--login-theme) 20%, transparent);
}

.auth-footnote {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.scroll-cue {
  position: absolute;
  left: clamp(18px, 5vw, 76px);
  bottom: 28px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 700;
  cursor: pointer;
}

.scroll-cue i {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 50%;
  position: relative;
}

.scroll-cue i::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 11px;
  width: 7px;
  height: 7px;
  border-right: 1px solid #fff;
  border-bottom: 1px solid #fff;
  transform: translateX(-50%) rotate(45deg);
  animation: cueDrop 1.6s ease-in-out infinite;
}

.hero-facts {
  position: absolute;
  right: clamp(18px, 5vw, 76px);
  bottom: 28px;
  z-index: 3;
  display: flex;
  gap: 12px;
  color: #fff;
}

.hero-facts span {
  min-width: 98px;
  padding: 13px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  animation: factIn 720ms ease both;
}

.hero-facts span:nth-child(2) {
  animation-delay: 120ms;
}

.hero-facts span:nth-child(3) {
  animation-delay: 240ms;
}

.hero-facts strong {
  display: block;
  margin-bottom: 3px;
  color: #fff;
  font-size: 22px;
  line-height: 1;
}

.metrics-band,
.story-section,
.operation-section,
.gallery-section,
.leader-section {
  width: min(1420px, calc(100% - clamp(36px, 8vw, 136px)));
  margin: 0 auto;
}

.metrics-band {
  padding: clamp(58px, 7vw, 98px) 0 clamp(38px, 5vw, 72px);
}

.section-heading {
  margin-bottom: clamp(24px, 3vw, 40px);
}

.section-heading.narrow {
  max-width: 760px;
}

.section-heading span,
.story-copy span {
  display: block;
  margin-bottom: 12px;
  color: var(--login-theme);
  font-size: 13px;
  font-weight: 800;
}

.section-heading h2,
.story-copy h2 {
  margin: 0;
  color: #111827;
  font-size: clamp(30px, 4vw, 54px);
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: 0;
}

.metrics-section {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid rgba(17, 24, 39, 0.12);
  border-bottom: 1px solid rgba(17, 24, 39, 0.12);
}

.metric-card {
  min-height: 166px;
  padding: 30px 26px;
  border-right: 1px solid rgba(17, 24, 39, 0.12);
  background: transparent;
  transition: background 220ms ease, transform 220ms ease;
}

.metric-card:hover {
  background: rgba(255, 255, 255, 0.46);
  transform: translateY(-4px);
}

.metric-card:last-child {
  border-right: 0;
}

.metric-card strong {
  display: block;
  color: #111827;
  font-size: clamp(38px, 5vw, 68px);
  line-height: 1;
  font-weight: 800;
}

.metric-card span {
  display: block;
  margin-top: 14px;
  color: #64748b;
  font-size: 15px;
}

.story-section {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
  gap: clamp(32px, 5vw, 78px);
  align-items: center;
  padding: clamp(46px, 6vw, 86px) 0;
}

.story-copy p {
  margin: 22px 0 0;
  color: #475569;
  font-size: 16px;
  line-height: 1.9;
}

.text-link {
  margin-top: 28px;
  height: 44px;
  padding: 0 18px;
  border-radius: 4px;
  border: 1px solid #111827;
  background: #111827;
  color: #fff;
  font-weight: 800;
  cursor: pointer;
  transition: transform 180ms ease, background 180ms ease;
}

.text-link:hover {
  transform: translateY(-2px);
  background: var(--login-theme);
  border-color: var(--login-theme);
}

.story-media {
  height: clamp(360px, 42vw, 620px);
  overflow: hidden;
  border-radius: 8px;
}

.story-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 700ms ease;
}

.story-section:hover .story-media img {
  transform: scale(1.035);
}

.operation-section {
  padding: clamp(56px, 7vw, 104px) 0;
}

.chain-list {
  display: grid;
  border-top: 1px solid rgba(17, 24, 39, 0.12);
}

.chain-item {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: clamp(18px, 4vw, 70px);
  padding: clamp(24px, 3vw, 38px) 0;
  border-bottom: 1px solid rgba(17, 24, 39, 0.12);
  transition: padding-left 220ms ease, background 220ms ease;
}

.chain-item:hover {
  padding-left: 14px;
  background: rgba(255, 255, 255, 0.38);
}

.chain-item strong {
  color: color-mix(in srgb, var(--login-theme) 86%, #111827);
  font-size: 16px;
}

.chain-item span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 10px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--login-theme) 10%, #ffffff);
  color: var(--login-theme);
  font-size: 12px;
  font-weight: 800;
}

.chain-item h3 {
  margin: 0;
  color: #111827;
  font-size: clamp(22px, 2.5vw, 34px);
  font-weight: 800;
}

.chain-item p {
  max-width: 760px;
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.8;
}

.capability-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: clamp(32px, 4vw, 58px);
}

.capability-card {
  position: relative;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 46px rgba(17, 24, 39, 0.08);
  transition: transform 260ms ease, box-shadow 260ms ease;
}

.capability-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.36) 42%, transparent 68%);
  transform: translateX(-120%);
  transition: transform 700ms ease;
}

.capability-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 26px 56px rgba(17, 24, 39, 0.13);
}

.capability-card:hover::after {
  transform: translateX(120%);
}

.capability-card img {
  width: 100%;
  height: 210px;
  object-fit: cover;
  transition: transform 700ms ease;
}

.capability-card:hover img {
  transform: scale(1.045);
}

.capability-card div {
  padding: 22px;
}

.capability-card span {
  color: var(--login-theme);
  font-size: 12px;
  font-weight: 800;
}

.capability-card h3 {
  margin: 12px 0 0;
  color: #111827;
  font-size: 21px;
  font-weight: 800;
}

.capability-card p {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.7;
}

.gallery-section {
  padding: 0 0 clamp(52px, 7vw, 92px);
  overflow: hidden;
}

.gallery-track {
  display: flex;
  gap: 18px;
  width: max-content;
  animation: galleryMove 34s linear infinite;
}

.gallery-track:hover {
  animation-play-state: paused;
}

.gallery-track figure {
  position: relative;
  width: min(540px, 76vw);
  height: 320px;
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #111827;
}

.gallery-track img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-track figcaption {
  position: absolute;
  inset: auto 0 0;
  padding: 22px;
  color: #fff;
  background: linear-gradient(180deg, transparent, rgba(2, 6, 23, 0.82));
}

.gallery-track strong,
.gallery-track span {
  display: block;
}

.gallery-track strong {
  font-size: 20px;
  font-weight: 800;
}

.gallery-track span {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.78);
}

.leader-section {
  padding: clamp(50px, 6vw, 88px) 0;
}

.leader-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.leader-card {
  display: flex;
  gap: 14px;
  padding: 20px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.leader-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 48px rgba(17, 24, 39, 0.12);
}

.leader-card h4 {
  margin: 2px 0 2px;
  color: #111827;
  font-size: 16px;
  font-weight: 800;
}

.leader-title,
.leader-intro {
  margin: 0;
  color: #64748b;
}

.leader-intro {
  margin-top: 6px;
  line-height: 1.6;
}

.site-footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 26px 20px 30px;
  border-top: 1px solid rgba(17, 24, 39, 0.1);
  color: #64748b;
  font-size: 12px;
}

.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 700ms ease, transform 700ms ease;
}

.reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

@keyframes heroZoom {
  from { transform: scale(1.04); }
  to { transform: scale(1); }
}

@keyframes copyRise {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes cardFloatIn {
  from { opacity: 0; transform: translateY(30px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes chipIn {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes factIn {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes cueDrop {
  0%, 100% { transform: translate(-50%, 0) rotate(45deg); opacity: 0.5; }
  50% { transform: translate(-50%, 8px) rotate(45deg); opacity: 1; }
}

@keyframes galleryMove {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-50% - 9px)); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-media,
  .auth-card,
  .scroll-cue i::after,
  .gallery-track {
    animation: none;
  }

  .reveal,
  .trust-strip span {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

@media (max-width: 1280px) {
  .hero-inner,
  .story-section {
    grid-template-columns: 1fr;
  }

  .auth-panel {
    justify-content: flex-start;
  }

  .capability-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .site-header {
    min-height: 68px;
    padding: 12px 14px;
  }

  .brand-lockup {
    min-width: 0;
  }

  .site-name span,
  .site-nav {
    display: none;
  }

  .header-login {
    margin-left: auto;
    padding: 0 12px;
  }

  .hero-inner {
    min-height: 100vh;
    grid-template-columns: 1fr;
    padding: 92px 18px 76px;
  }

  .hero-copy h1 {
    font-size: 42px;
  }

  .brand-slogan {
    font-size: 21px;
  }

  .auth-card {
    padding: 22px;
  }

  .scroll-cue {
    left: 18px;
    bottom: 18px;
  }

  .hero-facts {
    display: none;
  }

  .metrics-band,
  .story-section,
  .operation-section,
  .gallery-section,
  .leader-section {
    width: calc(100% - 36px);
  }

  .metrics-section,
  .capability-list,
  .leader-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    border-right: 0;
    border-bottom: 1px solid rgba(17, 24, 39, 0.12);
  }

  .metric-card:last-child {
    border-bottom: 0;
  }

  .story-media {
    height: 310px;
  }

  .chain-item {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .capability-card {
    min-height: 0;
  }

  .gallery-track {
    animation-duration: 36s;
  }
}
</style>
