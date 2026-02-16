<template>
  <el-dialog
    :model-value="visible"
    width="760px"
    title="地图定位"
    top="6vh"
    destroy-on-close
    @close="closeDialog"
  >
    <div class="geo-body">
      <div class="geo-map" ref="mapRef"></div>
      <div class="geo-form">
        <div class="geo-actions">
          <el-button type="primary" :loading="locating" @click="locateCurrent">定位当前</el-button>
          <el-button :loading="ipLocating" @click="locateByIp">仅用IP定位</el-button>
          <el-button @click="clearForm">清空</el-button>
        </div>

        <div class="geo-inputs">
          <div class="geo-address-row">
            <el-input v-model="form.address" placeholder="大概地址（可手动填写）" :disabled="!allowAddress" />
            <span v-if="aiLocating" class="geo-ai-status">AI识别中...</span>
            <span v-else-if="form.aiAddress" class="geo-ai-status">AI：{{ form.aiAddress }}</span>
          </div>
          <div class="geo-coords">
            <el-input :model-value="form.lng" placeholder="经度" :readonly="true" :disabled="true" :input-style="readonlyInputStyle" />
            <el-input :model-value="form.lat" placeholder="纬度" :readonly="true" :disabled="true" :input-style="readonlyInputStyle" />
          </div>
          <div class="geo-ip-block">
            <div class="geo-ip-title">IP定位</div>
            <el-input :model-value="form.ipAddress" placeholder="IP位置（城市级）" :readonly="true" :disabled="true" :input-style="readonlyInputStyle" />
            <div class="geo-coords">
              <el-input :model-value="form.ipLng" placeholder="IP经度" :readonly="true" :disabled="true" :input-style="readonlyInputStyle" />
              <el-input :model-value="form.ipLat" placeholder="IP纬度" :readonly="true" :disabled="true" :input-style="readonlyInputStyle" />
            </div>
            <el-input :model-value="form.ip" placeholder="IP地址" :readonly="true" :disabled="true" :input-style="readonlyInputStyle" />
          </div>
        </div>

        <div class="geo-footer">
          <el-button type="primary" @click="submitLocation">提交定位</el-button>
          <el-button @click="closeDialog">取消</el-button>
        </div>

        <p class="geo-tip">提示：优先GPS定位，失败会自动尝试IP定位。</p>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import html2canvas from 'html2canvas'

const props = defineProps({
  visible: { type: Boolean, default: false },
  params: { type: Object, default: null }
})

const emit = defineEmits(['update:visible', 'submit'])

const mapRef = ref(null)
const mapInstance = ref(null)
const markerInstance = ref(null)

const locating = ref(false)
const ipLocating = ref(false)
const aiLocating = ref(false)

const form = reactive({
  lng: '',
  lat: '',
  address: '',
  aiAddress: '',
  ip: '',
  source: '',
  ipLng: '',
  ipLat: '',
  ipAddress: '',
  ipSource: ''
})

const translationCache = new Map()

const allowAddress = computed(() => {
  const colDef = props.params?.colDef || {}
  return colDef.geoAddress !== false
})

const readonlyInputStyle = {
  backgroundColor: '#f5f7fa',
  cursor: 'not-allowed'
}

const normalizeNumber = (val) => {
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

const parseGeoValue = (value) => {
  if (value === null || value === undefined || value === '') return {}
  if (typeof value === 'string') return { address: value }
  if (typeof value === 'object') return value
  return {}
}

const fillForm = (value) => {
  const data = parseGeoValue(value)
  form.lng = data.lng ?? data.longitude ?? ''
  form.lat = data.lat ?? data.latitude ?? ''
  form.address = data.address ?? ''
  form.aiAddress = data.ai_address ?? data.aiAddress ?? ''
  form.ip = data.ip ?? ''
  form.source = data.source ?? ''
  form.ipLng = data.ip_lng ?? data.ipLng ?? ''
  form.ipLat = data.ip_lat ?? data.ipLat ?? ''
  form.ipAddress = data.ip_address ?? data.ipAddress ?? ''
  form.ipSource = data.ip_source ?? data.ipSource ?? ''
}

const getGeoConfig = () => {
  const colCfg = props.params?.colDef?.geoConfig || {}
  const globalCfg = typeof window !== 'undefined' ? (window.__EIS_GEO_CONFIG__ || {}) : {}
  const tileToken = colCfg.tileToken || globalCfg.tileToken || ''
  let tileUrl = colCfg.tileUrl || globalCfg.tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  if (tileToken && tileUrl.includes('{tk}')) tileUrl = tileUrl.replace('{tk}', tileToken)
  if (tileToken && tileUrl.includes('{token}')) tileUrl = tileUrl.replace('{token}', tileToken)
  return {
    tileUrl,
    tileSubdomains: colCfg.tileSubdomains || globalCfg.tileSubdomains || ['a', 'b', 'c'],
    tileMaxZoom: colCfg.tileMaxZoom || globalCfg.tileMaxZoom || 19,
    ipApiUrl: colCfg.ipApiUrl || globalCfg.ipApiUrl || 'https://ipapi.co/json/',
    reverseApiUrl: colCfg.reverseApiUrl || globalCfg.reverseApiUrl || '',
    lang: colCfg.lang || globalCfg.lang || 'zh-CN',
    ipLangParam: colCfg.ipLangParam || globalCfg.ipLangParam || 'lang',
    reverseLangParam: colCfg.reverseLangParam || globalCfg.reverseLangParam || 'accept-language',
    translateApiUrl: colCfg.translateApiUrl || globalCfg.translateApiUrl || '',
    translateMethod: colCfg.translateMethod || globalCfg.translateMethod || 'post',
    translateLang: colCfg.translateLang || globalCfg.translateLang || 'zh-CN',
    translateTextField: colCfg.translateTextField || globalCfg.translateTextField || 'q',
    translateSourceField: colCfg.translateSourceField || globalCfg.translateSourceField || 'source',
    translateTargetField: colCfg.translateTargetField || globalCfg.translateTargetField || 'target',
    translateExtra: colCfg.translateExtra || globalCfg.translateExtra || {},
    translateResultField: colCfg.translateResultField || globalCfg.translateResultField || '',
    translateProvider: colCfg.translateProvider || globalCfg.translateProvider || 'glm',
    translatePrompt: colCfg.translatePrompt || globalCfg.translatePrompt || '',
    mapAiPrompt: colCfg.mapAiPrompt || globalCfg.mapAiPrompt || '',
    mapImageDelay: colCfg.mapImageDelay || globalCfg.mapImageDelay || 800
  }
}

const ensureMap = async () => {
  if (mapInstance.value || !mapRef.value) return
  const config = getGeoConfig()
  mapInstance.value = L.map(mapRef.value, { zoomControl: true })
  L.tileLayer(config.tileUrl, {
    subdomains: config.tileSubdomains,
    maxZoom: config.tileMaxZoom,
    crossOrigin: true
  }).addTo(mapInstance.value)
}

const createMarkerIcon = () => L.divIcon({
  className: 'geo-marker-dot',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
})

const updateMarker = (lat, lng) => {
  if (!mapInstance.value) return
  if (!markerInstance.value) {
    markerInstance.value = L.marker([lat, lng], {
      draggable: false,
      icon: createMarkerIcon()
    }).addTo(mapInstance.value)
  } else {
    markerInstance.value.setLatLng([lat, lng])
  }
  mapInstance.value.setView([lat, lng], 13)
}

const setLocation = (payload) => {
  if (!payload) return
  form.lng = payload.lng ?? payload.longitude ?? ''
  form.lat = payload.lat ?? payload.latitude ?? ''
  if (allowAddress.value && Object.prototype.hasOwnProperty.call(payload, 'address')) {
    form.address = payload.address ? String(payload.address) : ''
  }
  if (payload.source) form.source = payload.source
  const lat = normalizeNumber(form.lat)
  const lng = normalizeNumber(form.lng)
  if (lat !== null && lng !== null) updateMarker(lat, lng)
}

const setIpMeta = (payload) => {
  if (!payload) return
  form.ip = payload.ip || form.ip
  form.ipLng = payload.lng ?? payload.longitude ?? form.ipLng
  form.ipLat = payload.lat ?? payload.latitude ?? form.ipLat
  if (payload.address) form.ipAddress = payload.address
  if (payload.source) form.ipSource = payload.source
}

const hasChinese = (text) => /[\u4e00-\u9fa5]/.test(String(text || ''))

const extractAddress = (data) => {
  if (!data || typeof data !== 'object') return ''
  return (
    data.display_name ||
    data.formatted_address ||
    data.address ||
    data?.regeocode?.formatted_address ||
    data?.result?.address ||
    ''
  )
}

const buildIpAddress = (data) => {
  if (!data || typeof data !== 'object') return ''
  const parts = []
  if (data.country) parts.push(data.country)
  if (data.region) parts.push(data.region)
  if (data.province) parts.push(data.province)
  if (data.city) parts.push(data.city)
  if (data.district) parts.push(data.district)
  return parts.join('')
}

const parseIpLocation = (data) => {
  if (!data || typeof data !== 'object') return null
  const lat = normalizeNumber(data.lat ?? data.latitude ?? data.location?.lat)
  const lng = normalizeNumber(data.lon ?? data.lng ?? data.longitude ?? data.location?.lng)
  if (lat === null || lng === null) return null
  const address = extractAddress(data) || buildIpAddress(data)
  const ip = data.ip || data.query || ''
  return { lat, lng, address, ip, source: 'ip' }
}

const appendLangParam = (url, key, lang) => {
  if (!url || !lang) return url
  if (url.includes('{lang}')) {
    return url.replace('{lang}', encodeURIComponent(lang))
  }
  const pattern = new RegExp(`[?&]${key}=`, 'i')
  if (pattern.test(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${key}=${encodeURIComponent(lang)}`
}

const extractTranslation = (data, resultField) => {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) {
    const item = data[0]
    if (typeof item === 'string') return item
    if (item?.translatedText) return item.translatedText
  }
  if (data.translatedText) return data.translatedText
  if (data.translation) return data.translation
  if (data.result?.translatedText) return data.result.translatedText
  if (data.data?.translations?.[0]?.translatedText) return data.data.translations[0].translatedText
  if (resultField) {
    return resultField.split('.').reduce((acc, key) => acc?.[key], data) || ''
  }
  return ''
}

const getAuthToken = () => {
  const tokenStr = localStorage.getItem('auth_token')
  if (!tokenStr) return ''
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed?.token) return parsed.token
  } catch (e) {
    // ignore
  }
  return tokenStr
}

const buildAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const translateWithGlm = async (text) => {
  const trimmed = text ? String(text).trim() : ''
  if (!trimmed) return ''
  const cached = translationCache.get(trimmed)
  if (cached) return cached
  const systemPrompt = `你是翻译助手。把用户输入翻译成简洁、自然的中文地址，只输出翻译结果，不要添加任何解释。若输入已是中文，原样输出。`
  try {
    const res = await fetch('/agent/ai/translate', {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({
        text: trimmed,
        prompt: systemPrompt
      })
    })
    if (!res.ok) return trimmed
    const data = await res.json()
    const finalText = String(data?.text || '').trim() || trimmed
    translationCache.set(trimmed, finalText)
    return finalText
  } catch (e) {
    return trimmed
  }
}

const translateText = async (text) => {
  const config = getGeoConfig()
  const trimmed = text ? String(text).trim() : ''
  if (!trimmed) return ''
  if (translationCache.has(trimmed)) return translationCache.get(trimmed)
  if (config.translateProvider === 'glm' || !config.translateApiUrl) {
    const translated = await translateWithGlm(trimmed)
    translationCache.set(trimmed, translated)
    return translated
  }
  const payload = {
    ...config.translateExtra,
    [config.translateTextField || 'q']: trimmed,
    [config.translateSourceField || 'source']: 'auto',
    [config.translateTargetField || 'target']: config.translateLang || 'zh-CN'
  }
  try {
    if (String(config.translateMethod || 'post').toLowerCase() === 'get') {
      const params = new URLSearchParams(payload).toString()
      const url = config.translateApiUrl.includes('?')
        ? `${config.translateApiUrl}&${params}`
        : `${config.translateApiUrl}?${params}`
      const res = await fetch(url)
      if (!res.ok) return text
      const data = await res.json()
      const translated = extractTranslation(data, config.translateResultField) || trimmed
      translationCache.set(trimmed, translated)
      return translated
    }
    const res = await fetch(config.translateApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) return text
    const data = await res.json()
    const translated = extractTranslation(data, config.translateResultField) || trimmed
    translationCache.set(trimmed, translated)
    return translated
  } catch (e) {
    return text
  }
}

const captureMapSnapshot = async () => {
  if (!mapRef.value) return null
  const config = getGeoConfig()
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, Number(config.mapImageDelay) || 800))
  try {
    const canvas = await html2canvas(mapRef.value, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      scale: 1
    })
    return canvas.toDataURL('image/png')
  } catch (e) {
    return null
  }
}

const askGlmForMapLocation = async (imageUrl, lat, lng) => {
  const config = getGeoConfig()
  const prompt = config.mapAiPrompt || `请根据地图截图上的中文地名，且以蓝色圆点为用户当前位置，找出离蓝点最近的街道级位置。输出严格格式的中文位置：“省-市-区/县/县级市-街道/乡镇”。必须包含街道级；如果无法确定街道，请用“某街道”或“附近街道”占位，但仍要输出四段。只输出位置，不要解释，不要多余的话。坐标：${lng},${lat}`
  try {
    const res = await fetch('/agent/ai/map-locate', {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({
        imageUrl,
        lat,
        lng,
        prompt
      })
    })
    if (!res.ok) return ''
    const data = await res.json()
    return String(data?.address || '').trim()
  } catch (e) {
    return ''
  }
}

const inferAddressFromMap = async (lat, lng) => {
  if (!allowAddress.value || aiLocating.value) return
  aiLocating.value = true
  try {
    const snapshot = await captureMapSnapshot()
    if (!snapshot) return
    const result = await askGlmForMapLocation(snapshot, lat, lng)
    if (!result) return
    form.aiAddress = result
    if (!form.address || !hasChinese(form.address)) {
      form.address = result
    }
  } finally {
    aiLocating.value = false
  }
}

const fetchIpLocation = async () => {
  const config = getGeoConfig()
  if (!config.ipApiUrl) return null
  const ipUrl = appendLangParam(config.ipApiUrl, config.ipLangParam || 'lang', config.lang)
  try {
    const res = await fetch(ipUrl, {
      headers: config.lang ? { 'Accept-Language': config.lang } : {}
    })
    if (!res.ok) return null
    const data = await res.json()
    return parseIpLocation(data)
  } catch (e) {
    return null
  }
}

const fetchReverseAddress = async (lat, lng) => {
  const config = getGeoConfig()
  if (!config.reverseApiUrl) return ''
  let url = config.reverseApiUrl
    .replace('{lat}', encodeURIComponent(String(lat)))
    .replace('{lng}', encodeURIComponent(String(lng)))
  url = appendLangParam(url, config.reverseLangParam || 'accept-language', config.lang)
  try {
    const res = await fetch(url, {
      headers: config.lang ? { 'Accept-Language': config.lang } : {}
    })
    if (!res.ok) return ''
    const data = await res.json()
    return extractAddress(data)
  } catch (e) {
    return ''
  }
}

const ensureChineseAddress = async (address, lat, lng) => {
  if (!allowAddress.value) return ''
  const text = address ? String(address) : ''
  if (text && hasChinese(text)) return text
  const reverse = await fetchReverseAddress(lat, lng)
  if (reverse && hasChinese(reverse)) return reverse
  const source = reverse || text
  if (!source) return ''
  return await translateText(source)
}

const getGpsLocation = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null)
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      source: 'gps'
    }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
  )
})

const locateByIp = async () => {
  ipLocating.value = true
  let ipLoc = await fetchIpLocation()
  ipLocating.value = false
  if (!ipLoc) {
    ElMessage.warning('IP定位失败')
    return
  }
  if (allowAddress.value) {
    const nextAddress = await ensureChineseAddress(ipLoc.address, ipLoc.lat, ipLoc.lng)
    ipLoc = { ...ipLoc, address: nextAddress }
  }
  setIpMeta(ipLoc)
  setLocation(ipLoc)
}

const locateCurrent = async () => {
  locating.value = true
  const ipPromise = fetchIpLocation()
  let location = await getGpsLocation()
  let ipLoc = await ipPromise
  if (location) {
    let address = ''
    if (allowAddress.value) {
      address = await ensureChineseAddress('', location.lat, location.lng)
    }
    location.address = address
    setLocation(location)
    if (allowAddress.value) {
      form.address = address || ''
    }
    form.aiAddress = ''
    if (ipLoc) {
      if (allowAddress.value) {
        const ipAddress = await ensureChineseAddress(ipLoc.address, ipLoc.lat, ipLoc.lng)
        ipLoc = { ...ipLoc, address: ipAddress }
      }
      setIpMeta(ipLoc)
    }
    locating.value = false
    inferAddressFromMap(location.lat, location.lng)
    return
  }
  locating.value = false
  if (!ipLoc) {
    ElMessage.warning('定位失败，请手动填写')
    return
  }
  if (allowAddress.value) {
    const ipAddress = await ensureChineseAddress(ipLoc.address, ipLoc.lat, ipLoc.lng)
    ipLoc = { ...ipLoc, address: ipAddress }
  }
  setIpMeta(ipLoc)
  setLocation(ipLoc)
}

const clearForm = () => {
  form.lng = ''
  form.lat = ''
  form.address = ''
  form.aiAddress = ''
  form.ip = ''
  form.source = ''
  form.ipLng = ''
  form.ipLat = ''
  form.ipAddress = ''
  form.ipSource = ''
  if (markerInstance.value) {
    markerInstance.value.remove()
    markerInstance.value = null
  }
}

const submitLocation = () => {
  const lng = normalizeNumber(form.lng)
  const lat = normalizeNumber(form.lat)
  if (lng === null || lat === null) {
    ElMessage.warning('请填写正确的经纬度')
    return
  }
  const payload = {
    lng,
    lat,
    source: form.source || 'manual'
  }
  if (allowAddress.value && form.address) payload.address = form.address
  if (form.aiAddress) payload.ai_address = form.aiAddress
  if (form.ip) payload.ip = form.ip
  const ipLng = normalizeNumber(form.ipLng)
  const ipLat = normalizeNumber(form.ipLat)
  if (ipLng !== null && ipLat !== null) {
    payload.ip_lng = ipLng
    payload.ip_lat = ipLat
  }
  if (form.ipAddress) payload.ip_address = form.ipAddress
  if (form.ipSource) payload.ip_source = form.ipSource
  emit('submit', payload)
  closeDialog()
}

const closeDialog = () => {
  emit('update:visible', false)
}

watch(() => props.visible, async (val) => {
  if (!val) {
    if (mapInstance.value) {
      mapInstance.value.remove()
      mapInstance.value = null
      markerInstance.value = null
    }
    return
  }
  fillForm(props.params?.value)
  await nextTick()
  await ensureMap()
  const lat = normalizeNumber(form.lat)
  const lng = normalizeNumber(form.lng)
  if (lat !== null && lng !== null) {
    updateMarker(lat, lng)
  } else if (mapInstance.value) {
    mapInstance.value.setView([39.9042, 116.4074], 11)
  }
  await nextTick()
  mapInstance.value?.invalidateSize()
})
</script>

<style scoped>
.geo-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.geo-map {
  width: 100%;
  height: 360px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.geo-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.geo-actions,
.geo-footer {
  display: flex;
  gap: 8px;
}

.geo-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-address-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-address-row :deep(.el-input) {
  flex: 1;
}

.geo-ai-status {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.geo-ip-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
}

.geo-ip-title {
  font-size: 12px;
  color: #606266;
  font-weight: 600;
}

.geo-coords {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.geo-tip {
  font-size: 12px;
  color: #909399;
  margin: 0;
}

:deep(.geo-marker-dot) {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #409eff;
  border: 2px solid #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
</style>
