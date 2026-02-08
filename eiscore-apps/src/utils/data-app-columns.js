export const DATA_APP_COLUMN_TYPES = [
  { label: '普通文字', value: 'text', hint: '文字/数字/日期' },
  { label: '下拉选项', value: 'select' },
  { label: '联动选择', value: 'cascader' },
  { label: '地图位置', value: 'geo' },
  { label: '文件', value: 'file' },
  { label: '自动计算', value: 'formula' }
]

const TYPE_MAP = {
  text: 'text',
  number: 'text',
  integer: 'text',
  int: 'text',
  numeric: 'text',
  float: 'text',
  double: 'text',
  date: 'text',
  datetime: 'text',
  timestamp: 'text',
  timestamptz: 'text',
  boolean: 'text',
  bool: 'text',
  select: 'select',
  dropdown: 'select',
  cascader: 'cascader',
  geo: 'geo',
  file: 'file',
  formula: 'formula'
}

export const normalizeColumnType = (value) => {
  if (!value) return 'text'
  const key = String(value).trim().toLowerCase()
  return TYPE_MAP[key] || 'text'
}

