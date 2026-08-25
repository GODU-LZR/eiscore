<template>
  <div class="cue-builder" data-guide="cue-builder">
    <header class="builder-header">
      <div class="builder-heading">
        <button class="back-button" type="button" @click="goBack">← <span>企业站点运营</span></button>
        <div class="builder-kicker"><span class="kicker-dot"></span>CONFIGURATOR / CUE BUILDER</div>
        <div class="title-row">
          <h1>Design your cue</h1>
          <el-tag effect="plain" type="warning">PROTOTYPE / P01</el-tag>
        </div>
        <p>把视觉选择变成可解释的 Design JSON、报价和 BOM。保存后由服务端生成可审计快照；当前仍未写入正式订单或库存。</p>
      </div>
      <div class="builder-meta">
        <div><span>DESIGN ID</span><strong>{{ design.designId }}</strong></div>
        <div><span>REVISION</span><strong>R{{ design.revision }}</strong></div>
        <div><span>SNAPSHOT</span><strong>{{ snapshotHashValue }}</strong></div>
        <div><span>BACKEND</span><strong>{{ backendStatusLabel }}</strong></div>
      </div>
    </header>

    <main class="builder-layout">
      <section class="stage-column" aria-label="3D cue preview">
        <CueStage
          :design="design"
          :focus-slot="focusSlot"
          :exploded="exploded"
          :detail-mode="detailMode"
          :assemble-pulse="assemblePulse"
          @error="stageError = '当前设备无法初始化 WebGL，已保留配置与 BOM 操作。'"
        />
        <div class="stage-toolbar">
          <div class="view-switcher" role="group" aria-label="3D视图">
            <button type="button" :class="{ active: !detailMode }" @click="detailMode = false">Full cue</button>
            <button type="button" :class="{ active: detailMode }" @click="detailMode = true">Detail</button>
          </div>
          <div class="stage-actions">
            <button type="button" :class="{ active: exploded }" @click="toggleExplode">{{ exploded ? 'Assemble' : 'Explode' }}</button>
            <button type="button" @click="focusSlot = ''">Reset view</button>
          </div>
        </div>
        <div v-if="stageError" class="stage-error" role="status">{{ stageError }}</div>
        <div class="mobile-summary">
          <div><span>INDICATIVE FROM</span><strong>{{ quote.currency }} {{ quote.subtotal }}</strong></div>
          <div><span>LEAD TIME</span><strong>{{ quote.leadTimeDays }} days</strong></div>
          <button type="button" @click="mobilePanelOpen = !mobilePanelOpen">{{ mobilePanelOpen ? 'Hide options' : 'Open options' }} ↑</button>
        </div>
      </section>

      <aside class="config-column" :class="{ 'is-open-mobile': mobilePanelOpen }" aria-label="Cue configuration panel">
        <div class="config-panel-header">
          <div><span class="eyebrow">STEP {{ currentStep.number }} / 08</span><h2>{{ currentStep.label }}</h2><p>{{ currentStep.labelZh }}</p></div>
          <button class="panel-close" type="button" @click="mobilePanelOpen = false" aria-label="关闭配置面板">×</button>
        </div>

        <div class="step-progress" aria-label="配置步骤">
          <button v-for="step in steps" :key="step.id" type="button" :class="{ active: step.id === activeStepId, done: stepIndex > steps.findIndex((item) => item.id === step.id) }" :aria-label="`${step.number} ${step.label}`" @click="setStep(step.id)">
            <span>{{ step.number }}</span>
          </button>
        </div>

        <div class="config-scroll">
          <section v-if="activeStepId === 'base'" class="step-content">
            <div class="section-intro"><span>01 / FOUNDATION</span><p>Choose the performance direction. The rest of the configuration follows this base family.</p></div>
            <div class="choice-list">
              <button v-for="model in baseModels" :key="model.variantId" type="button" class="choice-row" :class="{ selected: design.baseModel === model.variantId }" @click="selectBase(model.variantId)">
                <span class="choice-mark" :style="{ background: model.color || '#b48a50' }"></span><span class="choice-copy"><strong>{{ model.name }}</strong><small>{{ model.nameZh }} · OEM-P01</small></span><span class="choice-price">{{ model.priceDelta ? `+${model.priceDelta}` : 'BASE' }}</span>
              </button>
            </div>
          </section>

          <section v-else-if="activeStepId === 'shaft'" class="step-content">
            <div class="section-intro"><span>02 / FRONT END</span><p>Match shaft material and tip diameter. Incompatible diameters are filtered by the rule layer.</p></div>
            <OptionGroup title="Shaft / 前节" slot-name="SHAFT" :variants="getVariants('SHAFT')" :selected-id="selectedId('SHAFT')" :is-compatible="isVariantSelectable" @select="selectVariant('SHAFT', $event)" />
            <OptionGroup title="Tip / 皮头" slot-name="TIP" :variants="getVariants('TIP')" :selected-id="selectedId('TIP')" :is-compatible="isVariantSelectable" @select="selectVariant('TIP', $event)" />
            <OptionGroup title="Ferrule / 先角" slot-name="FERRULE" :variants="getVariants('FERRULE')" :selected-id="selectedId('FERRULE')" @select="selectVariant('FERRULE', $event)" />
          </section>

          <section v-else-if="activeStepId === 'joint'" class="step-content">
            <div class="section-intro"><span>03 / CONNECTION</span><p>Joint family is a hard compatibility boundary between shaft and butt.</p></div>
            <OptionGroup title="Joint / 接牙与接环" slot-name="JOINT" :variants="getVariants('JOINT')" :selected-id="selectedId('JOINT')" :is-compatible="isVariantSelectable" @select="selectVariant('JOINT', $event)" />
            <div class="focus-callout"><span>3D FOCUS</span><strong>选择后镜头会聚焦接牙区域。</strong><button type="button" @click="focusSlot = 'JOINT'">Focus joint →</button></div>
          </section>

          <section v-else-if="activeStepId === 'forearm'" class="step-content">
            <div class="section-intro"><span>04 / MATERIAL</span><p>Use the same variant ID for the visual swatch and future material/BOM mapping.</p></div>
            <OptionGroup title="Forearm wood / 前把主木" slot-name="FOREARM" :variants="getVariants('FOREARM')" :selected-id="selectedId('FOREARM')" @select="selectVariant('FOREARM', $event)" />
            <OptionGroup title="Inlay / 镶嵌与高插" slot-name="INLAY" :variants="getVariants('INLAY')" :selected-id="selectedId('INLAY')" @select="selectVariant('INLAY', $event)" />
            <div class="material-note"><span>ASSET STATUS</span><strong>Factory candidate preview</strong><p>君乐缘素材为候选预览；真实 PBR、色样、授权、库存与价格仍需工厂确认。</p></div>
          </section>

          <section v-else-if="activeStepId === 'grip'" class="step-content">
            <div class="section-intro"><span>05 / HAND FEEL</span><p>Wrap choice changes the visual rhythm, weight estimate and manufacturing operation.</p></div>
            <OptionGroup title="Handle / 握把基体" slot-name="HANDLE" :variants="getVariants('HANDLE')" :selected-id="selectedId('HANDLE')" @select="selectVariant('HANDLE', $event)" />
            <OptionGroup title="Wrap / 缠把" slot-name="WRAP" :variants="getVariants('WRAP')" :selected-id="selectedId('WRAP')" @select="selectVariant('WRAP', $event)" />
          </section>

          <section v-else-if="activeStepId === 'butt'" class="step-content">
            <div class="section-intro"><span>06 / BALANCE</span><p>Butt details are kept as separate slots so visual BOM, manufacturing BOM and price BOM can diverge safely.</p></div>
            <OptionGroup title="Butt sleeve / 后把" slot-name="BUTT_SLEEVE" :variants="getVariants('BUTT_SLEEVE')" :selected-id="selectedId('BUTT_SLEEVE')" @select="selectVariant('BUTT_SLEEVE', $event)" />
            <OptionGroup title="Butt plate / 尾板" slot-name="BUTT_PLATE" :variants="getVariants('BUTT_PLATE')" :selected-id="selectedId('BUTT_PLATE')" @select="selectVariant('BUTT_PLATE', $event)" />
            <OptionGroup title="Target weight / 目标重量" slot-name="WEIGHT_SYSTEM" :variants="getVariants('WEIGHT_SYSTEM')" :selected-id="selectedId('WEIGHT_SYSTEM')" @select="selectVariant('WEIGHT_SYSTEM', $event)" />
            <OptionGroup title="Bumper / 胶塞" slot-name="BUMPER" :variants="getVariants('BUMPER')" :selected-id="selectedId('BUMPER')" :is-compatible="isVariantSelectable" @select="selectVariant('BUMPER', $event)" />
            <OptionGroup title="Extension / 延长把接口" slot-name="EXTENSION_INTERFACE" :variants="getVariants('EXTENSION_INTERFACE')" :selected-id="selectedId('EXTENSION_INTERFACE')" :is-compatible="isVariantSelectable" @select="selectVariant('EXTENSION_INTERFACE', $event)" />
          </section>

          <section v-else-if="activeStepId === 'personalize'" class="step-content">
            <div class="section-intro"><span>07 / YOUR MARK</span><p>Preview only. Any logo or engraving must pass artwork and process confirmation before manufacturing.</p></div>
            <label class="field-label" for="engraving">Engraving / 个性化刻字</label>
            <input id="engraving" v-model="engravingText" class="text-field" maxlength="32" placeholder="PLAYER 01" @input="updateEngraving">
            <div class="engraving-preview"><span>PREVIEW</span><strong>{{ engravingText || 'PLAYER 01' }}</strong><small>效果以工艺确认稿为准 / preview only</small></div>
            <label class="check-row"><input v-model="logoRequested" type="checkbox" @change="updateLogo"><span>Request logo / 提交 Logo 审核占位</span></label>
          </section>

          <section v-else class="step-content review-content">
            <div class="section-intro"><span>08 / CONFIGURATION SNAPSHOT</span><p>Review the configuration after the server validation, quote and BOM gate.</p></div>
            <div class="review-stats"><div><span>INDICATIVE PRICE</span><strong>{{ quote.currency }} {{ quote.subtotal }}</strong></div><div><span>LEAD TIME</span><strong>{{ quote.leadTimeDays }} d</strong></div><div><span>WEIGHT</span><strong>{{ design.dimensions.targetWeightOz }} oz</strong></div></div>
            <div class="validation-state" :class="validation.valid ? 'is-valid' : 'is-invalid'"><span>{{ validation.valid ? '●' : '!' }}</span><div><strong>{{ validation.valid ? 'Configuration passes prototype rules' : 'Configuration needs attention' }}</strong><small>{{ validation.valid ? 'Backend validation is still required before order.' : `${validation.errors.length} blocking rule(s) need review.` }}</small></div></div>
            <div class="bom-preview"><div class="bom-heading"><strong>Visual BOM</strong><span>{{ visualBom.length }} components</span></div><div v-for="item in visualBom.slice(0, 8)" :key="item.slot" class="bom-row"><span>{{ item.slot }}</span><strong>{{ item.variantId }}</strong></div><p v-if="visualBom.length > 8">+ {{ visualBom.length - 8 }} more component slots</p></div>
            <form class="rfq-form" @submit.prevent="submitRfq">
              <div class="section-intro"><span>RFQ / HUMAN REVIEW</span><p>Send this revision to the factory team for material, cost, MOQ and lead-time confirmation.</p></div>
              <div class="rfq-fields"><label><span>Company</span><input v-model="rfqForm.companyName" required maxlength="160" placeholder="Company name"></label><label><span>Contact</span><input v-model="rfqForm.contactName" required maxlength="100" placeholder="Contact name"></label><label><span>Email</span><input v-model="rfqForm.email" required type="email" maxlength="200" placeholder="buyer@example.com"></label><label><span>Phone / WhatsApp</span><input v-model="rfqForm.phone" maxlength="80" placeholder="Optional"></label><label><span>Quantity</span><input v-model="rfqForm.quantity" required maxlength="120" placeholder="e.g. 20 pcs"></label><label><span>Region</span><input v-model="rfqForm.region" maxlength="100" placeholder="Country / region"></label></div>
              <label class="rfq-message"><span>Message</span><textarea v-model="rfqForm.message" maxlength="4000" rows="3" placeholder="Target use, material questions or requested changes"></textarea></label>
              <label class="check-row rfq-consent"><input v-model="rfqForm.consentAccepted" type="checkbox" required><span>I agree that the factory team may use these contact details to follow up on this RFQ.</span></label>
              <p v-if="rfqError" class="rfq-error" role="alert">{{ rfqError }}</p>
              <p v-if="rfqSubmitted" class="rfq-success" role="status">RFQ queued for human review. The factory team will confirm the commercial facts.</p>
              <button class="rfq-submit" type="submit" :disabled="isRfqSubmitting || !validation.valid || rfqSubmitted">{{ isRfqSubmitting ? 'Submitting…' : rfqSubmitted ? 'RFQ submitted' : 'Request factory quote' }}</button>
            </form>
          </section>

          <div v-if="validation.errors.length || validation.warnings.length" class="rule-messages">
            <div v-for="issue in [...validation.errors, ...validation.warnings]" :key="`${issue.code}-${issue.slot || ''}`" class="rule-message" :class="issue.level === 'error' ? 'is-error' : 'is-warning'"><span>{{ issue.level === 'error' ? '!' : 'i' }}</span><p>{{ issue.message }}</p></div>
          </div>
        </div>

        <div class="config-footer">
          <div class="quote-line"><span>INDICATIVE</span><strong>{{ quote.currency }} {{ quote.subtotal }}</strong><small>{{ quote.leadTimeDays }} day lead time</small></div>
          <div class="footer-actions"><button type="button" class="secondary-button" :disabled="isSyncing" @click="saveDesign">{{ isSyncing ? 'Syncing…' : 'Save design' }}</button><button type="button" class="primary-button" :disabled="isSyncing" @click="nextStep">{{ activeStepId === 'review' ? 'Save snapshot' : 'Next step' }} <span>→</span></button></div>
        </div>
      </aside>
    </main>

    <section class="bottom-tools" aria-label="Design tools">
      <div><span>DESIGN JSON</span><strong>{{ savedStateText }}</strong><small v-if="backendError" class="backend-error">{{ backendError }}</small></div>
      <div class="bottom-tool-actions"><button type="button" @click="copyDesignJson">Copy Design JSON</button><button type="button" @click="downloadBom">Export BOM CSV</button><button type="button" :disabled="isSyncing" @click="shareDesign">Create share link</button><button type="button" @click="showTechnicalPanel = !showTechnicalPanel">{{ showTechnicalPanel ? 'Hide' : 'Show' }} technical detail</button></div>
    </section>
    <div v-if="shareUrl" class="share-result"><span>SHARE LINK</span><input :value="shareUrl" readonly aria-label="Configuration share link"><button type="button" @click="copyShareUrl">Copy link</button></div>
    <div v-if="showTechnicalPanel" class="technical-panel"><div><span>SNAPSHOT HASH</span><strong>{{ snapshotHashValue }}</strong></div><div><span>MANUFACTURING BOM</span><strong>{{ manufacturingBom.items.length }} line items / {{ manufacturingBom.revision }} revision</strong></div><div><span>CONFIGURATION</span><strong>{{ configurationId || 'Not synced' }}</strong></div><div><span>GATE</span><strong>{{ snapshot.productionGate?.status || 'local prototype fallback' }} / RFQ {{ quote.requiresRfq ? 'required' : 'not required' }}</strong></div></div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import OptionGroup from '@/components/configurator/OptionGroup.vue'
import CueStage from '@/components/configurator/CueStage.vue'
import { BASE_MODELS, CUE_BUILDER_STEPS as stepsCatalog, getVariants } from '@/configurator/catalog'
import { buildConfigurationSnapshot, createDefaultDesign, isVariantCompatible, setCustomization, updateBaseModel, updateComponent } from '@/configurator/engine'

const router = useRouter()
const STORAGE_KEY = 'eiscore.cue-builder.design.v1'
const steps = stepsCatalog
const baseModels = BASE_MODELS
const design = ref(createDefaultDesign())
const activeStepId = ref('base')
const focusSlot = ref('')
const exploded = ref(false)
const detailMode = ref(false)
const mobilePanelOpen = ref(false)
const stageError = ref('')
const assemblePulse = ref(0)
const engravingText = ref('')
const logoRequested = ref(false)
const savedStateText = ref('Not saved')
const showTechnicalPanel = ref(false)
const configurationId = ref('')
const configurationToken = ref('')
const remoteSnapshot = ref(null)
const remoteRevision = ref(0)
const backendStatus = ref('idle')
const backendError = ref('')
const isSyncing = ref(false)
const shareUrl = ref('')
const rfqForm = ref({ companyName: '', contactName: '', email: '', phone: '', quantity: '', region: '', message: '', consentAccepted: false })
const rfqSubmitted = ref(false)
const rfqError = ref('')
const isRfqSubmitting = ref(false)

const localSnapshot = computed(() => buildConfigurationSnapshot(design.value))
const snapshot = computed(() => remoteSnapshot.value && remoteRevision.value === design.value.revision ? remoteSnapshot.value : localSnapshot.value)
const validation = computed(() => snapshot.value.validation)
const quote = computed(() => snapshot.value.quote)
const visualBom = computed(() => snapshot.value.visualBom)
const manufacturingBom = computed(() => snapshot.value.manufacturingBom)
const snapshotHashValue = computed(() => String(snapshot.value.snapshotHash || '').slice(-8).toUpperCase())
const backendStatusLabel = computed(() => ({ idle: 'LOCAL', syncing: 'SYNCING', synced: 'SYNCED', fallback: 'LOCAL FALLBACK', shared: 'SHARED VIEW' }[backendStatus.value] || 'LOCAL'))
const stepIndex = computed(() => steps.findIndex((step) => step.id === activeStepId.value))
const currentStep = computed(() => steps[stepIndex.value] || steps[0])

const selectedId = (slot) => design.value.components.find((item) => item.slot === slot)?.variantId || ''
const isVariantSelectable = (slot, variantId) => isVariantCompatible(design.value, slot, variantId)

const selectVariant = (slot, variantId) => {
  design.value = updateComponent(design.value, slot, variantId)
  focusSlot.value = slot
}

const selectBase = (baseModelId) => {
  design.value = updateBaseModel(design.value, baseModelId)
  focusSlot.value = 'CUE_ROOT'
}

const setStep = (stepId) => {
  activeStepId.value = stepId
  const target = steps.find((step) => step.id === stepId)
  focusSlot.value = target?.focusSlot || ''
  if (stepId === 'review') detailMode.value = false
  mobilePanelOpen.value = true
}

const nextStep = () => {
  if (activeStepId.value === 'review') {
    saveDesign()
    return
  }
  const next = steps[stepIndex.value + 1]
  if (next) setStep(next.id)
}

const toggleExplode = () => {
  exploded.value = !exploded.value
  assemblePulse.value += 1
}

const updateEngraving = () => {
  design.value = setCustomization(design.value, { engravingText: engravingText.value })
}

const updateLogo = () => {
  design.value = setCustomization(design.value, { logoAssetId: logoRequested.value ? 'ARTWORK-UPLOAD-PENDING' : '', artworkApprovalStatus: 'not_requested' })
}

const configurationApiBase = String(import.meta.env.VITE_CONFIGURATION_API_BASE || '/agent/company-site/public').replace(/\/$/, '')

const requestConfiguration = async (path, options = {}) => {
  const { body, headers: optionHeaders = {}, ...requestOptions } = options
  const response = await fetch(`${configurationApiBase}${path}`, {
    ...requestOptions,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...optionHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.message || `Configuration request failed (${response.status})`)
    error.code = payload.code || 'CONFIGURATION_REQUEST_FAILED'
    throw error
  }
  return payload
}

const applyRemoteSnapshot = (payload) => {
  const remote = payload?.configuration?.snapshot || payload?.snapshot
  if (!remote) return
  if (payload?.configuration?.design?.designId) design.value = payload.configuration.design
  else if (remote.design?.designId) design.value = remote.design
  remoteSnapshot.value = remote
  remoteRevision.value = Number(payload?.configuration?.revision || remote.design?.revision || design.value.revision)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(design.value))
}

const restoreConfiguration = async () => {
  backendStatus.value = 'syncing'
  backendError.value = ''
  try {
    const restored = await requestConfiguration(`/configurations/${encodeURIComponent(configurationId.value)}`, {
      method: 'GET',
      headers: { 'X-Configuration-Token': configurationToken.value }
    })
    applyRemoteSnapshot(restored)
    remoteRevision.value = Number(restored.configuration?.revision || design.value.revision)
    backendStatus.value = 'synced'
    savedStateText.value = `Restored from server · ${new Date().toLocaleTimeString()}`
  } catch (error) {
    backendStatus.value = 'fallback'
    backendError.value = `${error.code || 'RESTORE_ERROR'}: ${error.message}`
  }
}

const syncConfiguration = async () => {
  isSyncing.value = true
  backendStatus.value = 'syncing'
  backendError.value = ''
  try {
    let saved
    if (!configurationId.value || !configurationToken.value) {
      saved = await requestConfiguration('/configurations', {
        method: 'POST',
        headers: { 'Idempotency-Key': `cue-create-${design.value.designId}` },
        body: { design: design.value }
      })
    } else {
      saved = await requestConfiguration(`/configurations/${encodeURIComponent(configurationId.value)}`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': `cue-update-${design.value.designId}-r${design.value.revision}`, 'X-Configuration-Token': configurationToken.value },
        body: { design: design.value }
      })
    }
    configurationId.value = saved.configuration?.id || configurationId.value
    configurationToken.value = saved.configurationToken || configurationToken.value
    localStorage.setItem(`${STORAGE_KEY}.meta`, JSON.stringify({ configurationId: configurationId.value, configurationToken: configurationToken.value }))
    applyRemoteSnapshot(saved)
    const authHeaders = { 'X-Configuration-Token': configurationToken.value }
    const [validated, quoted, bommed] = await Promise.all([
      requestConfiguration(`/configurations/${encodeURIComponent(configurationId.value)}/validate`, { method: 'POST', headers: authHeaders }),
      requestConfiguration(`/configurations/${encodeURIComponent(configurationId.value)}/quote`, { method: 'POST', headers: authHeaders }),
      requestConfiguration(`/configurations/${encodeURIComponent(configurationId.value)}/bom`, { method: 'POST', headers: authHeaders })
    ])
    const base = validated.configuration?.snapshot || remoteSnapshot.value || localSnapshot.value
    remoteSnapshot.value = { ...base, validation: validated.validation || base.validation, quote: quoted.quote || base.quote, visualBom: bommed.visualBom || base.visualBom, manufacturingBom: bommed.manufacturingBom || base.manufacturingBom, productionGate: validated.productionGate || bommed.productionGate || quoted.productionGate || base.productionGate, snapshotHash: validated.snapshotHash || base.snapshotHash }
    remoteRevision.value = Number(saved.configuration?.revision || design.value.revision)
    backendStatus.value = 'synced'
    savedStateText.value = `Saved to server · ${new Date().toLocaleTimeString()}`
    return true
  } catch (error) {
    backendStatus.value = 'fallback'
    backendError.value = `${error.code || 'SYNC_ERROR'}: ${error.message}`
    savedStateText.value = `Saved locally · ${new Date().toLocaleTimeString()}`
    ElMessage.warning('服务端暂不可用，已保留本地草稿；正式报价仍需服务端校验')
    return false
  } finally {
    isSyncing.value = false
  }
}

const saveDesign = async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(design.value))
  const synced = await syncConfiguration()
  if (synced) ElMessage.success('Design JSON 已保存并完成服务端校验')
}

const shareDesign = async () => {
  if (!configurationId.value || remoteRevision.value !== design.value.revision) await syncConfiguration()
  if (!configurationId.value || !configurationToken.value || backendStatus.value !== 'synced') return
  try {
    const result = await requestConfiguration(`/configurations/${encodeURIComponent(configurationId.value)}/share`, { method: 'POST', headers: { 'X-Configuration-Token': configurationToken.value }, body: { expiresInDays: 30 } })
    const token = result.shareToken
    shareUrl.value = `${window.location.origin}${configurationApiBase}/configurations/shared/${encodeURIComponent(token)}`
    await copyShareUrl()
    ElMessage.success('配置分享链接已复制')
  } catch (error) {
    backendError.value = `${error.code || 'SHARE_ERROR'}: ${error.message}`
    ElMessage.error('配置分享链接生成失败')
  }
}

const submitRfq = async () => {
  isRfqSubmitting.value = true
  rfqError.value = ''
  try {
    if (!configurationId.value || remoteRevision.value !== design.value.revision || backendStatus.value !== 'synced') await syncConfiguration()
    if (!configurationId.value || !configurationToken.value || backendStatus.value !== 'synced') throw new Error('Save the configuration to the server before submitting an RFQ.')
    const result = await requestConfiguration(`/configurations/${encodeURIComponent(configurationId.value)}/rfq`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `cue-rfq-${design.value.designId}-r${design.value.revision}`, 'X-Configuration-Token': configurationToken.value },
      body: { ...rfqForm.value, locale: document.documentElement.lang || navigator.language || 'en-US', consent: { accepted: rfqForm.value.consentAccepted, purpose: 'inquiry_follow_up', policyVersion: 'v1' } }
    })
    rfqSubmitted.value = true
    savedStateText.value = `RFQ queued · ${result.lead?.publicRef || result.rfq?.id}`
    ElMessage.success('询价已提交，等待工厂人工确认')
  } catch (error) {
    rfqError.value = `${error.code || 'RFQ_ERROR'}: ${error.message}`
    ElMessage.error('询价提交失败')
  } finally {
    isRfqSubmitting.value = false
  }
}

const copyShareUrl = async () => {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
  } catch {
    ElMessage.warning('当前浏览器不允许剪贴板访问，请手动复制链接')
  }
}

const copyDesignJson = async () => {
  const payload = JSON.stringify(snapshot.value, null, 2)
  try {
    await navigator.clipboard.writeText(payload)
    ElMessage.success('Design snapshot 已复制')
  } catch {
    ElMessage.warning('当前浏览器不允许剪贴板访问，请使用导出 BOM')
  }
}

const downloadBom = () => {
  const rows = [['bom_type', 'design_id', 'revision', 'slot_or_code', 'variant_or_description', 'quantity', 'uom', 'operation']]
  visualBom.value.forEach((item) => rows.push(['visual', design.value.designId, design.value.revision, item.slot, item.variantId, item.quantity, item.uom, '']))
  manufacturingBom.value.items.forEach((item) => rows.push(['manufacturing', design.value.designId, manufacturingBom.value.revision, item.code, item.description, item.quantity, item.uom, item.operation]))
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${design.value.designId}-bom.csv`
  anchor.click()
  URL.revokeObjectURL(url)
  ElMessage.success('Visual / Manufacturing BOM 已导出')
}

const goBack = () => router.push('/')

onMounted(() => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (stored?.designId) design.value = stored
  } catch {
    // Ignore malformed local drafts and keep a clean prototype design.
  }
  try {
    const metadata = JSON.parse(localStorage.getItem(`${STORAGE_KEY}.meta`) || 'null')
    configurationId.value = metadata?.configurationId || ''
    configurationToken.value = metadata?.configurationToken || ''
  } catch {
    configurationId.value = ''
    configurationToken.value = ''
  }
  engravingText.value = design.value.customization?.engravingText || ''
  logoRequested.value = Boolean(design.value.customization?.logoAssetId)
  if (configurationId.value && configurationToken.value) restoreConfiguration()
})

watch(() => design.value, (next) => {
  engravingText.value = next.customization?.engravingText || ''
  logoRequested.value = Boolean(next.customization?.logoAssetId)
}, { deep: true })
</script>

<style scoped>
:global(body) { background: var(--el-bg-color-page); }
.cue-builder { min-height: 100vh; padding: 22px clamp(16px, 2.5vw, 34px) 28px; color: var(--el-text-color-primary); background: var(--el-bg-color-page); }
.builder-header, .builder-layout, .bottom-tools, .technical-panel { max-width: 1540px; margin-left: auto; margin-right: auto; }
.builder-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; margin-bottom: 20px; }
.builder-heading { min-width: 0; }.back-button { display: inline-flex; gap: 8px; align-items: center; padding: 0; border: 0; color: var(--el-text-color-secondary); background: transparent; font-size: 12px; cursor: pointer; }.back-button:hover { color: var(--el-color-primary); }
.builder-kicker { display: flex; gap: 8px; align-items: center; margin-top: 18px; color: var(--el-color-primary); font: 700 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .13em; }.kicker-dot { width: 7px; height: 7px; background: var(--el-color-primary); border-radius: 50%; }
.title-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }.title-row h1 { margin: 0; font-size: clamp(25px, 3vw, 38px); line-height: 1.06; letter-spacing: -.04em; }.title-row :deep(.el-tag) { border-radius: 0; font: 700 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
.builder-heading p { max-width: 720px; margin: 9px 0 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.builder-meta { display: flex; gap: 22px; padding-bottom: 3px; }.builder-meta div { display: grid; gap: 5px; }.builder-meta span, .mobile-summary span, .quote-line span, .bottom-tools span, .technical-panel span, .share-result > span { color: var(--el-text-color-secondary); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }.builder-meta strong { font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
.builder-layout { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(390px, .8fr); grid-template-rows: minmax(0, 1fr); height: min(760px, calc(100vh - 220px)); min-height: 640px; overflow: hidden; border: 1px solid var(--el-border-color); background: var(--el-bg-color); box-shadow: var(--el-box-shadow-light); }
.stage-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; padding: 14px; background: #171817; }.stage-column :deep(.cue-stage) { flex: 1 1 auto; min-height: 0; height: auto; }.stage-column :deep(canvas) { min-height: 0; }.stage-toolbar { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; }.view-switcher, .stage-actions { display: flex; gap: 5px; }.view-switcher button, .stage-actions button { padding: 7px 10px; border: 1px solid rgba(255,255,255,.16); color: rgba(244,240,232,.68); background: transparent; font-size: 11px; cursor: pointer; }.view-switcher button.active, .stage-actions button.active, .stage-actions button:hover, .view-switcher button:hover { border-color: #b48a50; color: #f4f0e8; background: rgba(180,138,80,.15); }.stage-error { flex: 0 0 auto; margin-top: 10px; color: #e2aa94; font-size: 12px; }.mobile-summary { display: none; }
.config-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; background: var(--el-bg-color); border-left: 1px solid var(--el-border-color); }.config-panel-header { display: flex; justify-content: space-between; gap: 10px; padding: 22px 22px 16px; }.config-panel-header .eyebrow { color: var(--el-color-primary); font: 700 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }.config-panel-header h2 { margin: 8px 0 2px; font-size: 22px; letter-spacing: -.03em; }.config-panel-header p { margin: 0; color: var(--el-text-color-secondary); font-size: 12px; }.panel-close { display: none; border: 0; color: var(--el-text-color-secondary); background: transparent; font-size: 24px; cursor: pointer; }
.step-progress { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; padding: 0 22px 18px; border-bottom: 1px solid var(--el-border-color-lighter); }.step-progress button { position: relative; height: 28px; padding: 0; border: 0; color: var(--el-text-color-secondary); background: var(--el-fill-color-light); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; cursor: pointer; }.step-progress button::after { content: ''; position: absolute; right: 0; bottom: 0; left: 0; height: 2px; background: transparent; }.step-progress button.active { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }.step-progress button.active::after { background: var(--el-color-primary); }.step-progress button.done { color: var(--el-color-success); }
.config-scroll { flex: 1; min-height: 0; overflow: auto; padding: 20px 22px; }.step-content { min-height: 300px; }.section-intro { margin-bottom: 20px; }.section-intro > span { color: var(--el-color-primary); font: 700 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .13em; }.section-intro p { margin: 8px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
.choice-list { display: grid; gap: 8px; }.choice-row { display: flex; align-items: center; gap: 11px; width: 100%; padding: 13px; border: 1px solid var(--el-border-color); color: inherit; text-align: left; background: var(--el-bg-color); cursor: pointer; }.choice-row:hover, .choice-row.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }.choice-mark, .swatch-color { flex: 0 0 28px; width: 28px; height: 28px; border: 1px solid rgba(0,0,0,.15); }.choice-copy { display: grid; flex: 1; gap: 3px; min-width: 0; }.choice-copy strong { font-size: 13px; }.choice-copy small, .swatch-card small { color: var(--el-text-color-secondary); font-size: 11px; }.choice-price { color: var(--el-color-primary); font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
.option-group { margin-top: 20px; }.option-group-heading, .bom-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; }.option-group-heading strong, .bom-heading strong { font-size: 13px; }.option-group-heading span, .bom-heading span { color: var(--el-text-color-secondary); font-size: 11px; }.swatch-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.swatch-card { position: relative; display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 4px 9px; align-items: center; min-width: 0; padding: 9px; border: 1px solid var(--el-border-color); color: inherit; text-align: left; background: var(--el-bg-color); cursor: pointer; }.swatch-card:hover, .swatch-card.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }.swatch-color { grid-row: span 2; width: 32px; height: 32px; }.swatch-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }.swatch-card small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.swatch-card em { position: absolute; top: 5px; right: 6px; color: var(--el-color-primary); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; font-style: normal; }
.focus-callout, .material-note, .engraving-preview, .validation-state, .bom-preview { margin-top: 18px; padding: 14px; border: 1px solid var(--el-border-color); background: var(--el-fill-color-light); }.focus-callout { display: grid; gap: 5px; }.focus-callout span, .material-note span, .engraving-preview span { color: var(--el-color-primary); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; }.focus-callout strong, .material-note strong { font-size: 12px; }.focus-callout button { width: fit-content; padding: 0; border: 0; color: var(--el-color-primary); background: transparent; font-size: 11px; cursor: pointer; }.material-note p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.6; }
.field-label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 650; }.text-field { width: 100%; padding: 12px; border: 1px solid var(--el-border-color); outline: none; color: var(--el-text-color-primary); background: var(--el-bg-color); font: inherit; }.text-field:focus { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px var(--el-color-primary-light-8); }.engraving-preview { display: grid; gap: 8px; min-height: 100px; background: linear-gradient(135deg, #25211b, #111312); color: #ecd09c; }.engraving-preview strong { font: 22px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .15em; }.engraving-preview small { color: rgba(244,240,232,.52); }.check-row { display: flex; align-items: center; gap: 8px; margin-top: 16px; color: var(--el-text-color-secondary); font-size: 12px; }.check-row input { accent-color: var(--el-color-primary); }
.review-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }.review-stats div { display: grid; gap: 6px; padding: 12px; border: 1px solid var(--el-border-color); }.review-stats span { color: var(--el-text-color-secondary); font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; }.review-stats strong { font-size: 15px; }.validation-state { display: flex; gap: 10px; align-items: flex-start; }.validation-state > span { color: var(--el-color-success); font-weight: 700; }.validation-state.is-invalid > span { color: var(--el-color-danger); }.validation-state div { display: grid; gap: 4px; }.validation-state strong { font-size: 12px; }.validation-state small { color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.5; }.bom-preview { padding: 12px; }.bom-row { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 8px; padding: 7px 0; border-top: 1px solid var(--el-border-color-lighter); font-size: 10px; }.bom-row span { color: var(--el-color-primary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }.bom-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 550; }.bom-preview > p { margin: 8px 0 0; color: var(--el-text-color-secondary); font-size: 11px; }
.rfq-form { display: grid; gap: 12px; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--el-border-color-lighter); }.rfq-form .section-intro { margin-bottom: 0; }.rfq-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }.rfq-fields label, .rfq-message { display: grid; gap: 5px; }.rfq-fields label > span, .rfq-message > span { color: var(--el-text-color-secondary); font-size: 10px; }.rfq-fields input, .rfq-message textarea { width: 100%; padding: 9px; border: 1px solid var(--el-border-color); outline: none; color: var(--el-text-color-primary); background: var(--el-bg-color); font: inherit; font-size: 11px; }.rfq-fields input:focus, .rfq-message textarea:focus { border-color: var(--el-color-primary); }.rfq-message textarea { resize: vertical; line-height: 1.5; }.rfq-consent { align-items: flex-start; margin-top: 0; font-size: 10px; line-height: 1.5; }.rfq-consent input { margin-top: 2px; }.rfq-submit { min-height: 38px; border: 1px solid var(--el-color-primary); color: #fff; background: var(--el-color-primary); font-size: 12px; cursor: pointer; }.rfq-submit:disabled { cursor: not-allowed; opacity: .55; }.rfq-error, .rfq-success { margin: 0; font-size: 11px; line-height: 1.5; }.rfq-error { color: var(--el-color-danger); }.rfq-success { color: var(--el-color-success); }
.rule-messages { display: grid; gap: 6px; margin-top: 16px; }.rule-message { display: flex; gap: 8px; padding: 9px; border-left: 2px solid var(--el-color-warning); background: var(--el-color-warning-light-9); }.rule-message.is-error { border-left-color: var(--el-color-danger); background: var(--el-color-danger-light-9); }.rule-message > span { flex: 0 0 16px; color: var(--el-color-warning); font-weight: 700; }.rule-message.is-error > span { color: var(--el-color-danger); }.rule-message p { margin: 0; color: var(--el-text-color-regular); font-size: 11px; line-height: 1.5; }
.config-footer { padding: 15px 22px 18px; border-top: 1px solid var(--el-border-color-lighter); background: var(--el-bg-color); }.quote-line { display: flex; align-items: baseline; gap: 8px; }.quote-line strong { font-size: 20px; }.quote-line small { color: var(--el-text-color-secondary); font-size: 11px; }.footer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }.secondary-button, .primary-button { min-height: 38px; border: 1px solid var(--el-border-color); font-size: 12px; cursor: pointer; }.secondary-button { color: var(--el-text-color-regular); background: var(--el-bg-color); }.primary-button { border-color: var(--el-color-primary); color: #fff; background: var(--el-color-primary); }.primary-button:hover { filter: brightness(1.05); }.secondary-button:disabled, .primary-button:disabled, .bottom-tool-actions button:disabled { cursor: wait; opacity: .58; }.primary-button span { margin-left: 5px; }
.bottom-tools, .technical-panel { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 14px; padding: 14px 2px 0; }.bottom-tools > div:first-child, .technical-panel > div { display: grid; gap: 5px; }.bottom-tools strong, .technical-panel strong { font-size: 12px; }.backend-error { max-width: 560px; color: var(--el-color-danger); font-size: 11px; line-height: 1.5; }.bottom-tool-actions { display: flex; flex-wrap: wrap; gap: 8px; }.bottom-tool-actions button { padding: 7px 0; border: 0; color: var(--el-color-primary); background: transparent; font-size: 11px; cursor: pointer; }.technical-panel { align-items: stretch; padding: 14px; border: 1px solid var(--el-border-color); background: var(--el-bg-color); }.technical-panel > div { flex: 1; padding: 4px 12px; border-left: 1px solid var(--el-border-color-lighter); }.technical-panel > div:first-child { border-left: 0; }.share-result { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; max-width: 1540px; margin: 10px auto 0; padding: 10px 12px; border: 1px solid var(--el-border-color); background: var(--el-bg-color); }.share-result input { min-width: 0; padding: 7px 9px; border: 1px solid var(--el-border-color); color: var(--el-text-color-regular); background: var(--el-fill-color-light); font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }.share-result button { padding: 7px 11px; border: 1px solid var(--el-color-primary); color: var(--el-color-primary); background: transparent; font-size: 11px; cursor: pointer; }
@media (max-width: 920px) { .builder-header { align-items: flex-start; flex-direction: column; }.builder-meta { padding: 0; }.builder-layout { grid-template-columns: minmax(0, 1.35fr) minmax(350px, .9fr); } }
@media (max-width: 720px) { .cue-builder { padding: 14px 10px 24px; }.builder-header { gap: 14px; }.builder-kicker { margin-top: 13px; }.title-row { align-items: flex-start; flex-direction: column; gap: 8px; }.title-row h1 { font-size: 28px; }.builder-meta { display: grid; grid-template-columns: repeat(2, 1fr); width: 100%; gap: 8px; }.builder-meta strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }.builder-layout { display: block; height: auto; min-height: 0; overflow: visible; border: 0; background: transparent; box-shadow: none; }.stage-column { display: block; overflow: visible; padding: 0; }.stage-column :deep(.cue-stage), .stage-column :deep(canvas) { min-height: 44vh; height: 44vh; }.stage-toolbar { padding-top: 8px; }.mobile-summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; padding: 12px; border: 1px solid var(--el-border-color); background: var(--el-bg-color); }.mobile-summary > div { display: grid; gap: 4px; }.mobile-summary strong { font-size: 14px; }.mobile-summary button { padding: 8px 0 8px 8px; border: 0; color: var(--el-color-primary); background: transparent; font-size: 11px; }.config-column { display: none; margin-top: 10px; border: 1px solid var(--el-border-color); }.config-column.is-open-mobile { display: flex; }.config-panel-header { padding: 16px; }.panel-close { display: block; }.step-progress { padding: 0 16px 14px; }.config-scroll { max-height: none; padding: 17px 16px; }.config-footer { padding: 13px 16px 16px; }.bottom-tools, .technical-panel { align-items: flex-start; flex-direction: column; }.bottom-tool-actions { gap: 12px; }.technical-panel { width: 100%; }.technical-panel > div { width: 100%; padding: 7px 0; border-top: 1px solid var(--el-border-color-lighter); border-left: 0; }.technical-panel > div:first-child { border-top: 0; }.share-result { grid-template-columns: 1fr; align-items: stretch; }.share-result button { width: fit-content; }.rfq-fields { grid-template-columns: 1fr; }.stage-column :deep(.cue-stage), .stage-column :deep(canvas) { min-height: 44vh; height: 44vh; } }
</style>
