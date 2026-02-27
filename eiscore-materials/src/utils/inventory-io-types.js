import request from '@/utils/request'

export const INVENTORY_IO_TYPE_CONFIG_KEY = 'inventory_io_types'

export const DEFAULT_INVENTORY_IO_TYPES = [
  { id: 'in_purchase', draft_type: 'in', name: '采购入库' },
  { id: 'in_return', draft_type: 'in', name: '退货入库' },
  { id: 'in_adjust', draft_type: 'in', name: '盘盈入库' },
  { id: 'out_sale', draft_type: 'out', name: '销售出库' },
  { id: 'out_transfer', draft_type: 'out', name: '调拨出库' },
  { id: 'out_adjust', draft_type: 'out', name: '盘亏出库' }
]

const normalizeItem = (item, index) => {
  if (!item || typeof item !== 'object') return null
  const draftType = item.draft_type === 'out' ? 'out' : 'in'
  const name = String(item.name || '').trim()
  if (!name) return null
  const baseId = String(item.id || '').trim()
  const id = baseId || `${draftType}_${index + 1}`
  return {
    id,
    draft_type: draftType,
    name
  }
}

export const normalizeInventoryIoTypes = (list) => {
  if (!Array.isArray(list)) return []
  const used = new Set()
  const normalized = []
  list.forEach((item, index) => {
    const next = normalizeItem(item, index)
    if (!next) return
    const key = `${next.draft_type}:${next.id}`
    if (used.has(key)) return
    used.add(key)
    normalized.push(next)
  })
  return normalized
}

export const getInventoryIoTypesByDraft = (allTypes, draftType) => {
  const target = draftType === 'out' ? 'out' : 'in'
  return normalizeInventoryIoTypes(allTypes).filter(item => item.draft_type === target)
}

export const loadInventoryIoTypes = async () => {
  const res = await request({
    url: `/system_configs?key=eq.${INVENTORY_IO_TYPE_CONFIG_KEY}`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  const row = Array.isArray(res) && res.length ? res[0] : null
  let allTypes = normalizeInventoryIoTypes(row?.value)
  if (allTypes.length === 0) {
    allTypes = DEFAULT_INVENTORY_IO_TYPES.map(item => ({ ...item }))
    await saveInventoryIoTypes(allTypes)
  }
  return allTypes
}

export const saveInventoryIoTypes = async (allTypes) => {
  const normalized = normalizeInventoryIoTypes(allTypes)
  await request({
    url: '/system_configs',
    method: 'post',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    data: {
      key: INVENTORY_IO_TYPE_CONFIG_KEY,
      value: normalized
    }
  })
  return normalized
}

export const buildInventoryIoTypeOptions = (allTypes, draftType) => {
  return getInventoryIoTypesByDraft(allTypes, draftType).map(item => ({
    label: item.name,
    value: item.name
  }))
}
