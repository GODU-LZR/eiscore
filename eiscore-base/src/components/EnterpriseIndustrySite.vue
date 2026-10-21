<template>
  <div class="industry-site" :style="{ '--green': resolvedThemeColor }">
    <a class="skip-link" href="#site-main">跳至主要内容</a>
    <header class="ink-header">
      <a class="ink-brand" href="#overview" :aria-label="`${profile.displayName}首页`" @click="menuOpen = false">
        <img v-if="profile.logoUrl" :src="profile.logoUrl" alt="" aria-hidden="true" width="44" height="44" />
        <strong>{{ profile.displayName }}</strong>
      </a>
      <nav class="ink-nav" :class="{ 'is-open': menuOpen }" aria-label="网站导航" id="industry-navigation">
        <a v-for="item in branding.navItems" :key="item.anchor" :href="`#${item.anchor}`" @click="menuOpen = false">{{ item.label }}</a>
      </nav>
      <div class="ink-header-actions">
        <button type="button" class="ink-login" @click="$emit('login')">{{ branding.headerLoginText }}<ArrowRight aria-hidden="true" /></button>
        <button type="button" class="menu-button" :aria-expanded="menuOpen" aria-controls="industry-navigation" :aria-label="menuOpen ? '关闭导航' : '打开导航'" @click="menuOpen = !menuOpen">
          <Close v-if="menuOpen" aria-hidden="true" /><Menu v-else aria-hidden="true" />
        </button>
      </div>
    </header>

    <main id="site-main">
      <section class="ink-hero" id="overview" aria-labelledby="brand-title">
        <img class="hero-landscape" :src="branding.backgroundImage" alt="" width="2048" height="1152" fetchpriority="high" />
        <div class="hero-copy">
          <p class="eyebrow"><span class="ink-dot" />{{ portal.loginBranding.siteTag }}</p>
          <h1 id="brand-title">
            <span class="hero-brand-lockup">
              <img v-if="profile.logoUrl" class="site-logo-mark" :src="profile.logoUrl" alt="" aria-hidden="true" width="104" height="104" />
              <span>{{ profile.displayName }}</span>
            </span>
          </h1>
          <h2>{{ branding.slogan }}</h2>
          <p class="hero-summary">{{ branding.description }}</p>
          <div class="hero-actions">
            <a class="solid-button" href="#solutions">探索业务服务<ArrowRight aria-hidden="true" /></a>
            <button class="quiet-button" type="button" @click="openRequest()">洽谈合作<ArrowRight aria-hidden="true" /></button>
          </div>
        </div>
        <div class="hero-foot">
          <div class="hero-directions"><span v-for="item in branding.trustBadges" :key="item.label">{{ item.label }}</span></div>
          <a class="explore-link" href="#capabilities">{{ branding.scrollCueText }}<ArrowDown aria-hidden="true" /></a>
        </div>
      </section>

      <section class="ink-section capabilities-section" id="capabilities" aria-labelledby="capabilities-title">
        <div class="section-heading horizontal-heading">
          <div><p class="eyebrow">{{ branding.metricsSectionKicker }}</p><h2 id="capabilities-title">{{ branding.metricsSectionTitle }}</h2></div>
          <button class="text-button" type="button" @click="overviewDialog.showModal()">查看业务全景<ArrowUpRight aria-hidden="true" /></button>
        </div>
        <div class="capability-columns">
          <article v-for="(item, index) in branding.capabilities" :key="item.title">
            <component :is="capabilityIcons[index % capabilityIcons.length]" class="capability-icon" aria-hidden="true" />
            <h3>{{ item.title }}</h3><p>{{ item.description }}</p>
          </article>
        </div>
      </section>

      <section class="products-section" id="products" aria-labelledby="products-title">
        <div class="ink-section product-layout">
          <div class="product-copy">
            <p class="eyebrow">{{ portal.productSectionKicker }}</p>
            <h2 id="products-title">{{ portal.productSectionTitle }}</h2>
            <div class="product-accordion">
              <details v-for="(product, index) in portal.products" :key="product.id" :open="index === 0" name="industry-products">
                <summary><span><small>{{ product.category }}</small>{{ product.name }}</span><Plus aria-hidden="true" /></summary>
                <p>{{ product.summary }}</p>
                <div class="product-tags"><span v-for="application in product.applications" :key="application">{{ application }}</span></div>
              </details>
            </div>
          </div>
          <div class="platform-art" aria-label="企业应用服务流程示意">
            <div class="platform-topline"><span class="ink-dot" /><span>{{ portal.products[0]?.category }}</span><span class="platform-label">应用服务示意</span></div>
            <div class="platform-center"><div class="platform-emblem"><Cpu aria-hidden="true" /></div><h3>{{ portal.products[0]?.name }}</h3><p>{{ portal.products[0]?.applications.slice(3).join(' · ') }}</p></div>
            <div class="platform-flow">
              <div v-for="(step, index) in portal.products[0]?.applications.slice(0, 3)" :key="step"><span class="flow-icon"><component :is="flowIcons[index]" aria-hidden="true" /></span><strong>{{ step }}</strong><ArrowRight v-if="index < 2" class="flow-arrow" aria-hidden="true" /></div>
            </div>
            <div class="platform-bottom"><Connection aria-hidden="true" /><span>{{ portal.products[1]?.name }}</span><span>{{ portal.products[2]?.category }}</span></div>
          </div>
        </div>
      </section>

      <section class="ink-section solutions-section" id="solutions" aria-labelledby="solutions-title">
        <div class="section-heading horizontal-heading"><div><p class="eyebrow">{{ portal.solutionSectionKicker }}</p><h2 id="solutions-title">{{ portal.solutionSectionTitle }}</h2></div><p class="section-note">选择一个方向，了解服务内容与合作方式。</p></div>
        <div class="solution-grid">
          <article v-for="(service, index) in portal.solutions" :key="service.id" class="solution-item">
            <div class="solution-category"><component :is="solutionIcons[index % solutionIcons.length]" aria-hidden="true" /><span>{{ service.category }}</span></div>
            <h3>{{ service.name }}</h3><p>{{ service.summary }}</p>
            <button class="text-button" type="button" :aria-label="`了解${service.name}`" @click="openDetail(service)">了解服务<ArrowUpRight aria-hidden="true" /></button>
          </article>
        </div>
      </section>

      <section class="industry-feature" id="industry" aria-labelledby="industry-title">
        <figure class="industry-picture"><img :src="branding.overviewFactoryImage" :alt="branding.overviewFactoryImageAlt" loading="lazy" width="1536" height="1024" /><figcaption>产业服务场景概念图</figcaption></figure>
        <div class="industry-copy"><p class="eyebrow">{{ branding.aboutSectionKicker }}</p><h2 id="industry-title">{{ branding.capabilitiesSectionTitle }}</h2><p>{{ parkService?.summary }}</p><ul><li v-for="item in parkService?.applications" :key="item"><Check aria-hidden="true" />{{ item }}</li></ul><button class="text-button" type="button" @click="openDetail(parkService)">了解园区合作方案<ArrowUpRight aria-hidden="true" /></button></div>
      </section>

      <section class="ink-section collaboration-section" id="cooperation" aria-labelledby="cooperation-title">
        <div class="section-heading"><p class="eyebrow">合作方式</p><h2 id="cooperation-title">{{ branding.capabilitiesSectionKicker }}</h2></div>
        <ol class="collaboration-steps"><li v-for="(step, index) in branding.businessChain" :key="step.title"><span class="step-number">{{ String(index + 1).padStart(2, '0') }}</span><h3>{{ step.title }}</h3><p>{{ step.description }}</p></li></ol>
      </section>

      <section class="about-section" id="about" aria-labelledby="about-title">
        <div class="ink-section about-layout"><div><p class="eyebrow">关于 {{ profile.displayName }}</p><h2 id="about-title">{{ branding.slogan }}</h2></div><div><p class="about-description">{{ branding.description }}</p><p class="about-principle">{{ branding.footerText }}</p><button class="text-button" type="button" @click="overviewDialog.showModal()">查看完整业务版图<ArrowUpRight aria-hidden="true" /></button></div></div>
      </section>

      <section class="contact-section" id="contact" aria-labelledby="contact-title">
        <div class="ink-section contact-layout"><div><p class="eyebrow">联系合作</p><h2 id="contact-title">从你的需求，开始下一步。</h2><p>告诉我们你的业务场景、希望解决的问题与合作方向。</p><div v-if="profile.contact.email || profile.contact.phone" class="contact-channels"><a v-if="profile.contact.email" :href="`mailto:${encodeURIComponent(profile.contact.email)}`">{{ profile.contact.email }}</a><a v-if="profile.contact.phone" :href="`tel:${profile.contact.phone.replace(/[^+\d]/g, '')}`">{{ profile.contact.phone }}</a></div></div><button class="solid-button" type="button" @click="openRequest()">整理合作需求<ArrowUpRight aria-hidden="true" /></button></div>
      </section>
    </main>

    <footer class="ink-footer"><a href="#overview">{{ profile.displayName }}</a><span>{{ branding.footerText }}</span><a href="#overview">返回顶部<ArrowUp aria-hidden="true" /></a></footer>

    <dialog ref="detailDialog" class="ink-dialog service-dialog" aria-labelledby="service-dialog-title" @click="closeBackdrop" @close="selectedService = null">
      <template v-if="selectedService"><button class="dialog-close" type="button" aria-label="关闭服务介绍" @click="detailDialog.close()"><Close aria-hidden="true" /></button><p class="eyebrow">{{ selectedService.category }}</p><h2 id="service-dialog-title">{{ selectedService.name }}</h2><p class="dialog-intro">{{ selectedService.summary }}</p><h3>服务方向</h3><ul class="service-directions"><li v-for="item in selectedService.applications" :key="item"><Check aria-hidden="true" />{{ item }}</li></ul><h3>如何开展合作</h3><p>结合实际需求，确认服务范围、项目阶段与交付内容，再开展方案沟通与场景试点。</p><button class="solid-button" type="button" @click="requestFromService">整理这项合作需求<ArrowRight aria-hidden="true" /></button></template>
    </dialog>

    <dialog ref="overviewDialog" class="ink-dialog overview-dialog" aria-labelledby="overview-dialog-title" @click="closeBackdrop"><header><h2 id="overview-dialog-title">{{ profile.displayName }}业务全景</h2><button class="dialog-close" type="button" aria-label="关闭业务全景" @click="overviewDialog.close()"><Close aria-hidden="true" /></button></header><img v-if="branding.aboutImage" :src="branding.aboutImage" :alt="branding.aboutImageAlt" width="1672" height="941" /></dialog>

    <dialog ref="requestDialog" class="ink-dialog request-dialog" aria-labelledby="request-dialog-title" @click="closeBackdrop">
      <button class="dialog-close" type="button" aria-label="关闭合作需求" @click="requestDialog.close()"><Close aria-hidden="true" /></button><p class="eyebrow">合作沟通</p><h2 id="request-dialog-title">整理一份合作需求</h2><p class="dialog-intro">填写后可复制或保存合作说明，用于与团队进一步沟通。</p>
      <form v-if="!preparedRequest" @submit.prevent="prepareRequest"><label>合作方向<select v-model="request.direction" required><option value="" disabled>请选择业务方向</option><option v-for="service in portal.solutions" :key="service.id" :value="service.name">{{ service.name }}</option></select></label><label>企业或机构名称 <small>选填</small><input v-model.trim="request.company" autocomplete="organization" maxlength="120" placeholder="你的企业或机构" /></label><label>希望解决什么问题？<textarea v-model.trim="request.brief" rows="4" maxlength="2400" required placeholder="介绍当前场景、合作目标与计划时间" /></label><button class="solid-button" type="submit">生成合作说明<ArrowRight aria-hidden="true" /></button></form>
      <div v-else class="prepared-request"><label for="prepared-request">合作说明</label><textarea id="prepared-request" :value="preparedRequest" rows="8" readonly /><div class="request-actions"><button class="solid-button" type="button" @click="copyRequest">复制说明<DocumentCopy aria-hidden="true" /></button><button class="outline-button" type="button" @click="downloadRequest">保存说明<Download aria-hidden="true" /></button><button class="text-button" type="button" @click="preparedRequest = ''; copyStatus = ''">返回修改</button></div><p class="copy-status" role="status">{{ copyStatus }}</p></div>
    </dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣
import { computed, nextTick, reactive, ref } from 'vue'
import { ArrowRight, ArrowDown, ArrowUp, TopRight as ArrowUpRight, Close, Menu, Plus, Cpu, Connection, OfficeBuilding, Document, CircleCheck, Monitor, Box, VideoCamera, Share, Check, DocumentCopy, Download } from '@element-plus/icons-vue'

const props = defineProps({
  profile: { type: Object, required: true },
  branding: { type: Object, required: true },
  themeColor: { type: String, default: '' }
})
defineEmits(['login'])
const resolvedThemeColor = computed(() => {
  const candidates = [props.themeColor, props.profile.themeColor]
  return candidates.find((value) => /^#[0-9a-f]{6}$/i.test(String(value || '').trim())) || '#285d57'
})
const portal = computed(() => props.profile.portal)
const parkService = computed(() => portal.value.solutions.find(service => service.id === 'park') || portal.value.solutions[0])
const capabilityIcons = [Cpu, Connection, OfficeBuilding]
const flowIcons = [Document, Connection, CircleCheck]
const solutionIcons = [Monitor, OfficeBuilding, Box, Cpu, VideoCamera, Share]
const menuOpen = ref(false)
const detailDialog = ref(null)
const overviewDialog = ref(null)
const requestDialog = ref(null)
const selectedService = ref(null)
const request = reactive({ direction: '', company: '', brief: '' })
const preparedRequest = ref('')
const copyStatus = ref('')

const closeBackdrop = (event) => { if (event.target === event.currentTarget) event.currentTarget.close() }
async function openDetail(service) {
  if (!service) return
  selectedService.value = service
  await nextTick()
  detailDialog.value.showModal()
}
function openRequest(direction = '') {
  if (direction) request.direction = direction
  preparedRequest.value = ''
  copyStatus.value = ''
  menuOpen.value = false
  requestDialog.value.showModal()
}
function requestFromService() {
  const direction = selectedService.value.name
  detailDialog.value.close()
  openRequest(direction)
}
function prepareRequest() {
  if (!request.direction || !request.brief.trim()) return
  preparedRequest.value = [`${props.profile.displayName} · 合作需求`, `合作方向：${request.direction}`, ...(request.company ? [`企业或机构：${request.company}`] : []), '', '需求说明：', request.brief.trim()].join('\n')
}
async function copyRequest() {
  try {
    await navigator.clipboard.writeText(preparedRequest.value)
    copyStatus.value = '合作说明已复制，可粘贴给项目联系人。'
  } catch {
    document.getElementById('prepared-request')?.select()
    copyStatus.value = '请复制已选中的合作说明，或选择保存说明。'
  }
}
function downloadRequest() {
  const url = URL.createObjectURL(new Blob([preparedRequest.value], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.profile.shortName.replace(/[\\/:*?"<>|]/g, '')}-合作需求.txt`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  copyStatus.value = '已生成合作说明文件。'
}
</script>

<style scoped>
.industry-site{--ink:#222b28;--green:#285d57;--muted:#69716c;--paper:#f7f5ef;--line:#dcded5;background:var(--paper);color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;font-size:15px;line-height:1.8;overflow-x:clip;-webkit-font-smoothing:antialiased}
.industry-site *{box-sizing:border-box}
.industry-site a{color:inherit;text-decoration:none}
.industry-site button,.industry-site input,.industry-site textarea,.industry-site select{font:inherit}
.industry-site button{cursor:pointer}
.industry-site button,.industry-site a{-webkit-tap-highlight-color:transparent}
.industry-site svg{width:20px;height:20px;flex:none}
.industry-site p,.industry-site h1,.industry-site h2,.industry-site h3,.industry-site figure{margin:0}
.industry-site h2,.industry-site h3{font-family:"Noto Serif SC","Source Han Serif SC","Songti SC",SimSun,serif;font-weight:600}
.industry-site :focus-visible{outline:2px solid var(--green);outline-offset:5px}
.industry-site section[id]{scroll-margin-top:104px}
.skip-link{position:fixed;left:20px;top:-80px;z-index:90;background:var(--green);padding:10px 20px;color:white!important}.skip-link:focus{top:10px}
.ink-header{height:84px;padding:0 max(5.55vw,24px);display:flex;align-items:center;justify-content:space-between;gap:32px;border-bottom:1px solid #273d3220;background:#f7f5eff5;position:sticky;top:0;z-index:40}
.ink-brand{display:flex;align-items:center;flex:none;gap:10px}.ink-brand img{display:block;width:44px;height:44px;object-fit:contain}.ink-brand strong{font-family:SimSun,serif;font-size:21px;font-weight:600;color:var(--ink);white-space:nowrap}
.ink-nav{display:flex;gap:34px;margin-left:auto}.ink-nav a{font-size:14px;white-space:nowrap;transition:color .2s}.ink-nav a:hover{color:var(--green)}
.ink-header-actions{display:flex;gap:18px;align-items:center}.ink-login{background:none;border:0;border-left:1px solid #cfd3c9;padding:2px 0 2px 28px;display:flex;align-items:center;gap:16px;white-space:nowrap;font-size:14px!important;color:var(--green)}.ink-login svg{width:17px}.menu-button{display:none}
.ink-hero{position:relative;min-height:690px;min-height:min(800px,calc(100svh - 84px));isolation:isolate;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
.hero-landscape{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:-2}
.ink-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#f7f5ef65,transparent 70%);z-index:-1;pointer-events:none}
.hero-copy{padding:70px max(5.55vw,24px) 48px;max-width:820px}.eyebrow{font-size:12px;letter-spacing:.17em;color:var(--green);font-weight:600;display:flex;align-items:center;gap:11px;line-height:1.6}
.ink-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#a24233;flex:none}
.hero-copy h1{margin:26px 0 28px;line-height:1}.hero-copy h1 img{display:block;width:min(490px,100%);height:auto}.hero-copy h1>span:not(.hero-brand-lockup){font-family:SimSun,serif;font-size:72px}.hero-brand-lockup{display:flex;align-items:center;gap:20px;font-family:SimSun,serif;font-size:60px;font-weight:600;line-height:1.25;white-space:nowrap}.hero-copy h1 .site-logo-mark{width:104px;height:104px;object-fit:contain;flex:none}
.hero-copy h2{font-size:35px;font-weight:500;letter-spacing:.035em;line-height:1.5}.hero-summary{font-size:15px;line-height:2.05;max-width:440px;margin-top:18px!important;color:#4e5c54}
.hero-actions{display:flex;align-items:center;gap:28px;margin-top:32px}
.solid-button,.quiet-button,.outline-button{display:inline-flex;align-items:center;justify-content:center;gap:23px;min-height:48px;padding:12px 23px;line-height:1.5;white-space:nowrap;font-size:13px!important;letter-spacing:.035em;transition:background .2s,color .2s,transform .2s;border:1px solid transparent}
.solid-button{background:var(--green);color:#fff!important;border-color:var(--green)}.solid-button:hover{background:color-mix(in srgb,var(--green) 84%,#000);transform:translateY(-2px)}.solid-button svg,.quiet-button svg,.outline-button svg{width:17px;height:17px}
.quiet-button{padding:10px 0;border:0;background:none;color:var(--ink)}.quiet-button:hover{color:var(--green)}.outline-button{border-color:#ccd3c8;background:transparent;color:var(--green)}
.hero-foot{display:flex;justify-content:space-between;align-items:center;padding:25px max(5.55vw,24px);border-top:1px solid #263d3324;background:#f7f5ef55;gap:20px}
.hero-directions{display:flex;gap:0;font-size:12px;letter-spacing:.1em}.hero-directions span+span::before{content:"/";color:#8b9488;margin:0 25px}.explore-link{display:flex;gap:20px;align-items:center;font-size:12px}.explore-link svg{width:16px}
.ink-section{max-width:1440px;margin-inline:auto;padding:90px max(5.55vw,24px)}
.section-heading{margin-bottom:42px}.section-heading h2,.product-copy>h2,.industry-copy h2,.about-layout h2,.contact-layout h2{font-size:34px;line-height:1.5;letter-spacing:.015em;margin-top:13px;font-weight:500}.horizontal-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:30px}.section-note{max-width:280px;font-size:13px;color:var(--muted)}
.text-button{display:inline-flex;align-items:center;gap:17px;background:none;padding:0 0 5px;border:0;color:var(--green);font-size:13px!important;line-height:1.7;text-align:left}.text-button svg{width:16px;height:16px}.text-button:hover{color:#a24233}
.capabilities-section{padding-top:76px;padding-bottom:76px}.capability-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:42px}.capability-columns article{position:relative;padding:8px 38px 5px 0}.capability-columns article+article{padding-left:40px;border-left:1px solid var(--line)}.capability-icon{width:28px!important;height:28px!important;color:var(--green);margin-bottom:18px}.capability-columns h3{font-size:23px;margin-bottom:12px}.capability-columns p{font-size:14px;line-height:1.95;color:var(--muted);max-width:330px}
.products-section{background:#edf0e9;border-top:1px solid #dce1d8;border-bottom:1px solid #dce1d8}.product-layout{display:grid;grid-template-columns:1fr 1fr;gap:90px;align-items:center}.product-accordion{margin-top:32px}.product-accordion details{border-top:1px solid #ccd4c7;padding:20px 0}.product-accordion details:last-child{border-bottom:1px solid #ccd4c7}.product-accordion summary{display:flex;justify-content:space-between;align-items:center;gap:18px;cursor:pointer;list-style:none;color:var(--ink);font-family:SimSun,serif;font-size:20px}.product-accordion summary::-webkit-details-marker{display:none}.product-accordion summary small{display:block;font:11px/1.8 "Microsoft YaHei",sans-serif;color:var(--muted);margin-bottom:4px}.product-accordion details[open] summary svg{transform:rotate(45deg)}.product-accordion details>p{margin-top:15px;color:#626e63;font-size:13px;line-height:2}.product-tags{display:flex;flex-wrap:wrap;gap:7px 13px;margin-top:16px;font-size:11px;color:var(--green)}.product-tags span{border:1px solid #c8d3c6;padding:2px 9px;background:#f8faf650}
.platform-art{border:1px solid #c4cec0;box-shadow:15px 18px 0 #dfe5d9;background:#f7f8f3;border-radius:4px;overflow:hidden;color:#263f35}.platform-topline{padding:18px 23px;border-bottom:1px solid #d6ddd1;display:flex;align-items:center;gap:10px;font-size:11px}.platform-topline .ink-dot{background:#6e917a}.platform-label{margin-left:auto;color:#7a8776;font-size:10px}.platform-center{text-align:center;padding:36px 20px 29px;background:radial-gradient(ellipse at 50% 60%,#dce8d5,transparent 65%)}.platform-emblem{width:70px;height:70px;margin:0 auto 16px;display:grid;place-items:center;border:1px solid #b4c6ad;background:#eef3e6;box-shadow:0 0 0 11px #eef3e675;border-radius:15px}.platform-emblem svg{width:34px;height:34px}.platform-center h3{font:500 23px/1.8 SimSun,serif}.platform-center p{font-size:11px;color:#71806b;margin-top:5px}
.platform-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:15px 25px 32px}.platform-flow>div{border:1px solid #d2dccb;background:#fff9;text-align:center;position:relative;padding:18px 5px 14px;border-radius:3px}.flow-icon{display:block;margin-bottom:8px;color:#587250}.platform-flow strong{font-weight:500;font-size:12px}.flow-arrow{position:absolute;right:-19px;top:39%;color:#85977d;width:17px!important}.platform-bottom{padding:17px 23px;border-top:1px solid #d6ddd1;font-size:10px;display:flex;gap:10px;align-items:center}.platform-bottom>span:last-child{margin-left:auto;color:#7a8776}.platform-bottom svg{width:16px}
.solution-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:38px;row-gap:42px}.solution-item{border-top:1px solid #bcc9bc;padding:25px 0 10px;display:flex;flex-direction:column;align-items:flex-start;transition:border-color .2s}.solution-item:hover{border-top-color:var(--green)}.solution-category{display:flex;align-items:center;gap:10px;font-size:11px;color:#748271;margin-bottom:15px}.solution-category svg{width:18px;height:18px;color:var(--green)}.solution-item h3{font-size:21px;font-weight:500;margin-bottom:15px;line-height:1.6}.solution-item>p{font-size:13px;color:#71796e;line-height:2;margin-bottom:23px}.solution-item .text-button{margin-top:auto}
.industry-feature{display:grid;grid-template-columns:1.1fr 1fr;max-width:1440px;margin:0 auto;background:#e8ede4}.industry-picture{position:relative;min-height:510px;overflow:hidden}.industry-picture img{display:block;width:100%;height:100%;position:absolute;object-fit:cover}.industry-picture figcaption{position:absolute;bottom:17px;left:22px;background:#f8f5e7ba;padding:2px 8px;font-size:10px;color:#48604c}.industry-copy{padding:64px 14% 60px 12%;align-self:center}.industry-copy h2{font-size:31px;max-width:330px}.industry-copy>p:not(.eyebrow){font-size:13px;margin-top:22px;line-height:2;color:#687663}.industry-copy ul{list-style:none;margin:24px 0 30px;padding:0}.industry-copy li{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:12px;color:#4a604c}.industry-copy li svg{width:14px;height:14px}
.collaboration-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));list-style:none;margin:0;padding:0;gap:30px}.collaboration-steps li{border-top:1px solid var(--line);padding-top:16px}.step-number{font-family:Georgia,serif;font-size:15px;color:#90a08a}.collaboration-steps h3{font-size:20px;font-weight:500;margin:19px 0 12px}.collaboration-steps p{font-size:12px;color:#778171;line-height:1.95}
.about-section{border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.about-layout{display:grid;grid-template-columns:1fr 1fr;gap:90px;padding-top:67px;padding-bottom:67px}.about-layout h2{max-width:360px;font-size:33px}.about-description{font-size:14px;color:#66705f;line-height:2}.about-principle{font-size:12px;margin:17px 0 25px!important;color:var(--green)}
.contact-section{background:var(--green);color:#f7f5ef}.contact-layout{display:flex;justify-content:space-between;align-items:center;gap:30px;padding-top:60px;padding-bottom:60px}.contact-layout .eyebrow{color:#bfd0b9}.contact-layout h2{font-size:34px;font-weight:400;margin-top:8px}.contact-layout p:not(.eyebrow){font-size:12px;color:#c8d4c4;margin-top:13px}.contact-layout>.solid-button{background:#f0f0e4;color:var(--green)!important;border-color:#f0f0e4}.contact-layout>.solid-button:hover{background:white}.contact-channels{display:flex;gap:20px;margin-top:16px}.ink-footer{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:26px max(5.55vw,24px);font-size:10px;color:#75806e}.ink-footer>a:first-child{font-family:SimSun,serif;font-size:18px;color:var(--ink)}.ink-footer>a:last-child{display:flex;gap:12px;align-items:center}.ink-footer svg{width:14px;height:14px}
.ink-dialog{border:1px solid #d8ddce;border-radius:3px;color:var(--ink);background:var(--paper);padding:44px;width:min(640px,calc(100vw - 32px));max-height:calc(100dvh - 48px);overflow:auto;box-shadow:0 25px 100px #102d2140;line-height:1.9}.ink-dialog::backdrop{background:#182b2580;backdrop-filter:blur(5px)}.ink-dialog h2{font-size:28px;line-height:1.55;max-width:90%;margin:14px 0 20px}.ink-dialog h3{font-size:17px;margin:28px 0 12px}.ink-dialog p{color:#677160;font-size:14px}.dialog-close{position:absolute;top:17px;right:18px;background:none;border:0;color:var(--green);padding:7px;line-height:1}.dialog-intro{margin-bottom:25px!important}.service-directions{list-style:none;padding:0;margin:0}.service-directions li{padding:10px 0;border-bottom:1px solid #dde1d4;display:flex;align-items:center;gap:12px;font-size:14px}.service-directions svg{width:15px;height:15px;color:var(--green)}.service-dialog>.solid-button{margin-top:30px}.overview-dialog{width:min(1200px,calc(100vw - 24px));padding:20px}.overview-dialog header{padding:0 15px}.overview-dialog h2{font-size:20px;margin:0 40px 20px 0}.overview-dialog>img{width:100%;height:auto;display:block}.request-dialog label,.prepared-request>label{display:block;font-size:13px;font-weight:500;margin-bottom:20px}.request-dialog label small{color:#8b9286;font-weight:400;font-size:11px;margin-left:7px}.request-dialog input,.request-dialog select,.request-dialog textarea{display:block;width:100%;margin-top:8px;border:1px solid #ccd4c4;border-radius:2px;background:#fff9;color:var(--ink);padding:11px 13px;resize:vertical;font-size:14px!important;line-height:1.7}.request-dialog select{min-height:48px}.request-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}.request-actions .solid-button,.request-actions .outline-button{gap:12px;padding:10px 18px;min-height:42px}.copy-status{font-size:12px!important;margin-top:15px!important}
:global(body:has(.ink-dialog[open])){overflow:hidden}
@media(min-width:1600px){.ink-section{padding-inline:80px}.hero-copy{padding-top:96px}.ink-hero{min-height:800px}}
@media(max-width:1100px){.ink-header{gap:20px}.ink-nav{gap:22px}.product-layout{gap:45px}.industry-copy{padding:44px 10%}.solution-grid{column-gap:28px}.solution-item h3{font-size:19px}.capability-columns{gap:25px}.capability-columns article{padding-right:12px}.capability-columns article+article{padding-left:25px}.collaboration-steps{gap:20px}.about-layout{gap:50px}}
@media(max-width:800px){.ink-header{height:72px;padding:0 24px;gap:18px}.ink-brand img{width:40px;height:40px}.ink-header-actions{margin-left:auto}.ink-login{border:0;padding:0;gap:9px;font-size:12px!important}.ink-login svg{width:14px}.menu-button{display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--green);width:30px;height:38px}.menu-button svg{width:23px;height:23px}.ink-nav{display:none;position:absolute;inset:72px 0 auto;background:#f7f5ef;border-bottom:1px solid var(--line);padding:18px 24px 24px;box-shadow:0 16px 20px #263d330a}.ink-nav.is-open{display:flex;flex-direction:column;gap:0}.ink-nav a{padding:12px 0;border-bottom:1px solid #e5e6dc}.ink-hero{min-height:720px}.hero-copy{padding-top:68px}.hero-landscape{object-position:57% center}.hero-copy h1 img{width:430px}.hero-copy h1 .site-logo-mark{width:84px;height:84px}.hero-brand-lockup{font-size:45px;gap:16px}.hero-copy h2{font-size:31px}.hero-summary{max-width:390px}.hero-copy{max-width:580px}.ink-hero::after{background:linear-gradient(90deg,#f7f5efb8,transparent)}.ink-section{padding:64px 30px}.section-heading h2,.product-copy>h2{font-size:29px}.capability-columns{gap:22px}.capability-columns article+article{padding-left:22px}.capability-columns h3{font-size:21px}.capability-columns p{font-size:12px}.product-layout{grid-template-columns:1fr;gap:48px}.product-copy{max-width:none}.platform-art{max-width:560px;width:100%;margin:auto}.solution-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:35px}.industry-feature{grid-template-columns:1fr 1fr}.industry-picture{min-height:500px}.industry-copy{padding:45px 28px}.industry-copy h2{font-size:27px}.collaboration-steps{grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}.about-layout{gap:30px}.about-layout h2{font-size:29px}.contact-layout h2{font-size:28px}.contact-layout{padding-top:50px;padding-bottom:50px}.ink-footer{padding-inline:30px;flex-wrap:wrap}.ink-footer>span{order:3;width:100%;margin-top:-7px}.ink-footer>a:last-child{margin-left:auto}}
@media(max-width:520px){.industry-site{font-size:14px}.ink-header{padding:0 20px;height:68px}.ink-brand img{width:36px;height:36px}.ink-brand strong{font-size:18px}.ink-nav{top:68px}.ink-header-actions{gap:15px}.ink-header svg{width:18px;height:18px}.ink-login svg{display:none}.ink-hero{min-height:690px;min-height:calc(100svh - 68px);max-height:860px}.hero-landscape{object-position:61% center;opacity:.88}.ink-hero::after{background:linear-gradient(180deg,#f7f5efbb 0%,#f7f5ef5c 48%,transparent 80%)}.hero-copy{padding:56px 24px 86px;max-width:none}.hero-copy .eyebrow{font-size:11px;letter-spacing:.16em}.hero-copy h1{margin:32px 0 24px}.hero-copy h1 img{width:100%;max-width:355px}.hero-copy h1 .site-logo-mark{width:68px;height:68px}.hero-brand-lockup{font-size:34px;gap:13px}.hero-copy h2{font-size:25px;letter-spacing:0;line-height:1.6}.hero-summary{font-size:13px;line-height:2.1;max-width:310px;margin-top:20px!important;color:#485c50}.hero-actions{gap:23px;margin-top:28px}.solid-button,.quiet-button,.outline-button{font-size:12px!important;gap:15px;padding:12px 18px;min-height:46px}.quiet-button{padding-inline:0}.hero-foot{padding:19px 24px;background:#f7f5ef96}.hero-directions{font-size:10px;letter-spacing:0}.hero-directions span+span::before{margin:0 11px}.explore-link{font-size:10px;gap:7px}.explore-link svg{width:12px}.ink-section{padding:54px 24px}.section-heading{margin-bottom:30px}.section-heading h2,.product-copy>h2{font-size:26px}.horizontal-heading{align-items:flex-start;flex-direction:column;gap:18px}.eyebrow{font-size:11px}.text-button{font-size:12px!important}.capability-columns{grid-template-columns:1fr;gap:0}.capability-columns article,.capability-columns article+article{padding:25px 0 25px 51px;border-left:0;border-top:1px solid var(--line)}.capability-icon{position:absolute;left:0;top:30px;width:25px!important;height:25px!important}.capability-columns h3{font-size:21px;margin-bottom:9px}.capability-columns p{font-size:13px;max-width:none}.capabilities-section{padding-bottom:28px}.product-layout{gap:35px}.product-accordion{margin-top:25px}.product-accordion summary{font-size:19px}.platform-art{box-shadow:8px 10px 0 #dfe5d9}.platform-topline{padding:15px;font-size:10px}.platform-label{font-size:9px}.platform-center{padding:30px 15px 23px}.platform-center h3{font-size:22px}.platform-flow{padding:12px 15px 25px;gap:15px}.platform-flow>div{padding:15px 2px 12px}.platform-flow strong{font-size:11px}.flow-arrow{right:-16px;width:14px!important}.platform-bottom{padding:14px;font-size:9px;gap:7px}.platform-bottom>span:last-child{max-width:100px;text-align:right}.solution-grid{grid-template-columns:1fr;gap:19px}.solution-item{padding-top:21px;padding-bottom:14px}.solution-category{margin-bottom:10px}.solution-item h3{font-size:21px;margin-bottom:12px}.solution-item>p{font-size:13px;margin-bottom:17px}.section-note{font-size:12px}.industry-feature{grid-template-columns:1fr}.industry-picture{min-height:0;aspect-ratio:1.5}.industry-copy{padding:38px 24px 44px}.industry-copy h2{max-width:310px;font-size:27px}.industry-copy>p:not(.eyebrow){font-size:13px}.industry-copy ul{margin:22px 0 26px}.collaboration-steps{grid-template-columns:1fr;gap:0}.collaboration-steps li{position:relative;padding:20px 0 22px 47px}.step-number{position:absolute;left:0;top:20px;font-size:16px}.collaboration-steps h3{margin:0 0 7px;font-size:21px}.collaboration-steps p{font-size:13px;max-width:300px}.about-layout{grid-template-columns:1fr;gap:22px}.about-layout h2{font-size:27px}.about-description{font-size:13px}.about-principle{font-size:11px}.contact-layout{display:block}.contact-layout h2{font-size:27px}.contact-layout>button{margin-top:26px}.contact-layout p:not(.eyebrow){font-size:12px;max-width:280px}.ink-footer{padding:25px 24px;gap:18px;font-size:10px}.ink-footer>a:first-child{font-size:19px}.ink-dialog{padding:32px 23px;max-height:calc(100dvh - 32px)}.ink-dialog h2{font-size:24px}.ink-dialog p{font-size:13px}.ink-dialog h3{font-size:16px}.overview-dialog{padding:13px}.overview-dialog header{padding:3px 0}.overview-dialog h2{font-size:17px}.overview-dialog>img{min-height:0}.request-actions{gap:10px}.request-actions .text-button{padding-top:6px}.service-directions li{font-size:13px}.contact-channels{flex-direction:column;gap:5px}}
@media(prefers-reduced-motion:reduce){.industry-site *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
