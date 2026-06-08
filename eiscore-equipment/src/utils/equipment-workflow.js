// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { numberValue } from '@/utils/equipment-attention'

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

export const getCheckIssueLink = (row = {}) => {
  const props = row.properties || {}
  return {
    issueId: props.issue_id || row.issue_id || '',
    issueNo: props.issue_no || row.issue_no || '',
    workOrderId: props.work_order_id || row.work_order_id || '',
    workOrderNo: props.work_order_no || row.work_order_no || ''
  }
}

export const isCheckIssueLinked = (row = {}) => {
  const link = getCheckIssueLink(row)
  return Boolean(link.issueId || link.issueNo || link.workOrderId || link.workOrderNo)
}

export const canGenerateIssueFromCheck = (row = {}) => {
  if (!row || row.status === 'deleted') return false
  if (isCheckIssueLinked(row)) return false
  return row.check_result === '停机' || row.check_result === '异常' || numberValue(row.abnormal_count) > 0
}

export const generateIssueNo = (row = {}) => {
  const sourcePart = String(row.check_no || row.asset_no || '').replace(/[^A-Za-z0-9]/g, '').slice(-4)
  return `EI-${dateStamp()}-${sourcePart || 'CK'}-${Date.now().toString().slice(-5)}`
}

export const generateWorkOrderNo = (issueNo = '') => {
  const sourcePart = String(issueNo || '').replace(/[^A-Za-z0-9]/g, '').slice(-5)
  return `EW-${dateStamp()}-${sourcePart || 'ISS'}-${Date.now().toString().slice(-5)}`
}

export const resolveIssueLevel = (row = {}) => {
  const abnormal = numberValue(row.abnormal_count)
  if (row.check_result === '停机') return '紧急'
  if (abnormal >= 2 || row.check_result === '异常') return '严重'
  return '一般'
}

export const buildIssuePayloadFromCheck = (row = {}) => {
  const abnormal = numberValue(row.abnormal_count)
  const level = resolveIssueLevel(row)
  return {
    issue_no: generateIssueNo(row),
    asset_id: isUuid(row.asset_id) ? row.asset_id : null,
    asset_no: row.asset_no || '',
    asset_name: row.asset_name || '未知设备',
    source_type: row.check_type || '点检异常',
    issue_desc: `${row.asset_name || row.asset_no || '设备'}点检异常：${row.remark || `发现 ${abnormal} 个异常项`}`,
    issue_level: level,
    owner_dept: '设备部',
    owner_name: '',
    occurred_date: row.check_date || new Date().toISOString().slice(0, 10),
    deadline: isoDateAfter(level === '紧急' ? 0 : 2),
    issue_status: '待处理',
    repair_action: '请设备责任人确认异常原因并安排维修',
    status: 'active',
    properties: {
      generated_from: 'equipment_check',
      check_id: isUuid(row.id) ? row.id : '',
      check_no: row.check_no || '',
      check_result: row.check_result || '',
      abnormal_count: abnormal,
      check_item_count: numberValue(row.check_item_count),
      checker: row.checker || '',
      attention_level: level === '紧急' ? 'critical' : 'warning'
    }
  }
}

export const buildWorkOrderPayloadFromIssue = (issue = {}, sourceCheck = {}) => {
  return {
    work_order_no: generateWorkOrderNo(issue.issue_no),
    issue_id: isUuid(issue.id) ? issue.id : null,
    issue_no: issue.issue_no || '',
    asset_id: isUuid(sourceCheck.asset_id || issue.asset_id) ? (sourceCheck.asset_id || issue.asset_id) : null,
    asset_no: issue.asset_no || sourceCheck.asset_no || '',
    asset_name: issue.asset_name || sourceCheck.asset_name || '未知设备',
    work_type: issue.issue_level === '紧急' ? '故障维修' : '预防保养',
    task_desc: issue.repair_action || issue.issue_desc || '处理设备点检异常',
    maintainer: '',
    plan_date: new Date().toISOString().slice(0, 10),
    finish_date: null,
    downtime_hours: sourceCheck.check_result === '停机' ? 1 : 0,
    work_status: '待派工',
    acceptance_result: '',
    status: 'active',
    properties: {
      generated_from: 'equipment_issue',
      source_check_no: sourceCheck.check_no || '',
      issue_level: issue.issue_level || ''
    }
  }
}
