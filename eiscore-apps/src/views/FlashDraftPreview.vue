<template>
  <div class="flash-preview-runtime">
    <component v-if="runtimeComponent" :is="runtimeComponent" />
    <div v-else class="flash-preview-state">
      <div class="state-title">{{ errorText ? '预览加载失败' : '正在加载预览...' }}</div>
      <pre v-if="errorText" class="state-error">{{ errorText }}</pre>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import * as VueRuntime from 'vue'
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from 'vue'
import { compile } from '@vue/compiler-dom'
import { useRoute } from 'vue-router'

const route = useRoute()
const runtimeComponent = ref(null)
const errorText = ref('')
let styleNode = null

const DEFAULT_FLASH_DRAFT_SOURCE = `<template>
  <div class="flash-draft-page">
    <section class="hero">
      <div class="hero-badge">Flash Builder</div>
      <h1>闪念应用草稿画板</h1>
      <p>在左侧描述你的需求，智能体会持续生成并优化这里的页面效果。</p>
    </section>
  </div>
</template>
<style scoped>
.flash-draft-page { min-height: 100vh; padding: 36px; color: #0f172a; background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%); font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
.hero { max-width: 860px; margin: 0 auto; padding: 34px 30px; border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 20px; background: rgba(255, 255, 255, 0.78); box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08); }
.hero-badge { width: fit-content; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #1d4ed8; background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.22); }
.hero h1 { margin: 14px 0 10px; font-size: 38px; line-height: 1.15; }
.hero p { margin: 0; font-size: 17px; color: #475569; }
</style>`

const appId = computed(() => String(route.query.appId || route.query.app_id || '').trim())

const readAuthToken = () => {
  const raw = localStorage.getItem('auth_token')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) return String(parsed.token)
  } catch {
    // fallback to raw token
  }
  return String(raw)
}

const getDraftUrls = () => {
  const query = appId.value ? `?appId=${encodeURIComponent(appId.value)}` : ''
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
  const hostname = window.location.hostname || 'localhost'
  return Array.from(new Set([
    `/agent/flash/draft${query}`,
    `${protocol}://${hostname}:8078/flash/draft${query}`
  ]))
}

const fetchDraftSource = async () => {
  const token = readAuthToken()
  let lastError = null
  for (const url of getDraftUrls()) {
    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store'
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.message || `HTTP ${response.status}`)
      return String(result?.content || result?.data?.content || '')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('读取草稿失败')
}

const extractBlock = (source, tag) => {
  const match = String(source || '').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? String(match[1] || '').trim() : ''
}

const extractScriptBlocks = (source) => {
  let normal = ''
  let setup = ''
  String(source || '').replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs = '', content = '') => {
    if (/\bsetup\b/i.test(String(attrs))) {
      setup = String(content || '').trim()
    } else {
      normal = String(content || '').trim()
    }
    return ''
  })
  return { normal, setup }
}

const extractStyles = (source) => {
  const styles = []
  String(source || '').replace(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_, css = '') => {
    if (String(css).trim()) styles.push(String(css).trim())
    return ''
  })
  return styles.join('\n\n')
}

const stripImports = (source) => String(source || '')
  .replace(/^\s*import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
  .replace(/^\s*import\s+['"].*?['"];?\s*$/gm, '')

const buildVuePrelude = () => (
  'const { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted, nextTick, defineComponent, h } = Vue;'
)

const collectSetupBindings = (source) => {
  const names = new Set()
  String(source || '').replace(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, (_, name) => {
    names.add(name)
    return ''
  })
  String(source || '').replace(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g, (_, name) => {
    names.add(name)
    return ''
  })
  return Array.from(names)
}

const evaluateScript = ({ normal, setup }) => {
  const setupSource = stripImports(setup).trim()
  if (setupSource) {
    const bindings = collectSetupBindings(setupSource)
    const returnLine = `return { ${bindings.join(', ')} };`
    return {
      setup: new Function('Vue', `${buildVuePrelude()}\n${setupSource}\n${returnLine}`).bind(null, VueRuntime)
    }
  }

  const source = String(normal || '').trim()
  if (!source) return {}
  const normalized = stripImports(source)
    .replace(/export\s+default/, 'return')
  return new Function('Vue', `${buildVuePrelude()}\n${normalized}`)(VueRuntime) || {}
}

const installStyle = (cssText) => {
  if (styleNode) {
    styleNode.remove()
    styleNode = null
  }
  if (!String(cssText || '').trim()) return
  styleNode = document.createElement('style')
  styleNode.setAttribute('data-flash-preview-style', appId.value || 'default')
  styleNode.textContent = cssText
  document.head.appendChild(styleNode)
}

const loadDraft = async () => {
  errorText.value = ''
  try {
    let source = ''
    try {
      source = await fetchDraftSource()
    } catch (error) {
      source = DEFAULT_FLASH_DRAFT_SOURCE
    }
    if (!String(source || '').trim()) source = DEFAULT_FLASH_DRAFT_SOURCE
    const template = extractBlock(source, 'template')
    if (!template) throw new Error('草稿缺少 <template> 内容')
    const componentOptions = evaluateScript(extractScriptBlocks(source))
    const render = new Function('Vue', compile(template, { mode: 'function' }).code)(VueRuntime)
    installStyle(extractStyles(source))
    runtimeComponent.value = markRaw({
      name: componentOptions.name || 'FlashDraftDynamicPreview',
      ...componentOptions,
      render
    })
  } catch (error) {
    errorText.value = String(error?.message || error || '预览加载失败')
  }
}

watch(() => route.fullPath, loadDraft)
onMounted(loadDraft)
onUnmounted(() => {
  if (styleNode) styleNode.remove()
})
</script>

<style scoped>
.flash-preview-runtime {
  min-height: 100vh;
}

.flash-preview-state {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  color: #475569;
  background: #f8fafc;
}

.state-title {
  font-size: 16px;
  font-weight: 700;
}

.state-error {
  max-width: 760px;
  margin-top: 12px;
  padding: 14px;
  overflow: auto;
  color: #991b1b;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  white-space: pre-wrap;
}
</style>
