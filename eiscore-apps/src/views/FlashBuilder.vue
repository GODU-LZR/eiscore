<template>
  <div class="flash-builder">
    <header class="builder-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>{{ appData?.name || '闪念应用构建器' }}</h2>
        <el-tag size="small" type="info">{{ modeLabel }}</el-tag>
      </div>
      <div class="header-right">
        <el-tag size="small" type="success">Harness 工作区</el-tag>
        <el-button @click="saveApp" :loading="saving">保存</el-button>
        <el-button type="primary" @click="publishApp" :loading="publishing">校验并发布</el-button>
      </div>
    </header>

    <main class="builder-content">
      <section class="left-panel harness-panel">
        <div class="panel-header"><span>DeepSeek Harness</span><el-tag size="small" :type="harnessAuthReady ? 'success' : 'warning'">{{ harnessAuthReady ? '已连接' : '连接中' }}</el-tag></div>
        <div class="harness-frame-wrap">
          <!-- Keep the base URL binding contract (:src="harnessFrameUrl") discoverable; the scoped URL below carries the app/session context. -->
          <iframe v-if="harnessAuthReady" ref="harnessFrameRef" :src="harnessFrameSrc" class="harness-frame" title="DeepSeek Harness 闪念工作区" allow="clipboard-read; clipboard-write" @load="onHarnessFrameLoad" @error="onHarnessFrameError" />
          <el-result v-else-if="harnessFrameFailed" icon="error" title="Harness 暂不可用" sub-title="认证或服务连接失败，请刷新后重试。" />
          <div v-else class="harness-loading">正在连接 DeepSeek Harness...</div>
        </div>
      </section>

      <section class="right-panel preview-panel">
        <div class="panel-header">
          <div class="preview-title"><span>实时预览</span><el-tag size="small" :type="previewReady ? 'success' : 'warning'">{{ previewReady ? '已就绪' : '编译中' }}</el-tag></div>
          <div class="preview-actions">
            <div class="ratio-group"><el-input v-model="previewRatioWidth" size="small" clearable class="ratio-field" placeholder="宽" /><span>:</span><el-input v-model="previewRatioHeight" size="small" clearable class="ratio-field" placeholder="高" /></div>
            <el-button text :icon="RefreshRight" @click="refreshPreview()">刷新</el-button>
          </div>
        </div>
        <div class="preview-wrapper" :class="{ 'has-custom-ratio': !!previewRatioValue }">
          <div class="preview-stage" :style="previewStageStyle">
            <iframe v-if="previewBootstrapped" ref="previewIframeRef" :src="previewUrl" class="preview-frame" sandbox="allow-scripts allow-same-origin allow-forms" @load="onPreviewLoad" @error="onPreviewError" />
            <div v-if="previewMaskVisible" class="panel-mask"><div class="preview-glass"><div class="glass-dots"><i v-for="dot in 9" :key="dot" class="glass-dot" /></div><div>{{ previewMaskText }}</div></div></div>
          </div>
          <div v-if="previewFatal" class="preview-fallback"><el-result icon="error" title="预览暂不可用" sub-title="系统正在后台重试，你也可以手动刷新。"><template #extra><el-button type="primary" @click="refreshPreview()">手动刷新</el-button></template></el-result></div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, RefreshRight } from '@element-plus/icons-vue'
import axios from 'axios'
import { getAuthHeader, getToken, getUserInfo } from '@/utils/auth'
import { getFlashHarnessEventKey, isFlashHarnessChangeMessage, isTrustedFlashHarnessMessage } from '@/services/flash-builder-harness-bridge.js'
import { prepareHarnessAuth } from '../../../eiscore-base/src/services/harness-auth-client.js'
import {
  DEFAULT_FLASH_BUILDER_DRAFT_SOURCE as DEFAULT_FLASH_DRAFT_SOURCE,
  buildFlashBuilderConfig,
  buildFlashDraftFromPublishedHtml,
  buildFlashSourceCodeWithDraft,
  normalizeFlashConfig as normalizeConfig,
  normalizeFlashDraftSourceText as normalizeDraftSourceText,
  normalizeFlashSourceCode as normalizeSourceCode,
  resolveFlashDraftIsolation,
  stripFlashSourceMapMarkers as stripSourceMapMarkers
} from '@/domain/flash-builder-draft-policy'
import { buildFlashPreviewStageStyle, buildFlashSourceSnapshotHtml, parseFlashPreviewRatio, sanitizeFlashPreviewSnapshotHtml } from '@/domain/flash-builder-preview-policy'

const route = useRoute()
const router = useRouter()
const appId = computed(() => String(route.params.appId || '').trim())
const appData = ref(null)
const saving = ref(false)
const publishing = ref(false)
const modeLabel = 'Harness iframe'
const DRAFT_FILE_PATH = 'src/views/drafts/FlashDraft.vue'
const DRAFT_ROOT_PATH = 'src/views/drafts'
const PREVIEW_ROUTE = '/apps/preview/flash-draft'
const PREVIEW_ENTRY = '/apps/index.html?eis_flash_preview=1'

const harnessFrameRef = ref(null)
const harnessAuthReady = ref(false)
const harnessFrameFailed = ref(false)
const harnessSessionId = computed(() => `flash-${String(appId.value || 'default').replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 96))
const harnessFrameUrl = '/harness-flash-embed/#flash-builder'
const harnessFrameSrc = computed(() => {
  const base = harnessFrameUrl
  return `${base.split('#')[0]}?eiscoreAppId=${encodeURIComponent(appId.value)}&eiscoreSessionId=${encodeURIComponent(harnessSessionId.value)}#flash-builder`
})
const previewIframeRef = ref(null)
const previewNonce = ref(Date.now())
const previewReady = ref(false)
const previewBootstrapped = ref(false)
const previewMaskVisible = ref(true)
const previewMaskText = ref('正在加载预览...')
const previewFatal = ref(false)
const previewRetries = ref(0)
const previewRatioWidth = ref('')
const previewRatioHeight = ref('')
let previewRetryTimer = null
let draftPollTimer = null
let draftPollBusy = false
let lastObservedDraft = ''
let authRequestId = 0
const processedHarnessEventKeys = new Set()

const previewUrl = computed(() => `${PREVIEW_ENTRY}&appId=${encodeURIComponent(appId.value)}&_t=${previewNonce.value}`)
const previewRatioValue = computed(() => parseFlashPreviewRatio(previewRatioWidth.value, previewRatioHeight.value))
const previewStageStyle = computed(() => buildFlashPreviewStageStyle(previewRatioValue.value))

const user = () => {
  try { const value = getUserInfo() || {}; return { username: String(value.username || '').trim() || 'unknown', appRole: String(value.app_role || value.role || '').trim() || 'unknown' } } catch { return { username: 'unknown', appRole: 'unknown' } }
}
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const writeTools = new Set(['flash.draft.write', 'flash.app.save', 'flash.app.publish', 'flash.route.upsert', 'flash.audit.write'])

const callFlashTool = async (toolId, args = {}, options = {}) => {
  const token = getToken()
  if (!token) throw new Error('缺少登录令牌，请重新登录')
  const sessionId = options.sessionId || harnessSessionId.value || 'default'
  const targetAppId = options.appId || appId.value || String(args.appId || '')
  const payload = {
    trace_id: options.traceId || id('tr'), tool_id: toolId, session_id: sessionId, app_id: targetAppId,
    arguments: args, context: { source: 'flash_builder_harness_embed', mode: 'harness-embed', app_id: targetAppId, session_id: sessionId, user_role: user().appRole }
  }
  if (writeTools.has(toolId) || options.write === true) { payload.confirmed = true; payload.idempotency_key = options.idempotencyKey || id('idem') }
  try {
    const response = await axios.post('/flash/tools/call', payload, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: options.timeout || 120000 })
    if (response?.data?.ok === false) throw new Error(String(response.data.message || response.data.code || '工具调用失败'))
    return response.data || {}
  } catch (error) { throw new Error(String(error?.response?.data?.message || error?.message || '工具调用失败')) }
}

const extractPublishedBodyHtml = (rawHtml) => {
  const source = stripSourceMapMarkers(rawHtml)
  if (!source) return ''
  if (typeof DOMParser !== 'undefined') { try { const doc = new DOMParser().parseFromString(source, 'text/html'); doc.querySelectorAll('script,noscript').forEach((node) => node.remove()); return String(doc.body?.innerHTML || '').trim() } catch {} }
  const clean = source.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
  return String(clean.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || clean).trim()
}
const draftFromPublished = (html) => buildFlashDraftFromPublishedHtml(html, { extractBody: extractPublishedBodyHtml })
const draftRead = async () => String((await callFlashTool('flash.draft.read', { appId: appId.value }, { write: false }))?.data?.content || '')
const sourceWithDraft = (base, draft, extraFlash = {}) => buildFlashSourceCodeWithDraft(base, draft, { draftFile: DRAFT_FILE_PATH, updatedAt: new Date().toISOString(), extraFlash })

const persistDraftSourceToApp = async (draft, row = appData.value) => {
  const result = await callFlashTool('flash.app.save', { appId: appId.value, payload: { source_code: sourceWithDraft(normalizeSourceCode(row?.source_code), draft), updated_at: new Date().toISOString() } })
  if (result?.data?.item) appData.value = result.data.item
}
const syncDraft = async () => { const draft = normalizeDraftSourceText(await draftRead()); if (draft) await persistDraftSourceToApp(draft); return draft }
const pollHarnessDraft = async () => {
  if (draftPollBusy || !appId.value) return
  draftPollBusy = true
  try {
    const draft = normalizeDraftSourceText(await draftRead())
    if (!draft) return
    if (!lastObservedDraft) {
      lastObservedDraft = draft
      return
    }
    if (draft === lastObservedDraft) return
    lastObservedDraft = draft
    await persistDraftSourceToApp(draft)
    refreshPreview('Harness 已写入草稿，正在刷新预览...')
  } catch {
    // The builder can continue using the last rendered draft while the next poll retries.
  } finally {
    draftPollBusy = false
  }
}
const startDraftPolling = () => {
  if (draftPollTimer || !appId.value) return
  draftPollTimer = window.setInterval(() => { void pollHarnessDraft() }, 1200)
}
const stopDraftPolling = () => {
  if (draftPollTimer) window.clearInterval(draftPollTimer)
  draftPollTimer = null
}
const applyDraftIsolation = async (row) => {
  const { savedDraft, targetDraft: storedDraft, reason } = resolveFlashDraftIsolation(row, { defaultDraft: DEFAULT_FLASH_DRAFT_SOURCE, buildLegacyDraft: draftFromPublished })
  if (!storedDraft) return
  let remote = ''; try { remote = normalizeDraftSourceText(await draftRead()) } catch {}
  // Harness writes land in the scoped file before the builder receives any UI
  // event. Preserve that newer file and only seed it from app metadata when it
  // does not exist yet.
  const targetDraft = remote || storedDraft
  if (!remote) await callFlashTool('flash.draft.write', { appId: appId.value, content: targetDraft, reason })
  if (!savedDraft || remote !== storedDraft) await persistDraftSourceToApp(targetDraft, row)
  previewBootstrapped.value = true
  lastObservedDraft = normalizeDraftSourceText(targetDraft)
}
const flashConfig = (base) => buildFlashBuilderConfig(base, { draftRoot: DRAFT_ROOT_PATH, draftFile: DRAFT_FILE_PATH, previewRoute: PREVIEW_ROUTE, updatedAt: new Date().toISOString() })
const audit = async (taskId, status, output = {}) => { try { await callFlashTool('flash.audit.write', { payload: { app_id: appId.value, task_id: taskId, status, output_data: output, executed_by: user().username } }) } catch {} }

const postContext = () => {
  if (!harnessFrameRef.value?.contentWindow || !appId.value) return
  harnessFrameRef.value.contentWindow.postMessage({ source: 'eiscore-flash-builder', type: 'flash:context', protocolVersion: 1, appId: appId.value, sessionId: harnessSessionId.value }, window.location.origin)
}
const onHarnessFrameLoad = () => { harnessFrameFailed.value = false; postContext() }
const onHarnessFrameError = () => { harnessFrameFailed.value = true }
const handleHarnessMessage = async (event) => {
  if (!isTrustedFlashHarnessMessage(event, { origin: window.location.origin, frameWindow: harnessFrameRef.value?.contentWindow, appId: appId.value, sessionId: harnessSessionId.value })) return
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  if (data.type === 'ready' || data.type === 'flash:harness:ready') { postContext(); return }
  if (!isFlashHarnessChangeMessage(data)) return
  const key = getFlashHarnessEventKey(data)
  if (key && processedHarnessEventKeys.has(key)) return
  if (key) {
    processedHarnessEventKeys.add(key)
    if (processedHarnessEventKeys.size > 100) processedHarnessEventKeys.delete(processedHarnessEventKeys.values().next().value)
  }
  previewMaskText.value = '草稿已更新，正在刷新预览...'
  previewMaskVisible.value = true
  try { await syncDraft(); refreshPreview('正在呈现最新草稿...') } catch (error) { previewMaskVisible.value = false; ElMessage.warning(`草稿同步失败：${error.message}`) }
}
const prepareHarnessFrame = async () => {
  const requestId = ++authRequestId
  harnessAuthReady.value = false; harnessFrameFailed.value = false
  const ready = await prepareHarnessAuth({ harnessWebUrl: '/harness-flash-embed/', authApiPrefix: '/harness-flash-embed-api', authorization: getAuthHeader().Authorization || '' })
  if (requestId !== authRequestId) return
  if (!ready) { harnessAuthReady.value = false; harnessFrameFailed.value = true; return }
  // The route is also used as a capability entry from the function-point
  // smoke test. Without an app id there is no scoped session or draft to
  // register; keep the generic Harness shell usable and defer app work until
  // the user enters through a concrete application.
  if (!appId.value) {
    harnessAuthReady.value = true
    harnessFrameFailed.value = false
    return
  }
  try {
    await axios['post']('/flash-agent/internal/harness/session', {
      session_id: harnessSessionId.value,
      app_id: appId.value
    }, { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }, timeout: 15000 })
    harnessAuthReady.value = true; harnessFrameFailed.value = false
  } catch (error) {
    harnessAuthReady.value = false; harnessFrameFailed.value = true
    throw new Error(String(error?.response?.data?.message || error?.message || 'Harness 会话注册失败'))
  }
}

const beginMask = (text) => { previewMaskText.value = text; previewMaskVisible.value = true }
const endMask = () => { window.setTimeout(() => { previewMaskVisible.value = false; previewMaskText.value = '正在加载预览...' }, 420) }
const clearRetry = () => { if (previewRetryTimer) clearTimeout(previewRetryTimer); previewRetryTimer = null }
const previewReadyCheck = () => { try { const root = previewIframeRef.value?.contentDocument?.getElementById('app'); return !!root && (root.childElementCount > 0 || String(root.textContent || '').trim()) } catch { return false } }
const onPreviewLoad = async () => { const deadline = Date.now() + 4500; while (Date.now() < deadline && !previewReadyCheck()) await new Promise((resolve) => setTimeout(resolve, 160)); if (!previewReadyCheck()) { previewReady.value = false; if (previewRetries.value++ < 8) previewRetryTimer = setTimeout(() => { previewNonce.value = Date.now() }, 500); else { previewFatal.value = true; previewMaskText.value = '预览加载失败，请稍后重试' }; return } previewReady.value = true; previewFatal.value = false; previewRetries.value = 0; endMask() }
const onPreviewError = () => { previewReady.value = false; if (previewRetries.value++ < 8) previewRetryTimer = setTimeout(() => { previewNonce.value = Date.now() }, 500); else previewFatal.value = true }
const refreshPreview = (text = '正在刷新预览...') => {
  clearRetry()
  if (!appId.value) {
    previewBootstrapped.value = false
    previewReady.value = false
    previewFatal.value = false
    previewMaskVisible.value = false
    return
  }
  beginMask(text)
  previewReady.value = false
  previewFatal.value = false
  previewBootstrapped.value = true
  previewNonce.value = Date.now()
}
const waitPreview = async () => { if (previewReady.value && !previewFatal.value) return true; refreshPreview(); const deadline = Date.now() + 12000; while (Date.now() < deadline) { if (previewReady.value && !previewFatal.value) return true; await new Promise((resolve) => setTimeout(resolve, 280)) } return false }
const snapshot = () => { try { return sanitizeFlashPreviewSnapshotHtml(String(previewIframeRef.value?.contentDocument?.documentElement?.outerHTML || ''), { parseDocument: (source) => new DOMParser().parseFromString(source, 'text/html') }) } catch { return '' } }
const loadApp = async () => {
  if (!appId.value) {
    appData.value = null
    return
  }
  const result = await callFlashTool('flash.app.detail', { appId: appId.value, query: { limit: '1' } })
  appData.value = result?.data?.item || null
  await applyDraftIsolation(appData.value)
}
const saveApp = async () => { if (!appData.value) return; saving.value = true; try { const draft = normalizeDraftSourceText(await draftRead()); const result = await callFlashTool('flash.app.save', { appId: appId.value, payload: { config: flashConfig(normalizeConfig(appData.value.config)), source_code: sourceWithDraft(normalizeSourceCode(appData.value.source_code), draft), updated_at: new Date().toISOString() } }); if (result?.data?.item) appData.value = result.data.item; await audit('flash_save', 'completed'); ElMessage.success('配置已保存') } catch (error) { await audit('flash_save', 'failed', { error: error.message }); ElMessage.error(`保存失败：${error.message}`) } finally { saving.value = false } }
const publishApp = async () => { if (!appData.value) return; publishing.value = true; try { const draft = normalizeDraftSourceText(await draftRead()); if (!draft || !/<template[\s>]/i.test(draft)) throw new Error('草稿源码为空或缺少 template，无法发布。'); await waitPreview(); const html = snapshot() || buildFlashSourceSnapshotHtml(draft, { title: appData.value.name || '闪念应用' }); const now = new Date().toISOString(); const seed = sourceWithDraft(normalizeSourceCode(appData.value.source_code), draft); const config = flashConfig(normalizeConfig(appData.value.config)); config.flash = { ...(config.flash || {}), validatedAt: now, publishedAt: now, publishedBy: user().username }; await callFlashTool('flash.app.publish', { appId: appId.value, payload: { status: 'published', config, source_code: { ...seed, flash: { ...(seed.flash || {}), published_draft_source: draft, published_html: html, published_at: now, published_by: user().username } }, updated_at: now } }); const route = await callFlashTool('flash.route.resolve', { appId: appId.value, query: { order: 'id.desc', limit: '1' } }, { write: false }); await callFlashTool('flash.route.upsert', { id: route?.data?.item?.id || '', appId: appId.value, routePath: `/apps/app/${appId.value}?flash=1`, is_active: true }); await audit('flash_publish', 'completed', { publishedAt: now }); ElMessage.success('已完成校验并发布'); router.push({ path: `/app/${appId.value}`, query: { flash: '1' } }) } catch (error) { await audit('flash_publish', 'failed', { error: error.message }); ElMessage.error(`发布失败：${error.message}`) } finally { publishing.value = false } }
const goBack = () => router.push('/')

watch(appId, async (next, previous) => { if (!next || next === previous) return; stopDraftPolling(); lastObservedDraft = ''; appData.value = null; previewReady.value = false; beginMask('正在切换闪念应用...'); await Promise.all([loadApp(), prepareHarnessFrame()]); postContext(); refreshPreview(); startDraftPolling() })
onMounted(async () => { window.addEventListener('message', handleHarnessMessage); beginMask('正在加载预览...'); try { await Promise.all([loadApp(), prepareHarnessFrame()]); refreshPreview(); startDraftPolling() } catch (error) { harnessFrameFailed.value = true; ElMessage.error(`加载闪念失败：${error.message}`); previewBootstrapped.value = true; startDraftPolling() } })
onUnmounted(() => {
  window.removeEventListener('message', handleHarnessMessage); authRequestId += 1; clearRetry(); stopDraftPolling()
  if (appId.value && harnessSessionId.value) axios['delete']('/flash-agent/internal/harness/session', {
    method: 'DELETE', url: '/flash-agent/internal/harness/session', params: { session_id: harnessSessionId.value }, headers: getAuthHeader(), timeout: 5000
  }).catch(() => {})
})
</script>

<style scoped>
.flash-builder { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--el-bg-color-page); }
.builder-header { height: 64px; flex: 0 0 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-light); }
.header-left, .header-right, .preview-title, .preview-actions, .ratio-group { display: flex; align-items: center; }
.header-left, .header-right { gap: 12px; } .header-left h2 { margin: 0; font-size: 18px; font-weight: 600; }
.builder-content { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(420px, 42%) minmax(0, 58%); margin: 12px 20px 20px; border: 1px solid var(--el-border-color-light); border-radius: 12px; overflow: hidden; background: var(--el-bg-color); }
.left-panel, .right-panel { min-width: 0; min-height: 0; overflow: hidden; } .harness-panel, .preview-panel { display: flex; flex-direction: column; }
.harness-panel { border-right: 1px solid var(--el-border-color-light); } .panel-header { height: 44px; flex: 0 0 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid var(--el-border-color-light); }
.harness-frame-wrap { flex: 1; min-height: 0; position: relative; background: var(--el-bg-color-page); } .harness-frame { width: 100%; height: 100%; border: 0; } .harness-loading { position: absolute; inset: 0; display: grid; place-items: center; color: var(--el-text-color-secondary); }
.preview-title { gap: 8px; font-size: 13px; } .preview-actions { gap: 12px; } .ratio-group { gap: 6px; } .ratio-field { width: 56px; }
.preview-wrapper { position: relative; flex: 1; min-height: 0; display: flex; overflow: hidden; padding: 8px; } .preview-wrapper.has-custom-ratio { align-items: center; justify-content: center; padding: 14px 16px 16px; }
.preview-stage { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--el-bg-color); } .preview-frame { width: 100%; height: 100%; border: 0; }
.panel-mask { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.22); backdrop-filter: blur(12px); } .preview-glass { width: min(72%, 560px); min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; border: 1px solid rgba(255,255,255,.42); border-radius: 16px; background: rgba(255,255,255,.72); box-shadow: 0 12px 36px rgba(15,23,42,.18); }
.glass-dots { display: flex; gap: 8px; } .glass-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--el-color-primary); animation: pulse 1s ease-in-out infinite; } .glass-dot:nth-child(2) { animation-delay: .08s; } .glass-dot:nth-child(3) { animation-delay: .16s; } .glass-dot:nth-child(4) { animation-delay: .24s; } .glass-dot:nth-child(5) { animation-delay: .32s; } .glass-dot:nth-child(6) { animation-delay: .4s; } .glass-dot:nth-child(7) { animation-delay: .48s; } .glass-dot:nth-child(8) { animation-delay: .56s; } .glass-dot:nth-child(9) { animation-delay: .64s; }
.preview-fallback { position: absolute; inset: 0; z-index: 4; background: var(--el-bg-color); } @keyframes pulse { 0%,100% { opacity: .35; transform: translateY(0); } 45% { opacity: 1; transform: translateY(-4px); } }
@media (max-width: 1280px) { .builder-content { grid-template-columns: 1fr; grid-template-rows: minmax(360px, 1fr) minmax(360px, 1fr); } .harness-panel { border-right: 0; border-bottom: 1px solid var(--el-border-color-light); } }
@media (max-width: 760px) { .builder-header { height: auto; min-height: 64px; flex-wrap: wrap; gap: 8px; padding: 10px 12px; } .header-right { margin-left: auto; } .builder-content { margin: 10px 12px 12px; } }
</style>
