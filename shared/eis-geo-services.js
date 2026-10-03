// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const defaultFetch = (...args) => globalThis.fetch(...args)

export const hasChinese = (text) => /[\u4e00-\u9fa5]/.test(String(text || ''))

const normalizeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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

const appendLangParam = (url, key, lang) => {
  if (!url || !lang) return url
  if (url.includes('{lang}')) return url.replace('{lang}', encodeURIComponent(lang))
  const pattern = new RegExp(`[?&]${key}=`, 'i')
  if (pattern.test(url)) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${key}=${encodeURIComponent(lang)}`
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
  if (resultField) return resultField.split('.').reduce((value, key) => value?.[key], data) || ''
  return ''
}

export function createGeoServices({
  getConfig,
  getToken = () => '',
  fetchImpl = defaultFetch,
  translationCache = new Map()
} = {}) {
  if (typeof getConfig !== 'function') throw new TypeError('getConfig must be a function')
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function')
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')

  const buildAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  const translateWithHarness = async (text) => {
    const trimmed = text ? String(text).trim() : ''
    if (!trimmed) return ''
    const cached = translationCache.get(trimmed)
    if (cached) return cached
    const systemPrompt = '你是翻译助手。把用户输入翻译成简洁、自然的中文地址，只输出翻译结果，不要添加任何解释。若输入已是中文，原样输出。'
    try {
      const response = await fetchImpl('/ai/translate', {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ text: trimmed, prompt: systemPrompt })
      })
      if (!response.ok) return trimmed
      const data = await response.json()
      const translated = String(data?.text || '').trim() || trimmed
      translationCache.set(trimmed, translated)
      return translated
    } catch {
      return trimmed
    }
  }

  const translateText = async (text) => {
    const config = getConfig() || {}
    const trimmed = text ? String(text).trim() : ''
    if (!trimmed) return ''
    if (translationCache.has(trimmed)) return translationCache.get(trimmed)
    if (config.translateProvider !== 'external' || !config.translateApiUrl) {
      const translated = await translateWithHarness(trimmed)
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
        const response = await fetchImpl(url)
        if (!response.ok) return text
        const data = await response.json()
        const translated = extractTranslation(data, config.translateResultField) || trimmed
        translationCache.set(trimmed, translated)
        return translated
      }
      const response = await fetchImpl(config.translateApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) return text
      const data = await response.json()
      const translated = extractTranslation(data, config.translateResultField) || trimmed
      translationCache.set(trimmed, translated)
      return translated
    } catch {
      return text
    }
  }

  const askHarnessForMapLocation = async (imageUrl, lat, lng) => {
    const config = getConfig() || {}
    const prompt = config.mapAiPrompt || `请根据地图截图上的中文地名，且以蓝色圆点为用户当前位置，找出离蓝点最近的街道级位置。输出严格格式的中文位置：“省-市-区/县/县级市-街道/乡镇”。必须包含街道级；如果无法确定街道，请用“某街道”或“附近街道”占位，但仍要输出四段。只输出位置，不要解释，不要多余的话。坐标：${lng},${lat}`
    try {
      const response = await fetchImpl('/ai/map-locate', {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ imageUrl, lat, lng, prompt })
      })
      if (!response.ok) return ''
      const data = await response.json()
      return String(data?.address || '').trim()
    } catch {
      return ''
    }
  }

  const fetchIpLocation = async () => {
    const config = getConfig() || {}
    if (!config.ipApiUrl) return null
    const url = appendLangParam(config.ipApiUrl, config.ipLangParam || 'lang', config.lang)
    try {
      const response = await fetchImpl(url, {
        headers: config.lang ? { 'Accept-Language': config.lang } : {}
      })
      if (!response.ok) return null
      return parseIpLocation(await response.json())
    } catch {
      return null
    }
  }

  const fetchReverseAddress = async (lat, lng) => {
    const config = getConfig() || {}
    if (!config.reverseApiUrl) return ''
    let url = config.reverseApiUrl
      .replace('{lat}', encodeURIComponent(String(lat)))
      .replace('{lng}', encodeURIComponent(String(lng)))
    url = appendLangParam(url, config.reverseLangParam || 'accept-language', config.lang)
    try {
      const response = await fetchImpl(url, {
        headers: config.lang ? { 'Accept-Language': config.lang } : {}
      })
      if (!response.ok) return ''
      return extractAddress(await response.json())
    } catch {
      return ''
    }
  }

  return { askHarnessForMapLocation, fetchIpLocation, fetchReverseAddress, translateText }
}
