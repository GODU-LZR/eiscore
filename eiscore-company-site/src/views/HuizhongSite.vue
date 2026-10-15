<template>
  <div class="huizhong-site">
    <div class="notice-bar">
      <span>公开资料草稿</span>
      <span>认证信息链接消防产品合格评定中心</span>
      <a href="#certificates">查看证书</a>
    </div>

    <header class="site-header" :class="{ compact: scrolled }">
      <a class="wordmark" href="#top" aria-label="返回惠众消防首页">
        <span class="wordmark-rule" aria-hidden="true"></span>
        <span>
          <strong>惠众消防</strong>
          <small>HUIZHONG FIRE TECHNOLOGY</small>
        </span>
      </a>
      <nav class="desktop-nav" aria-label="页面导航">
        <a href="#products">产品认证</a>
        <a href="#services">技术服务</a>
        <a href="#certificates">资料核验</a>
        <a href="#contact">联系咨询</a>
      </nav>
      <div class="header-actions">
        <a class="header-cta" href="#certificates">核验产品认证<el-icon><ArrowRight /></el-icon></a>
        <button class="menu-button" type="button" :aria-expanded="mobileOpen" aria-controls="mobile-nav" aria-label="打开页面导航" @click="mobileOpen = !mobileOpen">
          <el-icon><Close v-if="mobileOpen" /><Menu v-else /></el-icon>
        </button>
      </div>
      <nav v-if="mobileOpen" id="mobile-nav" class="mobile-nav" aria-label="移动端页面导航">
        <a href="#products" @click="mobileOpen = false">产品认证</a>
        <a href="#services" @click="mobileOpen = false">技术服务</a>
        <a href="#certificates" @click="mobileOpen = false">资料核验</a>
        <a href="#contact" @click="mobileOpen = false">联系咨询</a>
      </nav>
    </header>

    <main>
      <section id="top" class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow">消防设备与技术服务 / 湛江·霞山</p>
          <h1 id="hero-title">七氟丙烷设备，<br><em>守住关键空间。</em></h1>
          <p class="hero-lead">广东惠众消防科技有限公司面向工业、商业与设备空间，提供气体灭火设备、消防技术服务与安防配套支持。</p>
          <div class="hero-actions">
            <a class="primary-button" href="#products">查看认证产品<el-icon><ArrowRight /></el-icon></a>
            <a class="secondary-button" href="#contact">提交项目需求<el-icon><DocumentChecked /></el-icon></a>
          </div>
          <div class="hero-signals" aria-label="企业信息">
            <span>成立 2021</span><span>注册资本 1000 万元</span><span>统一社会信用代码 91440803MA7FKA8U60</span>
          </div>
        </div>

        <div class="hero-visual" aria-label="柜式七氟丙烷设备结构示意图">
          <div class="visual-grid" aria-hidden="true"></div>
          <div class="cabinet">
            <div class="cabinet-top"></div>
            <div class="cabinet-body">
              <div class="cabinet-label">HFC-227ea</div>
              <div class="cabinet-panel"><span></span><span></span><span></span><b>READY</b></div>
              <div class="cabinet-door-line"></div>
              <div class="cylinder cylinder-a"><i></i></div>
              <div class="cylinder cylinder-b"><i></i></div>
              <div class="cabinet-base"></div>
            </div>
          </div>
          <div class="pipe pipe-one" aria-hidden="true"></div>
          <div class="pipe pipe-two" aria-hidden="true"></div>
          <div class="visual-callout callout-one"><strong>QMQ4.2/70N-HZ</strong><span>主型设备系列</span></div>
          <div class="visual-callout callout-two"><strong>CCCF</strong><span>官方查询可核验</span></div>
          <div class="visual-caption"><span>设备结构示意</span><small>产品实拍待企业授权后替换</small></div>
        </div>
      </section>

      <section class="evidence-band" aria-label="公开核验信息">
        <div><span>01</span><strong>2021.12.22</strong><small>企业成立时间</small></div>
        <div><span>02</span><strong>3 项记录</strong><small>CCCF 公示产品记录</small></div>
        <div><span>03</span><strong>霞山·湛江</strong><small>当前登记地址所在区域</small></div>
        <div><span>04</span><strong>1000 万元</strong><small>登记注册资本</small></div>
      </section>

      <section id="products" class="section products-section">
        <div class="section-heading">
          <div><p class="section-label">01 / CERTIFIED PRODUCTS</p><h2>先看证书，再看型号。</h2></div>
          <p>以下产品信息来自消防产品合格评定中心公开查询页。页面只展示已核验的型号与有效期，不替代企业技术文件。</p>
        </div>
        <div class="product-grid">
          <article v-for="(product, index) in products" :key="product.certificate" class="product-card">
            <div class="product-visual" :class="`tone-${index + 1}`" aria-hidden="true">
              <div class="mini-cylinder"></div><div class="mini-valve"></div><div class="mini-pipe"></div>
              <span class="product-number">0{{ index + 1 }}</span>
            </div>
            <div class="product-content">
              <p class="product-category">{{ product.category }}</p>
              <h3>{{ product.name }}</h3>
              <p>{{ product.description }}</p>
              <dl><div><dt>证书编号</dt><dd>{{ product.certificate }}</dd></div><div><dt>有效期至</dt><dd>{{ product.validUntil }}</dd></div></dl>
              <div class="model-list"><span v-for="model in product.models" :key="model">{{ model }}</span></div>
              <a class="text-link" :href="product.url" target="_blank" rel="noreferrer">打开官方查询页<el-icon><Link /></el-icon></a>
            </div>
          </article>
        </div>
      </section>

      <section id="services" class="services-section">
        <div class="section section-heading services-heading">
          <div><p class="section-label">02 / TECHNICAL SERVICES</p><h2>从设备到项目支持，按边界协同。</h2></div>
          <p>服务方向依据公开登记经营范围整理。工程资质、检测资质和具体项目能力需逐项核验。</p>
        </div>
        <figure class="section industry-reference">
          <img :src="industryReferenceImage" alt="工业设备管线场景示意图，不代表惠众消防项目" loading="lazy">
          <figcaption><span>行业场景示意</span><small>Pexels 图片候选 · 上线前逐项核验作品许可与第三方权利</small></figcaption>
        </figure>
        <div class="section service-grid">
          <article v-for="(service, index) in services" :key="service.title" class="service-item">
            <span class="service-index">0{{ index + 1 }}</span>
            <el-icon class="service-icon"><component :is="service.icon" /></el-icon>
            <h3>{{ service.title }}</h3>
            <p>{{ service.description }}</p>
            <small>{{ service.evidence }}</small>
          </article>
        </div>
      </section>

      <section id="certificates" class="section certificate-section">
        <div class="certificate-copy">
          <p class="section-label">03 / EVIDENCE REGISTER</p>
          <h2>认证记录，<br>回到官方来源。</h2>
          <p>每一条认证信息都保留原始查询入口。证书 PDF 仅作为官方附件链接，证书图像和 CCCF 标识的站内展示需另行取得授权。</p>
          <div class="source-note"><el-icon><CircleCheck /></el-icon><span>来源：消防产品合格评定中心公开查询系统</span></div>
        </div>
        <div class="certificate-list">
          <a v-for="certificate in certificates" :key="certificate.number" class="certificate-row" :href="certificate.url" target="_blank" rel="noreferrer">
            <span class="certificate-kind">{{ certificate.kind }}</span>
            <strong>{{ certificate.number }}</strong>
            <span>{{ certificate.validity }}</span>
            <el-icon><ArrowRight /></el-icon>
          </a>
          <a class="certificate-row certificate-row-muted" href="https://cccf.com.cn:8088/certSearch/" target="_blank" rel="noreferrer"><span class="certificate-kind">查询入口</span><strong>消防产品信息查询系统</strong><span>官方平台</span><el-icon><Link /></el-icon></a>
        </div>
      </section>

      <section id="contact" class="contact-section">
        <div class="section contact-inner">
          <div><p class="section-label">04 / CONTACT</p><h2>按项目条件，进一步沟通。</h2><p>当前公开资料未能核实企业官方电话与邮箱。联系方式确认后，可在此开放项目咨询入口。</p></div>
          <div class="contact-actions"><a class="contact-action contact-action-primary" href="https://www.cccf.com.cn:8088/certSearch/" target="_blank" rel="noreferrer">前往官方认证查询<el-icon><Link /></el-icon></a></div>
          <dl class="contact-facts"><div><dt>企业主体</dt><dd>广东惠众消防科技有限公司</dd></div><div><dt>登记地址 · 上线前核验</dt><dd>湛江市霞山区机场路以西、霞山华港工业小区 2-1-1 号之一</dd></div><div><dt>官方联系渠道</dt><dd>待企业确认</dd></div></dl>
        </div>
      </section>
    </main>

    <footer class="site-footer"><div><strong>广东惠众消防科技有限公司</strong><small>HUIZHONG FIRE TECHNOLOGY · ZHANJIANG</small></div><p>公开资料草稿 · 产品、资质与联系方式上线前请由企业确认</p><a href="#top" title="返回顶部"><el-icon><Top /></el-icon></a></footer>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, CircleCheck, Close, DocumentChecked, Link, Menu, OfficeBuilding, Top, Tools, Warning } from '@element-plus/icons-vue'

const mobileOpen = ref(false)
const scrolled = ref(false)
const industryReferenceImage = 'https://images.pexels.com/photos/257700/pexels-photo-257700.jpeg?auto=compress&cs=tinysrgb&w=1400'
const onScroll = () => { scrolled.value = window.scrollY > 22 }

const products = [
  { category: '气体灭火设备', name: '七氟丙烷灭火设备', description: 'QMQ 系列设备记录，主型及扩展型号均可在官方页面核验。', certificate: 'Z2024081812000084', validUntil: '2029-05-26', models: ['QMQ4.2/70N-HZ', 'QMQ4.2/90N-HZ', 'QMQ4.2/100N-HZ', 'QMQ4.2/120N-HZ', 'QMQ4.2/150N-HZ', 'QMQ4.2/180N-HZ'], url: 'https://www.cccf.com.cn:8088/certSearch/enterCert/Z2024081812000084' },
  { category: '悬挂式气体灭火装置', name: '悬挂式七氟丙烷装置', description: 'XQQW 系列悬挂式装置记录，适用于需要紧凑布置的设备空间。', certificate: 'Z2024081812000083', validUntil: '2029-05-26', models: ['XQQW10/1.6-HZ', 'XQQW20/1.6-HZ', 'XQQW30/1.6-HZ'], url: 'https://www.cccf.com.cn:8088/certSearch/enterCert/Z2024081812000083' },
  { category: '柜式气体灭火装置', name: '柜式七氟丙烷气体灭火装置', description: 'GQQ 系列柜式装置记录，型号覆盖 40 至 150 规格。', certificate: 'Z2022081812000121', validUntil: '2031-06-21', models: ['GQQ40/2.5', 'GQQ70/2.5', 'GQQ90/2.5', 'GQQ120/2.5', 'GQQ150/2.5'], url: 'https://www.cccf.com.cn:8088/certSearch/enterCert/Z2022081812000121' }
]

const services = [
  { title: '消防技术服务', description: '围绕消防设备、空间风险与项目条件开展技术沟通。', evidence: '登记经营范围', icon: Tools },
  { title: '工程设计与施工支持', description: '涉及建设工程设计、施工及对外承包工程等登记方向。', evidence: '许可项目 · 逐项核验', icon: OfficeBuilding },
  { title: '消防器材与安防设备', description: '消防器材、安防设备、防火封堵材料与建筑材料销售。', evidence: '登记经营范围', icon: CircleCheck },
  { title: '检测与系统支持', description: '安全生产检验检测、特种设备检验检测等方向需补充资质文件。', evidence: '许可项目 · 待核验', icon: Warning }
]

const certificates = [
  { kind: '七氟丙烷灭火设备', number: 'Z2024081812000084', validity: '有效至 2029-05-26', url: products[0].url },
  { kind: '悬挂式七氟丙烷装置', number: 'Z2024081812000083', validity: '有效至 2029-05-26', url: products[1].url },
  { kind: '柜式七氟丙烷装置', number: 'Z2022081812000121', validity: '有效至 2031-06-21', url: products[2].url }
]

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap');

.huizhong-site { --ink: #17212b; --paper: #f4f1ea; --white: #fff; --red: #c43b2f; --red-dark: #8f2922; --yellow: #d6a329; --steel: #66727c; --line: #d6d8d5; min-height: 100vh; color: var(--ink); background: var(--paper); font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif; letter-spacing: 0; }
.huizhong-site *, .huizhong-site *::before, .huizhong-site *::after { box-sizing: border-box; }
.huizhong-site a { color: inherit; text-decoration: none; }
.notice-bar { display: flex; justify-content: center; gap: 22px; padding: 8px 20px; color: #fff; background: var(--ink); font: 500 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: .03em; }
.notice-bar a { color: var(--yellow); text-decoration: underline; text-underline-offset: 3px; }
.site-header { position: sticky; z-index: 10; top: 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; min-height: 78px; padding: 0 42px; border-bottom: 1px solid rgba(23,33,43,.16); background: rgba(244,241,234,.92); backdrop-filter: blur(14px); transition: min-height .2s ease, box-shadow .2s ease; }
.site-header.compact { min-height: 64px; box-shadow: 0 8px 22px rgba(23,33,43,.08); }
.wordmark { display: inline-flex; align-items: center; gap: 12px; width: fit-content; }
.wordmark-rule { display: block; width: 22px; height: 22px; border: 6px solid var(--red); border-right-color: var(--yellow); }
.wordmark strong, .wordmark small { display: block; }
.wordmark strong { font-size: 17px; line-height: 1.15; }
.wordmark small { margin-top: 3px; color: var(--steel); font: 600 8px/1.2 'IBM Plex Mono', monospace; letter-spacing: .05em; }
.desktop-nav { display: flex; align-items: center; gap: 28px; }
.desktop-nav a { padding: 8px 0; color: #44515a; font-size: 13px; }
.desktop-nav a:hover { color: var(--red); }
.header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.header-cta, .primary-button, .secondary-button, .contact-action { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 16px; border: 1px solid transparent; font-size: 12px; font-weight: 700; }
.header-cta, .primary-button, .contact-action-primary { color: #fff; background: var(--red); }
.header-cta:hover, .primary-button:hover, .contact-action-primary:hover { background: var(--red-dark); }
.menu-button { display: none; border: 0; background: transparent; color: var(--ink); font-size: 22px; }
.mobile-nav { position: absolute; top: 100%; right: 14px; left: 14px; display: grid; gap: 2px; padding: 10px; border: 1px solid var(--line); background: var(--white); box-shadow: 0 12px 24px rgba(23,33,43,.1); }
.mobile-nav a { padding: 12px; font-size: 13px; }
.hero { display: grid; grid-template-columns: minmax(0, .95fr) minmax(420px, 1.05fr); gap: 50px; align-items: center; min-height: 650px; max-width: 1440px; margin: 0 auto; padding: 76px 66px 92px; overflow: hidden; }
.hero-copy { position: relative; z-index: 1; }
.eyebrow, .section-label { margin: 0 0 18px; color: var(--red); font: 600 11px/1.3 'IBM Plex Mono', monospace; letter-spacing: .08em; }
.hero h1 { max-width: 650px; margin: 0; font-size: 78px; font-weight: 800; line-height: 1.1; letter-spacing: 0; }
.hero h1 em { color: var(--red); font-style: normal; }
.hero-lead { max-width: 610px; margin: 26px 0 0; color: #4f5c63; font-size: 16px; line-height: 1.9; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
.secondary-button { border-color: #aeb6b4; background: transparent; }
.secondary-button:hover { border-color: var(--red); color: var(--red); }
.hero-signals { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 44px; color: var(--steel); font: 500 10px/1.5 'IBM Plex Mono', monospace; }
.hero-signals span { position: relative; padding-left: 12px; }
.hero-signals span::before { position: absolute; top: 6px; left: 0; width: 4px; height: 4px; background: var(--yellow); content: ''; }
.hero-visual { position: relative; min-height: 490px; overflow: hidden; background: #e7e5dd; }
.visual-grid { position: absolute; inset: 0; opacity: .5; background-image: linear-gradient(rgba(102,114,124,.17) 1px, transparent 1px), linear-gradient(90deg, rgba(102,114,124,.17) 1px, transparent 1px); background-size: 30px 30px; }
.hero-visual::after { position: absolute; right: -30%; bottom: -30%; width: 80%; height: 80%; border: 1px solid rgba(196,59,47,.25); border-radius: 50%; content: ''; }
.cabinet { position: absolute; top: 64px; left: 50%; width: 226px; height: 360px; transform: translateX(-50%); }
.cabinet-top { width: 100%; height: 20px; background: #879299; clip-path: polygon(5% 0, 95% 0, 100% 100%, 0 100%); }
.cabinet-body { position: relative; height: 340px; border: 8px solid #727e84; border-top: 0; background: linear-gradient(90deg, #bbc2c2, #eef0ed 50%, #9fa8aa); box-shadow: 18px 22px 0 rgba(23,33,43,.12), 0 30px 45px rgba(23,33,43,.18); }
.cabinet-label { position: absolute; top: 17px; left: 17px; color: #3e4b51; font: 600 10px 'IBM Plex Mono', monospace; letter-spacing: .06em; }
.cabinet-panel { position: absolute; top: 16px; right: 15px; display: grid; grid-template-columns: repeat(3, 7px); gap: 3px; align-items: center; width: 54px; padding: 6px; border: 1px solid #66727c; background: #d8dcd8; }
.cabinet-panel span { width: 7px; height: 7px; border-radius: 50%; background: var(--red); }.cabinet-panel span:nth-child(2) { background: var(--yellow); }.cabinet-panel span:nth-child(3) { background: #56826a; }.cabinet-panel b { grid-column: 1 / -1; margin-top: 3px; color: #3c4b4d; font: 600 6px 'IBM Plex Mono', monospace; }
.cabinet-door-line { position: absolute; top: 86px; right: 15px; bottom: 25px; width: 1px; background: #7c878a; }
.cylinder { position: absolute; bottom: 33px; width: 68px; height: 190px; border-radius: 30px 30px 9px 9px; background: linear-gradient(90deg, #7c888b, #d9dddd 48%, #7c888b); box-shadow: inset 0 -12px 18px rgba(23,33,43,.18); }
.cylinder::before { position: absolute; top: -9px; left: 18px; width: 32px; height: 20px; border-radius: 5px 5px 1px 1px; background: #667278; content: ''; }.cylinder i { position: absolute; top: 39px; left: 15px; width: 38px; height: 72px; border: 2px solid rgba(23,33,43,.35); border-radius: 4px; }.cylinder-a { left: 27px; }.cylinder-b { left: 107px; }
.cabinet-base { position: absolute; right: 10px; bottom: 11px; left: 10px; height: 9px; background: #667278; }
.pipe { position: absolute; z-index: 2; width: 112px; height: 2px; background: var(--red); transform-origin: left center; }.pipe-one { top: 125px; left: 63%; transform: rotate(-23deg); }.pipe-two { right: 12%; bottom: 135px; width: 88px; transform: rotate(145deg); }
.visual-callout { position: absolute; z-index: 3; display: grid; gap: 3px; padding: 10px 12px; border-left: 2px solid var(--red); background: rgba(255,255,255,.84); }.visual-callout strong { font: 600 11px 'IBM Plex Mono', monospace; }.visual-callout span { color: var(--steel); font-size: 10px; }.callout-one { top: 60px; right: 25px; }.callout-two { bottom: 81px; left: 25px; }.visual-caption { position: absolute; right: 20px; bottom: 18px; left: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #47545c; font: 600 10px 'IBM Plex Mono', monospace; }.visual-caption small { color: var(--steel); font: 400 10px 'Noto Sans SC', sans-serif; }
.evidence-band { display: grid; grid-template-columns: repeat(4, 1fr); color: #fff; background: var(--ink); }.evidence-band > div { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; padding: 26px 28px; border-right: 1px solid rgba(255,255,255,.16); }.evidence-band > div:last-child { border-right: 0; }.evidence-band span { grid-row: 1 / 3; color: var(--yellow); font: 600 11px 'IBM Plex Mono', monospace; }.evidence-band strong { font-size: 16px; }.evidence-band small { color: #bdc8cb; font-size: 11px; }
.section { width: min(1320px, calc(100% - 84px)); margin: 0 auto; }.products-section { padding-top: 105px; padding-bottom: 118px; }.section-heading { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr); gap: 54px; align-items: end; margin-bottom: 46px; }.section-heading h2, .certificate-copy h2, .contact-inner h2 { margin: 0; font-size: 52px; line-height: 1.18; }.section-heading > p { margin: 0; color: #5b666c; font-size: 14px; line-height: 1.85; }.product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }.product-card { display: grid; grid-template-rows: 220px auto; min-height: 570px; border: 1px solid var(--line); background: var(--white); }.product-visual { position: relative; overflow: hidden; background: #e7e6df; }.product-visual::before { position: absolute; inset: 23% 20% 15%; border: 1px solid rgba(102,114,124,.42); content: ''; }.product-visual.tone-2 { background: #ebe8e1; }.product-visual.tone-3 { background: #e4e8e5; }.mini-cylinder { position: absolute; bottom: 28px; left: 50%; width: 68px; height: 140px; border-radius: 32px 32px 8px 8px; background: linear-gradient(90deg, #7a878b, #e0e2de 48%, #737e82); box-shadow: 11px 10px 0 rgba(23,33,43,.13); transform: translateX(-50%); }.mini-valve { position: absolute; top: 38px; left: calc(50% - 12px); width: 24px; height: 18px; background: #5d686d; }.mini-pipe { position: absolute; top: 82px; left: calc(50% + 20px); width: 75px; height: 2px; background: var(--red); transform: rotate(-20deg); transform-origin: left; }.product-number { position: absolute; top: 13px; left: 14px; color: var(--red); font: 600 12px 'IBM Plex Mono', monospace; }.product-content { display: flex; flex-direction: column; padding: 24px; }.product-category { margin: 0 0 8px; color: var(--red); font: 600 10px 'IBM Plex Mono', monospace; }.product-content h3 { margin: 0 0 12px; font-size: 21px; line-height: 1.4; }.product-content > p { min-height: 50px; margin: 0; color: #5b666c; font-size: 12px; line-height: 1.7; }.product-content dl { margin: 18px 0 14px; border-top: 1px solid var(--line); }.product-content dl div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); }.product-content dt { color: var(--steel); font-size: 10px; }.product-content dd { margin: 0; font: 500 10px 'IBM Plex Mono', monospace; text-align: right; }.model-list { display: flex; flex-wrap: wrap; gap: 5px; }.model-list span { padding: 4px 6px; color: #4f5c63; border: 1px solid #cfd4d2; font: 500 9px 'IBM Plex Mono', monospace; }.text-link { display: inline-flex; align-items: center; gap: 6px; width: fit-content; margin-top: auto; padding-top: 17px; color: var(--red); font-size: 11px; font-weight: 700; }.text-link:hover { color: var(--red-dark); }
.services-section { padding: 104px 0 112px; background: #e5e8e5; }.services-heading { margin-bottom: 38px; }.industry-reference { position: relative; margin-bottom: 28px; overflow: hidden; background: #b9c1bf; }.industry-reference img { display: block; width: 100%; height: 250px; object-fit: cover; filter: saturate(.72) contrast(1.04); }.industry-reference figcaption { position: absolute; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 17px; color: #fff; background: rgba(23,33,43,.82); }.industry-reference figcaption span { color: var(--yellow); font-size: 11px; font-weight: 700; }.industry-reference figcaption small { color: #d3dadd; font-size: 10px; }.service-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }.service-item { position: relative; min-height: 260px; padding: 25px 23px; border-top: 2px solid var(--red); background: rgba(255,255,255,.58); }.service-index { color: var(--red); font: 600 10px 'IBM Plex Mono', monospace; }.service-icon { display: block; margin-top: 30px; color: var(--red); font-size: 25px; }.service-item h3 { margin: 17px 0 9px; font-size: 18px; }.service-item p { margin: 0; color: #5d696e; font-size: 12px; line-height: 1.7; }.service-item small { display: inline-block; margin-top: 19px; color: #7a6122; font: 500 10px 'IBM Plex Mono', monospace; }
.certificate-section { display: grid; grid-template-columns: minmax(300px, .8fr) minmax(0, 1.2fr); gap: 80px; padding-top: 116px; padding-bottom: 120px; }.certificate-copy > p:not(.section-label) { max-width: 440px; margin: 24px 0 0; color: #5b666c; font-size: 14px; line-height: 1.85; }.source-note { display: flex; align-items: flex-start; gap: 8px; margin-top: 28px; color: #55655c; font-size: 11px; line-height: 1.6; }.source-note .el-icon { flex: 0 0 auto; color: #56826a; font-size: 16px; }.certificate-list { border-top: 1px solid var(--line); }.certificate-row { display: grid; grid-template-columns: 1.15fr 1fr .8fr 20px; gap: 15px; align-items: center; min-height: 90px; border-bottom: 1px solid var(--line); }.certificate-row:hover { color: var(--red); }.certificate-kind { color: var(--steel); font-size: 11px; }.certificate-row strong { font: 600 12px 'IBM Plex Mono', monospace; }.certificate-row > span:nth-child(3) { color: #5c696e; font-size: 11px; }.certificate-row .el-icon { color: var(--red); }.certificate-row-muted { color: var(--steel); }
.contact-section { color: #fff; background: var(--red-dark); }.contact-inner { display: grid; grid-template-columns: 1.1fr .9fr; gap: 48px 88px; padding-top: 88px; padding-bottom: 82px; }.contact-inner .section-label { color: #ffd68b; }.contact-inner h2 { max-width: 630px; }.contact-inner > div:first-child > p:last-child { max-width: 560px; margin: 24px 0 0; color: #f2d6d1; font-size: 14px; line-height: 1.85; }.contact-actions { display: flex; flex-direction: column; gap: 10px; align-self: end; }.contact-action { justify-content: space-between; border-color: rgba(255,255,255,.45); color: #fff; }.contact-action-primary { color: var(--ink); background: var(--yellow); border-color: var(--yellow); }.contact-action-primary:hover { background: #e4b840; }.contact-facts { display: grid; grid-template-columns: repeat(3, 1fr); grid-column: 1 / -1; margin: 10px 0 0; border-top: 1px solid rgba(255,255,255,.28); }.contact-facts div { padding: 18px 18px 0 0; }.contact-facts dt { color: #f3c8c2; font: 500 10px 'IBM Plex Mono', monospace; }.contact-facts dd { margin: 6px 0 0; color: #fff; font-size: 12px; line-height: 1.65; }
.site-footer { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 30px; align-items: center; padding: 28px 42px; color: #c6d0d0; background: var(--ink); }.site-footer strong, .site-footer small { display: block; }.site-footer strong { color: #fff; font-size: 14px; }.site-footer small { margin-top: 4px; font: 500 9px 'IBM Plex Mono', monospace; }.site-footer p { margin: 0; font-size: 11px; line-height: 1.6; }.site-footer > a { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid rgba(255,255,255,.35); color: #fff; }
@media (max-width: 1100px) { .site-header { padding-inline: 26px; }.hero { grid-template-columns: minmax(0, 1fr) minmax(360px, .88fr); padding-inline: 42px; }.hero h1 { font-size: 64px; }.section { width: min(100% - 56px, 1320px); }.product-grid { grid-template-columns: repeat(2, 1fr); }.product-card:last-child { grid-column: 1 / -1; grid-template-columns: minmax(220px, .8fr) minmax(0, 1.2fr); }.service-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .notice-bar { justify-content: flex-start; overflow-x: auto; white-space: nowrap; }.site-header { grid-template-columns: 1fr auto; min-height: 68px; padding-inline: 18px; }.desktop-nav, .header-cta { display: none; }.menu-button { display: inline-grid; place-items: center; }.hero { grid-template-columns: 1fr; gap: 40px; min-height: auto; padding: 62px 20px 68px; }.hero h1 { font-size: 44px; }.hero-lead { font-size: 14px; }.hero-signals { margin-top: 30px; }.hero-visual { min-height: 430px; }.evidence-band { grid-template-columns: repeat(2, 1fr); }.evidence-band > div:nth-child(2) { border-right: 0; }.evidence-band > div:nth-child(-n+2) { border-bottom: 1px solid rgba(255,255,255,.16); }.section { width: calc(100% - 40px); }.products-section, .certificate-section { padding-top: 78px; padding-bottom: 82px; }.section-heading, .certificate-section, .contact-inner { grid-template-columns: 1fr; gap: 28px; }.section-heading { margin-bottom: 30px; }.section-heading h2, .certificate-copy h2, .contact-inner h2 { font-size: 36px; }.product-grid { grid-template-columns: 1fr; }.product-card:last-child { grid-column: auto; grid-template-columns: 1fr; }.product-card { grid-template-rows: 190px auto; min-height: 0; }.product-content > p { min-height: 0; }.services-section { padding: 78px 0 82px; }.industry-reference img { height: 190px; }.industry-reference figcaption { align-items: flex-start; flex-direction: column; gap: 3px; padding: 10px 12px; }.service-grid { grid-template-columns: 1fr; }.service-item { min-height: 0; }.certificate-row { grid-template-columns: 1fr 20px; gap: 6px 12px; padding: 16px 0; }.certificate-row strong { grid-row: 2; }.certificate-row > span:nth-child(3) { grid-row: 2; grid-column: 1; }.certificate-row .el-icon { grid-column: 2; grid-row: 1 / 3; }.contact-inner { padding-top: 68px; padding-bottom: 62px; }.contact-facts { grid-template-columns: 1fr; }.contact-facts div { padding-top: 15px; }.site-footer { grid-template-columns: 1fr auto; padding: 24px 20px; }.site-footer p { grid-column: 1 / -1; order: 3; }.visual-caption { align-items: flex-start; flex-direction: column; gap: 3px; } }
@media (prefers-reduced-motion: reduce) { .site-header { transition: none; } }
</style>


