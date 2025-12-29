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
          <el-input v-model="form.address" placeholder="大概地址（可手动填写）" :disabled="!allowAddress" />
          <div class="geo-coords">
            <el-input v-model="form.lng" placeholder="经度" />
            <el-input v-model="form.lat" placeholder="纬度" />
          </div>
          <el-input v-model="form.ip" placeholder="IP（可选）" />
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

const form = reactive({
  lng: '',
  lat: '',
  address: '',
  ip: '',
  source: ''
})

const allowAddress = computed(() => {
  const colDef = props.params?.colDef || {}
  return colDef.geoAddress !== false
})

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
  form.ip = data.ip ?? ''
  form.source = data.source ?? ''
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
    reverseApiUrl: colCfg.reverseApiUrl || globalCfg.reverseApiUrl || ''
  }
}

const ensureMap = async () => {
  if (mapInstance.value || !mapRef.value) return
  const config = getGeoConfig()
  mapInstance.value = L.map(mapRef.value, { zoomControl: true })
  L.tileLayer(config.tileUrl, {
    subdomains: config.tileSubdomains,
    maxZoom: config.tileMaxZoom
  }).addTo(mapInstance.value)
  mapInstance.value.on('click', (evt) => {
    const { lat, lng } = evt.latlng
    setLocation({ lat, lng, source: 'manual' })
  })
}

const updateMarker = (lat, lng) => {
  if (!mapInstance.value) return
  if (!markerInstance.value) {
    markerInstance.value = L.circleMarker([lat, lng], {
      radius: 6,
      color: '#409eff',
      fillColor: '#409eff',
      fillOpacity: 0.8
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
  if (allowAddress.value && payload.address) form.address = payload.address
  if (payload.ip) form.ip = payload.ip
  if (payload.source) form.source = payload.source
  const lat = normalizeNumber(form.lat)
  const lng = normalizeNumber(form.lng)
  if (lat !== null && lng !== null) updateMarker(lat, lng)
}

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

const fetchIpLocation = async () => {
  const config = getGeoConfig()
  if (!config.ipApiUrl) return null
  try {
    const res = await fetch(config.ipApiUrl)
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
  const url = config.reverseApiUrl
    .replace('{lat}', encodeURIComponent(String(lat)))
    .replace('{lng}', encodeURIComponent(String(lng)))
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const data = await res.json()
    return extractAddress(data)
  } catch (e) {
    return ''
  }
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
  const ipLoc = await fetchIpLocation()
  ipLocating.value = false
  if (!ipLoc) {
    ElMessage.warning('IP定位失败')
    return
  }
  setLocation(ipLoc)
}

const locateCurrent = async () => {
  locating.value = true
  let location = await getGpsLocation()
  if (location) {
    let address = ''
    if (allowAddress.value) {
      address = await fetchReverseAddress(location.lat, location.lng)
      if (!address) {
        const ipLoc = await fetchIpLocation()
        address = ipLoc?.address || ''
      }
    }
    location.address = address
    setLocation(location)
    locating.value = false
    return
  }
  const ipLoc = await fetchIpLocation()
  locating.value = false
  if (!ipLoc) {
    ElMessage.warning('定位失败，请手动填写')
    return
  }
  setLocation(ipLoc)
}

const clearForm = () => {
  form.lng = ''
  form.lat = ''
  form.address = ''
  form.ip = ''
  form.source = ''
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
  if (form.ip) payload.ip = form.ip
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
</style>
