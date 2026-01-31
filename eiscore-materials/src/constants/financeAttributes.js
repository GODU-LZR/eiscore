const toText = (value) => {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

export const FINANCE_ATTRIBUTE_OPTIONS = [
  { code: '4111.01', name: '直接材料' },
  { code: '4111.02', name: '辅助材料' },
  { code: '4111.03', name: '包装材料' },
  { code: '4111.04', name: '燃料' },
  { code: '4111.05', name: '直接人工' },
  { code: '4111.06', name: '制造费用结转' },
  { code: '4111.07', name: '制造费用' },
  { code: '4115.01', name: '职工薪酬' },
  { code: '4115.02', name: '补保费用' },
  { code: '4115.03', name: '奖酬费用' },
  { code: '4115.04', name: '伙食福利' },
  { code: '4115.05', name: '水电费用' },
  { code: '4115.06', name: '冷储冷藏费' },
  { code: '4115.07', name: '维修维护费' },
  { code: '4115.08', name: '试制样品费' },
  { code: '4115.09', name: '无偿样品费' },
  { code: '4115.10', name: '折旧费用' },
  { code: '4115.11', name: '开办资产摊销' },
  { code: '4115.12', name: '样品费' },
  { code: '4115.13', name: '物流运费' },
  { code: '4115.14', name: '招待应酬费' },
  { code: '4115.15', name: '销售诉讼费' },
  { code: '4115.16', name: '损耗奖金' },
  { code: '4115.17', name: '保险费' },
  { code: '4115.18', name: '展览推广费' },
  { code: '4115.19', name: '检测检验费' },
  { code: '4115.20', name: '办公杂费' },
  { code: '4115.21', name: '材料加工费' }
]

export const FINANCE_ATTRIBUTE_SELECT_OPTIONS = FINANCE_ATTRIBUTE_OPTIONS.map(
  (item) => ({
    value: toText(item.code),
    label: `${toText(item.code)}${toText(item.name)}`,
    name: toText(item.name)
  })
)

