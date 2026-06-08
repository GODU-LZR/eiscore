// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { numberValue } from '@/utils/quality-attention'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const pad2 = (value) => String(value).padStart(2, '0')

const dateStamp = (date = new Date()) => {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

const isoDateAfter = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export const isUuid = (value) => UUID_RE.test(String(value || ''))

export const getInspectionNcrLink = (row = {}) => {
  const props = row.properties || {}
  return {
    id: props.ncr_id || row.ncr_id || '',
    docNo: props.ncr_doc_no || row.ncr_doc_no || ''
  }
}

export const isInspectionNcrLinked = (row = {}) => {
  const link = getInspectionNcrLink(row)
  return Boolean(link.id || link.docNo)
}

export const canGenerateNcrFromInspection = (row = {}) => {
  if (!row || row.status === 'deleted') return false
  if (isInspectionNcrLinked(row)) return false
  const defectQty = numberValue(row.defect_qty)
  return row.result === '不合格' || defectQty > 0
}

export const generateNcrDocNo = (row = {}) => {
  const sourcePart = String(row.doc_no || '').replace(/[^A-Za-z0-9]/g, '').slice(-4)
  const suffix = Date.now().toString().slice(-5)
  return `NCR-${dateStamp()}-${sourcePart || 'QC'}-${suffix}`
}

export const buildNcrIssueDesc = (row = {}) => {
  const sampleQty = numberValue(row.sample_qty)
  const defectQty = numberValue(row.defect_qty)
  const target = row.item_name || row.item_code || row.source_doc_no || '检验对象'
  const defectText = sampleQty > 0
    ? `抽检 ${sampleQty}，不良 ${defectQty}`
    : `不良 ${defectQty}`
  const remark = row.remark ? `；备注：${row.remark}` : ''
  return `${target}检验异常：${defectText}${remark}`
}

export const resolveNcrSeverity = (row = {}) => {
  const sampleQty = numberValue(row.sample_qty)
  const defectQty = numberValue(row.defect_qty)
  const defectRate = sampleQty > 0 ? (defectQty / sampleQty) * 100 : 0
  if (row.result === '不合格' && defectRate >= 10) return '关键'
  if (row.result === '不合格' || defectRate >= 5) return '严重'
  return '一般'
}

export const buildNcrPayloadFromInspection = (row = {}) => {
  const sampleQty = numberValue(row.sample_qty)
  const defectQty = numberValue(row.defect_qty)
  const defectRate = sampleQty > 0 ? Number(((defectQty / sampleQty) * 100).toFixed(2)) : 0
  const severity = resolveNcrSeverity(row)

  return {
    doc_no: generateNcrDocNo(row),
    inspection_id: isUuid(row.id) ? row.id : null,
    source_type: row.inspection_type || '检验异常',
    source_doc_no: row.doc_no || row.source_doc_no || '',
    issue_desc: buildNcrIssueDesc(row),
    severity,
    owner_dept: row.inspection_type === '来料检验' ? '采购部' : '生产部',
    owner_name: '',
    deadline: isoDateAfter(severity === '关键' ? 1 : 3),
    ncr_status: '待整改',
    corrective_action: '请责任部门分析原因并提交纠正措施',
    verification_result: '',
    status: 'active',
    properties: {
      generated_from: 'quality_inspection',
      inspection_doc_no: row.doc_no || '',
      source_doc_no: row.source_doc_no || '',
      item_code: row.item_code || '',
      item_name: row.item_name || '',
      batch_no: row.batch_no || '',
      source_name: row.source_name || '',
      sample_qty: sampleQty,
      defect_qty: defectQty,
      defect_rate: defectRate,
      inspection_result: row.result || '',
      attention_level: severity === '关键' ? 'critical' : 'warning'
    }
  }
}
