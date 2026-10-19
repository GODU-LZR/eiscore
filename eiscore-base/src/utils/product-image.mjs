const value = (input) => String(input || '').trim()

export function resolveProductImageUrl(product, fallbacks = {}) {
  const code = value(product?.code).toUpperCase()
  const publishedImage = value(product?.imageUrl)
  if (publishedImage) return publishedImage

  const mappedImage = fallbacks.byCode?.[code]
  if (mappedImage) return mappedImage

  const name = value(product?.name)
  const category = value(product?.category)
  const descriptor = `${category} ${name} ${code}`

  if (/潜水|排污|污水|submersible/i.test(descriptor) || /\bWQ(?:D|X)?\d*/i.test(descriptor)) {
    return fallbacks.submersiblePump || ''
  }
  if (/管道泵|pipeline pump/i.test(descriptor) || /\b(?:PST|ISW|IRG)\b/i.test(descriptor)) {
    return fallbacks.pipelinePump || ''
  }
  if (/自吸|喷射|self[- ]priming/i.test(descriptor) || /\bJET\b/i.test(descriptor)) {
    return fallbacks.jetPump || ''
  }
  if (/\b(?:YC|YL|YY)\b/i.test(name)) return fallbacks.singlePhaseMotor || ''
  if (/\bYE3\b/i.test(name)) return fallbacks.threePhaseMotor || ''
  if (/交流电机|电机|\bmotor\b/i.test(descriptor) || /^LUNDU-P-MOTOR-/i.test(code)) {
    return fallbacks.motor || ''
  }
  return ''
}

export function fallbackProductImageAfterError(currentUrl, product, fallbacks = {}) {
  const fallbackUrl = resolveProductImageUrl({ ...product, imageUrl: '' }, fallbacks)
  return fallbackUrl && fallbackUrl !== value(currentUrl) ? fallbackUrl : ''
}
