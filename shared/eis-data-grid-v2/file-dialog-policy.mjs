const getExtension = (file) => {
  const ext = String(file?.ext || '').replace(/^\./, '')
  if (ext) return ext.toLowerCase()
  const name = String(file?.name || '')
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : ''
}

export const resolveFilePreviewKind = (file) => {
  const type = String(file?.type || '').toLowerCase()
  const ext = getExtension(file)
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (type.includes('pdf') || ext === 'pdf') return 'pdf'
  if (type.startsWith('video/') || ['mp4', 'webm', 'ogg'].includes(ext)) return 'video'
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio'
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office'
  return 'unsupported'
}

const isAllowed = (file, rules) => {
  if (!rules?.length || rules.includes('*/*')) return true
  const ext = getExtension(file)
  if (ext && rules.includes(`.${ext}`)) return true
  const type = String(file?.type || '').toLowerCase()
  return Boolean(type && (rules.includes(type) || rules.includes(`${type.split('/')[0]}/*`)))
}

export const selectFilesForUpload = (files, { currentCount, maxCount, maxSizeBytes, acceptRules }) => {
  const remaining = Math.max(0, maxCount - currentCount)
  const result = { accepted: [], skippedType: 0, skippedSize: 0, skippedCount: 0 }
  for (const file of files || []) {
    if (!isAllowed(file, acceptRules)) result.skippedType += 1
    else if (Number(file?.size || 0) > maxSizeBytes) result.skippedSize += 1
    else if (result.accepted.length >= remaining) result.skippedCount += 1
    else result.accepted.push(file)
  }
  return result
}

export const shouldUploadFileToDatabase = (storeMode) => ['url', 'reference-list'].includes(String(storeMode || ''))

export const shouldDeleteStoredFile = (storeMode, item) => shouldUploadFileToDatabase(storeMode)
  && String(item?.url || '').startsWith('file:')

export const serializeFileItem = (item) => {
  const serialized = {
    id: item?.id,
    name: item?.name,
    type: item?.type,
    size: item?.size,
    url: item?.url,
    ext: item?.ext,
    uploadedAt: item?.uploadedAt
  }
  if (!String(item?.url || '').startsWith('file:')) serialized.dataUrl = item?.dataUrl
  return serialized
}
