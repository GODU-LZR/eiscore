<template>
  <div class="jinwei-site" :style="profileThemeStyle">
    <header class="site-nav" :class="{ compact: scrolled }">
      <button class="brand-lockup" type="button" :aria-label="copy.brand.homeLabel" @click="scrollToSection('top')">
        <img v-if="brandLogoUrl" class="brand-profile-logo" :src="brandLogoUrl" alt="" aria-hidden="true">
        <span v-else class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
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
        <a class="system-link system-link-external" :href="systemUrl" target="_blank" rel="noreferrer" :title="copy.nav.systemTitle">
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
          <div class="login-dialog-brand"><img v-if="brandLogoUrl" class="brand-profile-logo" :src="brandLogoUrl" alt="" aria-hidden="true"><span v-else class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>{{ copy.brand.name }}</strong><small>{{ copy.brand.sub }}</small></span></div>
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
          <a class="login-admin-link" :href="`${systemUrl}/login`" target="_blank" rel="noreferrer">{{ copy.login.adminLink }}<el-icon><ArrowRight /></el-icon></a>
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
      <div class="footer-brand"><img v-if="brandLogoUrl" class="brand-profile-logo" :src="brandLogoUrl" alt="" aria-hidden="true"><span v-else class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>{{ copy.brand.name }}</strong></div>
      <p>{{ copy.footer }}</p>
      <p v-if="publicContact">{{ publicContact }}</p>
      <button type="button" @click="scrollToSection('top')" :title="copy.footerTop"><el-icon><Top /></el-icon></button>
    </footer>
  </div>
</template>

<script setup>
import { useJinweiSite } from '@/composables/use-jinwei-site'

const {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Close,
  DocumentChecked,
  EN_COPY,
  HERO_SLIDES,
  JINWEI_PRODUCT_FAMILIES,
  JINWEI_PUBLIC_PROJECTS,
  JINWEI_PUBLIC_SOLUTIONS,
  JINWEI_QUALITY_BASELINE,
  JINWEI_SPEC_FIELDS,
  JINWEI_SYSTEM_URL,
  Key,
  LOGIN_USERNAME_STORAGE_KEY,
  Loading,
  Lock,
  Menu,
  Setting,
  Top,
  View,
  Warning,
  ZH_COPY,
  activeHeroSlide,
  assetUrl,
  associatedSeafood,
  brandLogoUrl,
  closeLogin,
  computed,
  constructionOptions,
  copy,
  createIdempotencyKey,
  currentHeroSlide,
  enterpriseProfileFromSiteConfig,
  form,
  getEnterpriseConfig,
  goFromMobile,
  heroAutoplayPaused,
  heroAutoplayTimer,
  independentSiteAssets,
  installPublicSeo,
  isEnglish,
  loadPublishedEnterpriseProfile,
  locale,
  localizeSolution,
  localizedAssociatedSeafood,
  localizedHeroSlides,
  localizedPrimarySolutions,
  localizedProcess,
  localizedProducts,
  localizedProjects,
  localizedQualityBaseline,
  localizedSpecFields,
  loginForm,
  loginLoading,
  loginMessage,
  loginOpen,
  loginTone,
  mobileNavOpen,
  navigateExternalHttps,
  onBeforeUnmount,
  onKeydown,
  onMounted,
  onScroll,
  openLogin,
  pauseHeroAutoplay,
  primarySolutions,
  productAsset,
  productEnglish,
  profileThemeStyle,
  projectAsset,
  projectEnglish,
  publicContact,
  publicProcess,
  publishedEnterpriseProfile,
  qualityEnglish,
  reactive,
  ref,
  rememberedLoginUsername,
  resumeHeroAutoplay,
  scrollToSection,
  scrolled,
  selectProduct,
  setHeroSlide,
  setLocale,
  setMeta,
  solutionAsset,
  solutionEnglish,
  specEnglish,
  startHeroAutoplay,
  stopHeroAutoplay,
  submitInquiry,
  submitPortalLogin,
  submitState,
  submitting,
  systemUrl,
  tx,
} = useJinweiSite()
</script>

<style scoped src="../styles/jinwei-site.css"></style>
