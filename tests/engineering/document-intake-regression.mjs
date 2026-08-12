// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'

const defaultCollectorAllowedExtensions = [
  '.xlsx',
  '.xls',
  '.csv',
  '.docx',
  '.doc',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.bmp',
  '.gif',
  '.webp',
  '.txt',
  '.zip',
  '.rar',
  '.7z'
]

const require = createRequire(import.meta.url)
const Module = require('node:module')

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eiscore-document-intake-'))
process.env.DOCUMENT_INTAKE_STORAGE_DIR = tmpRoot
process.env.DOCUMENT_INTAKE_POLICY_FILE = path.join(tmpRoot, 'document-intake-policy.json')
process.env.COLLECTOR_RELEASE_DIR = path.join(tmpRoot, 'collector-releases')
process.env.DOCUMENT_INTAKE_MAX_UPLOAD_BYTES = 'not-a-number'
process.env.DOCUMENT_INTAKE_PG_POOL_MAX = 'also-not-a-number'
process.env.DOCUMENT_INTAKE_CONFIDENCE_THRESHOLD = '0.82'
process.env.DOCUMENT_INTAKE_DEFAULT_AUTO_IMPORT_MODE = 'review_required'
process.env.DOCUMENT_INTAKE_LOW_CONFIDENCE_POLICY = 'archive_only'
process.env.PGPORT = 'bad-port'

const state = {
  poolOptions: null,
  authorized: true,
  device: {
    id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    default_user_id: 'u_1',
    default_username: 'operator',
    default_role: 'warehouse',
    status: 'active',
    metadata: {}
  },
  duplicateRows: [],
  watchFolders: [],
  uploadSessions: new Map(),
  uploadChunks: new Map(),
  businessLink: null,
  correctionInserts: [],
  recalculationTaskInserts: [],
  businessLinkUpdates: [],
  adminReviewPlan: null,
  entryPlanUpdates: [],
  adminOverview: {
    assetMetrics: {},
    deviceMetrics: {},
    recalculationTaskMetrics: {},
    statusBreakdown: []
  },
  adminAssets: [],
  adminDetail: null,
  adminBusinessSources: [],
  adminRecalculationTasks: [],
  adminProductionWorkReports: [],
  productionWorkReportTableAvailable: true,
  adminQualityInspections: [],
  qualityInspectionTableAvailable: true,
  adminHrAttendanceSnapshots: [],
  hrAttendanceSnapshotTableAvailable: true,
  adminPayrollPrecheckSnapshots: [],
  payrollPrecheckViewAvailable: true,
  adminPayrollPrecheckResults: [],
  payrollPrecheckResultTableAvailable: true,
  payrollReadyPrecheckViewAvailable: true,
  payrollPrecheckTrialInserts: [],
  payrollPrecheckResultUpdates: [],
  adminDevices: [],
  adminWatchFolders: [],
  adminLogs: [],
  retentionCandidates: [],
  adminDeviceInserts: [],
  adminDeviceUpdates: [],
  adminBindResets: [],
  watchFolderInserts: [],
  clientLogInserts: [],
  clientQueries: [],
  poolQueries: [],
  assetInsertParams: [],
  parseJobInserts: 0,
  parseJobUpdates: [],
  parseResultInserts: [],
  classificationInserts: [],
  entryPlanInserts: [],
  unmappedFieldInserts: [],
  assetStatusUpdates: [],
  batchStatusUpdates: [],
  connected: 0
}

class FakeClient {
  async query(sql, params = []) {
    state.clientQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (['begin', 'commit', 'rollback'].includes(normalized)) return { rows: [] }
    if (normalized.includes('select id, storage_path') && normalized.includes('from public.document_assets')) {
      return { rows: state.duplicateRows }
    }
    if (
      normalized.includes('select id, original_filename, storage_path') &&
      normalized.includes('from public.document_assets') &&
      normalized.includes('source_file_retention_status')
    ) {
      return { rows: state.retentionCandidates }
    }
    if (normalized.includes('insert into public.document_import_batches')) {
      return { rows: [{ id: 'batch-1', batch_no: 'DIB-TEST' }] }
    }
    if (normalized.includes('insert into public.document_assets')) {
      state.assetInsertParams.push(params)
      return { rows: [{ id: 'asset-1', status: params[14] || 'uploaded' }] }
    }
    if (normalized.includes('insert into public.document_parse_jobs')) {
      state.parseJobInserts += 1
      return { rows: [{ id: `parse-job-${state.parseJobInserts}` }] }
    }
    if (normalized.includes('update public.document_parse_jobs')) {
      state.parseJobUpdates.push({ sql, params })
      return { rows: [] }
    }
    if (normalized.includes('insert into public.document_parse_results')) {
      state.parseResultInserts.push(params)
      return { rows: [{ id: `parse-result-${state.parseResultInserts.length}` }] }
    }
    if (normalized.includes('insert into public.document_classification_results')) {
      state.classificationInserts.push(params)
      return { rows: [{ id: `classification-${state.classificationInserts.length}` }] }
    }
    if (normalized.includes('insert into public.document_entry_plans')) {
      state.entryPlanInserts.push(params)
      return { rows: [{ id: `entry-plan-${state.entryPlanInserts.length}` }] }
    }
    if (
      normalized.includes('from public.document_entry_plans p') &&
      normalized.includes('join public.document_assets a') &&
      normalized.includes('for update of p, a')
    ) {
      return { rows: state.adminReviewPlan ? [state.adminReviewPlan] : [] }
    }
    if (normalized.includes('update public.document_entry_plans')) {
      state.entryPlanUpdates.push({ sql, params })
      return { rows: [] }
    }
    if (normalized.includes('insert into public.document_unmapped_fields')) {
      state.unmappedFieldInserts.push(params)
      return { rows: [{ id: `unmapped-field-${state.unmappedFieldInserts.length}` }] }
    }
    if (normalized.includes('update public.document_assets')) {
      state.assetStatusUpdates.push({ sql, params })
      return { rows: [] }
    }
    if (normalized.includes('update public.document_import_batches')) {
      state.batchStatusUpdates.push({ sql, params })
      return { rows: [] }
    }
    if (normalized.includes('insert into public.document_upload_sessions')) {
      const existing = [...state.uploadSessions.values()].find((session) => session.device_id === params[0] && session.file_hash === params[1])
      const session = existing || {
        id: `00000000-0000-4000-8000-${String(state.uploadSessions.size + 1).padStart(12, '0')}`,
        device_id: params[0],
        file_hash: params[1]
      }
      Object.assign(session, {
        original_filename: params[2],
        mime_type: params[3],
        file_size: params[4],
        chunk_size: params[5],
        total_chunks: params[6],
        upload_source: params[7],
        status: session.status === 'completed' ? 'completed' : 'uploading',
        uploaded_chunks: state.uploadChunks.get(session.id)?.size || 0,
        metadata: params[8] || {}
      })
      state.uploadSessions.set(session.id, session)
      return { rows: [session] }
    }
    if (normalized.includes('select * from public.document_upload_sessions')) {
      const session = state.uploadSessions.get(params[0])
      return { rows: session && session.device_id === params[1] ? [session] : [] }
    }
    if (
      normalized.includes('select chunk_index, chunk_size, chunk_hash, storage_path') &&
      normalized.includes('from public.document_upload_chunks') &&
      normalized.includes('chunk_index = $2')
    ) {
      const chunks = state.uploadChunks.get(params[0]) || new Map()
      const chunk = chunks.get(params[1])
      return { rows: chunk ? [chunk] : [] }
    }
    if (normalized.includes('insert into public.document_upload_chunks')) {
      const [sessionId, chunkIndex, chunkSize, chunkHash, storagePath] = params
      if (!state.uploadChunks.has(sessionId)) state.uploadChunks.set(sessionId, new Map())
      state.uploadChunks.get(sessionId).set(chunkIndex, {
        session_id: sessionId,
        chunk_index: chunkIndex,
        chunk_size: chunkSize,
        chunk_hash: chunkHash,
        storage_path: storagePath
      })
      return { rows: [] }
    }
    if (normalized.includes('select count(*)::integer as count') && normalized.includes('from public.document_upload_chunks')) {
      return { rows: [{ count: state.uploadChunks.get(params[0])?.size || 0 }] }
    }
    if (normalized.includes('select chunk_index, chunk_size, chunk_hash, storage_path') && normalized.includes('from public.document_upload_chunks')) {
      let chunks = [...(state.uploadChunks.get(params[0]) || new Map()).values()]
      if (params.length > 1) chunks = chunks.filter((chunk) => chunk.chunk_index === params[1])
      return { rows: chunks.sort((a, b) => a.chunk_index - b.chunk_index) }
    }
    if (normalized.includes('select chunk_index') && normalized.includes('from public.document_upload_chunks')) {
      const chunks = [...(state.uploadChunks.get(params[0]) || new Map()).values()]
      return { rows: chunks.sort((a, b) => a.chunk_index - b.chunk_index).map((chunk) => ({ chunk_index: chunk.chunk_index })) }
    }
    if (
      normalized.includes('select *') &&
      normalized.includes('from public.collector_devices') &&
      normalized.includes('where id = $1') &&
      normalized.includes('for update')
    ) {
      const device = state.adminDevices.find((item) => item.id === params[0])
      return { rows: device ? [device] : [] }
    }
    if (normalized.includes('from public.collector_devices') && normalized.includes('for update')) {
      return { rows: [state.device] }
    }
    if (normalized.includes('insert into public.collector_devices') && normalized.includes('device_token_hash')) {
      const device = {
        id: 'device-1',
        device_code: params[0],
        device_name: params[1],
        enterprise_id: params[2],
        default_user_id: params[3],
        default_username: params[4],
        default_role: params[5],
        device_token_hash: params[6],
        client_version: params[7],
        webview_version: params[8],
        status: 'active',
        last_seen_at: new Date().toISOString(),
        metadata: params[9]
      }
      Object.assign(state.device, device)
      return { rows: [device] }
    }
    if (normalized.includes('insert into public.collector_devices')) {
      state.adminDeviceInserts.push(params)
      const device = {
        id: `55555555-5555-4555-8555-${String(state.adminDevices.length + 1).padStart(12, '0')}`,
        device_code: params[0],
        device_name: params[1],
        enterprise_id: params[2],
        department_id: params[3],
        default_user_id: params[4],
        default_username: params[5],
        default_role: params[6],
        server_base_url: params[7],
        binding_code_hash: params[8],
        client_version: params[9],
        webview_version: params[10],
        status: params[11],
        metadata: params[12],
        created_at: '2026-06-19T02:00:00.000Z',
        updated_at: '2026-06-19T02:00:00.000Z'
      }
      state.adminDevices.push(device)
      return { rows: [device] }
    }
    if (normalized.includes('from public.document_business_links')) {
      return { rows: state.businessLink ? [state.businessLink] : [] }
    }
    if (normalized.includes('update public.document_upload_sessions')) {
      const session = state.uploadSessions.get(params[0])
      if (session) {
        if (normalized.includes('set uploaded_chunks = $2')) session.uploaded_chunks = params[1]
        if (normalized.includes('set status = $2')) {
          session.status = params[1]
          session.storage_path = params[2] || session.storage_path
        }
      }
      return { rows: [] }
    }
    if (normalized.includes('update public.collector_devices') && normalized.includes('department_id = $3')) {
      state.adminDeviceUpdates.push(params)
      const device = state.adminDevices.find((item) => item.id === params[0])
      if (!device) return { rows: [] }
      Object.assign(device, {
        device_name: params[1],
        department_id: params[2],
        default_user_id: params[3],
        default_username: params[4],
        default_role: params[5],
        server_base_url: params[6],
        client_version: params[7],
        webview_version: params[8],
        status: params[9],
        metadata: JSON.parse(params[10] || '{}'),
        updated_at: '2026-06-19T02:10:00.000Z'
      })
      return { rows: [device] }
    }
    if (
      normalized.includes('update public.collector_devices') &&
      normalized.includes('client_version = coalesce(nullif($2') &&
      normalized.includes('webview_version = coalesce(nullif($3')
    ) {
      const updated = {
        ...state.device,
        client_version: params[1] || state.device.client_version,
        webview_version: params[2] || state.device.webview_version,
        metadata: { ...(state.device.metadata || {}), ...(params[3] || {}) },
        last_seen_at: new Date().toISOString()
      }
      Object.assign(state.device, updated)
      return { rows: [updated] }
    }
    if (normalized.includes('update public.collector_devices') && normalized.includes('device_token_hash = $6')) {
      const updated = {
        ...state.device,
        device_name: params[1] || state.device.device_name,
        default_user_id: params[2] || state.device.default_user_id,
        default_username: params[3] || state.device.default_username,
        default_role: params[4] || state.device.default_role,
        device_token_hash: params[5] || state.device.device_token_hash,
        client_version: params[6] || state.device.client_version,
        webview_version: params[7] || state.device.webview_version,
        status: 'active',
        metadata: { ...(state.device.metadata || {}), ...(params[8] || {}) },
        last_seen_at: new Date().toISOString()
      }
      Object.assign(state.device, updated)
      return { rows: [updated] }
    }
    if (normalized.startsWith('delete from public.collector_watch_folders')) {
      state.adminWatchFolders = state.adminWatchFolders.filter((folder) => folder.device_id !== params[0])
      return { rows: [] }
    }
    if (normalized.includes('insert into public.collector_watch_folders')) {
      state.watchFolderInserts.push(params)
      const folder = {
        id: `folder-${state.watchFolderInserts.length}`,
        device_id: params[0],
        folder_path: params[1],
        folder_name: params[2],
        default_user_id: params[3],
        default_username: params[4],
        default_role: params[5],
        enabled: params[6],
        metadata: params[7] || {},
        created_at: '2026-06-19T02:01:00.000Z',
        updated_at: '2026-06-19T02:01:00.000Z'
      }
      state.adminWatchFolders.push(folder)
      return { rows: [] }
    }
    if (normalized.includes('from public.collector_watch_folders')) {
      const adminRows = state.adminWatchFolders.filter((folder) => folder.device_id === params[0])
      return { rows: state.watchFolders.length ? state.watchFolders : adminRows }
    }
    if (normalized.includes('insert into public.ai_business_corrections')) {
      state.correctionInserts.push(params)
      return { rows: [{ id: 'correction-1', corrected_at: '2026-06-19T00:00:00.000Z' }] }
    }
    if (normalized.includes('insert into public.ai_business_recalculation_tasks')) {
      state.recalculationTaskInserts.push(params)
      return { rows: [{ id: 'recalc-task-1', status: params[6], requested_at: '2026-06-19T00:00:01.000Z' }] }
    }
    if (normalized.includes('update public.document_business_links')) {
      state.businessLinkUpdates.push(params)
      return { rows: [] }
    }
    throw new Error(`Unexpected client query: ${normalized}`)
  }

  release() {}
}

class FakePool {
  constructor(options) {
    state.poolOptions = options
  }

  async query(sql, params = []) {
    state.poolQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('today_file_count') && normalized.includes('low_confidence_count')) {
      return { rows: [state.adminOverview.assetMetrics] }
    }
    if (normalized.includes('pending_recalculation_task_count') && normalized.includes('from public.ai_business_recalculation_tasks')) {
      return { rows: [state.adminOverview.recalculationTaskMetrics] }
    }
    if (normalized.includes('active_device_count') && normalized.includes('from public.collector_devices')) {
      return { rows: [state.adminOverview.deviceMetrics] }
    }
    if (normalized.includes('status_count') && normalized.includes('from public.document_assets')) {
      return { rows: state.adminOverview.statusBreakdown }
    }
    if (normalized.includes('device_total_count') && normalized.includes('from public.collector_devices d')) {
      return { rows: [{ device_total_count: state.adminDevices.length }] }
    }
    if (
      normalized.includes('from public.collector_devices d') &&
      normalized.includes('order by d.updated_at desc, d.device_code asc')
    ) {
      return { rows: state.adminDevices }
    }
    if (
      normalized.includes('from public.collector_devices d') &&
      normalized.includes('where d.id = $1')
    ) {
      const device = state.adminDevices.find((item) => item.id === params[0])
      return { rows: device ? [device] : [] }
    }
    if (normalized.includes('from public.collector_watch_folders')) {
      const adminRows = state.adminWatchFolders.filter((folder) => folder.device_id === params[0])
      return { rows: state.watchFolders.length ? state.watchFolders : adminRows }
    }
    if (normalized.includes('log_total_count') && normalized.includes('from public.client_log_events l')) {
      return { rows: [{ log_total_count: state.adminLogs.length }] }
    }
    if (
      normalized.includes('from public.client_log_events l') &&
      normalized.includes('order by l.created_at desc, l.id desc')
    ) {
      return { rows: state.adminLogs }
    }
    if (normalized.includes('update public.collector_devices') && normalized.includes('binding_code_hash = $2')) {
      state.adminBindResets.push(params)
      const device = state.adminDevices.find((item) => item.id === params[0])
      if (!device) return { rows: [] }
      Object.assign(device, {
        binding_code_hash: params[1],
        device_token_hash: null,
        status: 'pending',
        metadata: { ...(device.metadata || {}), ...JSON.parse(params[2] || '{}') },
        updated_at: '2026-06-19T02:20:00.000Z'
      })
      return { rows: [device] }
    }
    if (normalized.includes('asset_total_count') && normalized.includes('from public.document_assets a')) {
      return { rows: [{ asset_total_count: state.adminAssets.length }] }
    }
    if (
      normalized.includes('select id, original_filename, storage_path') &&
      normalized.includes('from public.document_assets') &&
      normalized.includes('source_file_retention_status')
    ) {
      return { rows: state.retentionCandidates }
    }
    if (
      normalized.includes('update public.document_assets') &&
      normalized.includes("metadata = coalesce(metadata, '{}'::jsonb)") &&
      normalized.includes('where id = $1')
    ) {
      state.assetStatusUpdates.push({ sql, params })
      return { rows: [] }
    }
    if (
      normalized.includes('from public.document_assets a') &&
      normalized.includes('order by a.created_at desc, a.id desc')
    ) {
      return { rows: state.adminAssets }
    }
    if (
      normalized.includes('from public.document_assets a') &&
      normalized.includes('left join public.document_import_batches b') &&
      normalized.includes('where a.id = $1')
    ) {
      return { rows: state.adminDetail?.asset ? [state.adminDetail.asset] : [] }
    }
    if (
      normalized.includes('select a.id, a.original_filename, a.storage_path') &&
      normalized.includes('from public.document_assets a') &&
      normalized.includes('where a.id = $1')
    ) {
      return { rows: state.adminDetail?.asset ? [state.adminDetail.asset] : [] }
    }
    if (normalized.includes('from public.document_parse_jobs')) {
      return { rows: state.adminDetail?.parseJobs || [] }
    }
    if (normalized.includes('from public.document_parse_results')) {
      return { rows: state.adminDetail?.parseResults || [] }
    }
    if (normalized.includes('from public.document_classification_results')) {
      return { rows: state.adminDetail?.classifications || [] }
    }
    if (normalized.includes('from public.document_entry_plans')) {
      return { rows: state.adminDetail?.entryPlans || [] }
    }
    if (normalized.includes('source_total_count') && normalized.includes('from public.document_business_links l')) {
      return { rows: [{ source_total_count: state.adminBusinessSources.length }] }
    }
    if (
      normalized.includes('from public.document_business_links l') &&
      normalized.includes('join public.document_assets a')
    ) {
      return { rows: state.adminBusinessSources }
    }
    if (
      normalized.includes('task_total_count') &&
      normalized.includes('from public.ai_business_recalculation_tasks t')
    ) {
      return { rows: [{ task_total_count: state.adminRecalculationTasks.length }] }
    }
    if (
      normalized.includes('from public.ai_business_recalculation_tasks t') &&
      normalized.includes('left join public.document_assets a') &&
      normalized.includes('order by')
    ) {
      return { rows: state.adminRecalculationTasks }
    }
    if (normalized.includes("to_regclass('scm.production_work_reports')")) {
      return {
        rows: [{
          table_name: state.productionWorkReportTableAvailable
            ? 'scm.production_work_reports'
            : null
        }]
      }
    }
    if (
      normalized.includes('production_work_report_total_count') &&
      normalized.includes('from scm.production_work_reports r')
    ) {
      return { rows: [{ production_work_report_total_count: state.adminProductionWorkReports.length }] }
    }
    if (
      normalized.includes('from scm.production_work_reports r') &&
      normalized.includes('order by r.report_date desc')
    ) {
      return { rows: state.adminProductionWorkReports }
    }
    if (normalized.includes("to_regclass('public.quality_inspections')")) {
      return {
        rows: [{
          table_name: state.qualityInspectionTableAvailable
            ? 'public.quality_inspections'
            : null
        }]
      }
    }
    if (
      normalized.includes('quality_inspection_total_count') &&
      normalized.includes('from public.quality_inspections i')
    ) {
      return { rows: [{ quality_inspection_total_count: state.adminQualityInspections.length }] }
    }
    if (
      normalized.includes('from public.quality_inspections i') &&
      normalized.includes('order by i.inspection_date desc')
    ) {
      return { rows: state.adminQualityInspections }
    }
    if (normalized.includes("to_regclass('hr.attendance_month_recalculation_snapshots')")) {
      return {
        rows: [{
          table_name: state.hrAttendanceSnapshotTableAvailable
            ? 'hr.attendance_month_recalculation_snapshots'
            : null
        }]
      }
    }
    if (normalized.includes("to_regclass('hr.v_payroll_precheck_attendance_snapshots')")) {
      return {
        rows: [{
          view_name: state.payrollPrecheckViewAvailable
            ? 'hr.v_payroll_precheck_attendance_snapshots'
            : null
        }]
      }
    }
    if (normalized.includes("to_regclass('hr.payroll_precheck_results')")) {
      return {
        rows: [{
          table_name: state.payrollPrecheckResultTableAvailable
            ? 'hr.payroll_precheck_results'
            : null
        }]
      }
    }
    if (normalized.includes("to_regclass('hr.v_payroll_ready_precheck_results')")) {
      return {
        rows: [{
          view_name: state.payrollReadyPrecheckViewAvailable
            ? 'hr.v_payroll_ready_precheck_results'
            : null
        }]
      }
    }
    if (
      normalized.includes('snapshot_total_count') &&
      normalized.includes('from hr.attendance_month_recalculation_snapshots s')
    ) {
      return { rows: [{ snapshot_total_count: state.adminHrAttendanceSnapshots.length }] }
    }
    if (
      normalized.includes('from hr.attendance_month_recalculation_snapshots s') &&
      normalized.includes('where s.id = $1')
    ) {
      return { rows: state.adminHrAttendanceSnapshots.filter((item) => item.id === params[0]) }
    }
    if (
      normalized.includes('from hr.attendance_month_recalculation_snapshots s') &&
      normalized.includes('order by s.recalculated_at desc')
    ) {
      return { rows: state.adminHrAttendanceSnapshots }
    }
    if (
      normalized.includes('precheck_total_count') &&
      normalized.includes('from hr.v_payroll_precheck_attendance_snapshots q')
    ) {
      return { rows: [{ precheck_total_count: state.adminPayrollPrecheckSnapshots.length }] }
    }
    if (
      normalized.includes('from hr.v_payroll_precheck_attendance_snapshots q') &&
      normalized.includes('where q.snapshot_id = $1')
    ) {
      return {
        rows: state.adminPayrollPrecheckSnapshots.filter((item) =>
          item.snapshot_id === params[0] || item.id === params[0]
        )
      }
    }
    if (
      normalized.includes('from hr.v_payroll_precheck_attendance_snapshots q') &&
      normalized.includes('order by q.payroll_precheck_requested_at desc')
    ) {
      return { rows: state.adminPayrollPrecheckSnapshots }
    }
    if (
      normalized.includes('result_total_count') &&
      normalized.includes('from hr.payroll_precheck_results r')
    ) {
      return { rows: [{ result_total_count: state.adminPayrollPrecheckResults.length }] }
    }
    if (
      normalized.includes('from hr.payroll_precheck_results r') &&
      normalized.includes('order by r.generated_at desc')
    ) {
      return { rows: state.adminPayrollPrecheckResults }
    }
    if (
      normalized.includes('ready_result_total_count') &&
      normalized.includes('from hr.v_payroll_ready_precheck_results r')
    ) {
      return { rows: [{ ready_result_total_count: state.adminPayrollPrecheckResults.filter((item) => item.trial_status === 'approved' && item.no_payroll_mutation === true).length }] }
    }
    if (
      normalized.includes('from hr.v_payroll_ready_precheck_results r') &&
      normalized.includes('order by r.reviewed_at desc')
    ) {
      return {
        rows: state.adminPayrollPrecheckResults
          .filter((item) => item.trial_status === 'approved' && item.no_payroll_mutation === true)
          .map((item) => ({
            ...item,
            read_only_reference: true,
            payroll_mutation_allowed: false,
            payroll_reference: {
              reference_table: 'hr.payroll_precheck_results',
              result_id: item.id,
              snapshot_id: item.snapshot_id,
              employee_month_key: item.employee_month_key,
              month: item.month,
              employee_no: item.employee_no,
              trial_status: item.trial_status,
              no_payroll_mutation: true
            }
          }))
      }
    }
    if (normalized.includes('insert into hr.payroll_precheck_results')) {
      state.payrollPrecheckTrialInserts.push(params)
      const existing = state.adminPayrollPrecheckResults.find((item) => item.snapshot_id === params[0])
      const row = {
        id: existing?.id || `77777777-7777-4777-8777-${String(state.adminPayrollPrecheckResults.length + 1).padStart(12, '0')}`,
        snapshot_id: params[0],
        employee_month_key: params[1],
        employee_id: params[2],
        employee_no: params[3],
        employee_name: params[4],
        dept_name: params[5],
        month: params[6],
        record_count: params[7],
        leave_count: params[8],
        absent_count: params[9],
        late_count: params[10],
        early_count: params[11],
        overtime_minutes: params[12],
        first_att_date: params[13],
        last_att_date: params[14],
        source_target_schema: params[15],
        source_target_table: params[16],
        source_target_record_id: params[17],
        asset_id: params[18],
        source_filename: params[19],
        file_hash: params[20],
        device_code: params[21],
        device_name: params[22],
        batch_no: params[23],
        upload_source: params[24],
        operator_source: params[25],
        uploaded_by_user_id: params[26],
        uploaded_by_username: params[27],
        uploaded_by_role: params[28],
        source_folder: params[29],
        asset_metadata: params[30],
        batch_status: params[31],
        trial_status: 'draft',
        calculation_version: 'attendance-precheck-v1',
        calculation_basis: params[32],
        result_payload: params[33],
        generated_by: params[34],
        generated_at: '2026-06-19T02:30:00.000Z',
        reviewed_by: null,
        reviewed_at: null,
        review_note: params[35],
        source_snapshot_reference: params[36],
        no_payroll_mutation: true,
        created_at: existing?.created_at || '2026-06-19T02:30:00.000Z',
        updated_at: '2026-06-19T02:30:00.000Z'
      }
      if (existing) {
        Object.assign(existing, row)
      } else {
        state.adminPayrollPrecheckResults.push(row)
      }
      return { rows: [row] }
    }
    if (normalized.includes('update hr.payroll_precheck_results')) {
      state.payrollPrecheckResultUpdates.push(params)
      const row = state.adminPayrollPrecheckResults.find((item) =>
        item.id === params[0] && item.no_payroll_mutation === true
      )
      if (!row) return { rows: [] }
      Object.assign(row, {
        trial_status: params[1],
        reviewed_by: params[2] || '',
        reviewed_at: '2026-06-19T02:40:00.000Z',
        review_note: params[3] || '',
        result_payload: {
          ...(row.result_payload || {}),
          status: params[1],
          reviewed_by: params[2] || '',
          reviewed_at: '2026-06-19T02:40:00.000Z',
          review_note: params[3] || '',
          noPayrollMutation: true,
          payrollMutationAllowed: false
        },
        no_payroll_mutation: true,
        updated_at: '2026-06-19T02:40:00.000Z'
      })
      return { rows: [row] }
    }
    if (
      normalized.includes('select id, confirmation_status') &&
      normalized.includes('from hr.attendance_month_recalculation_snapshots')
    ) {
      const snapshot = state.adminHrAttendanceSnapshots.find((item) => item.id === params[0])
      return { rows: snapshot ? [{ id: snapshot.id, confirmation_status: snapshot.confirmation_status }] : [] }
    }
    if (
      normalized.includes('update hr.attendance_month_recalculation_snapshots') &&
      normalized.includes("set confirmation_status = 'confirmed'")
    ) {
      const snapshot = state.adminHrAttendanceSnapshots.find((item) => item.id === params[0])
      if (!snapshot) return { rows: [] }
      Object.assign(snapshot, {
        confirmation_status: 'confirmed',
        confirmation_note: params[1] || '',
        confirmed_by: params[2] || '',
        confirmed_at: '2026-06-19T02:20:00.000Z',
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
        payroll_precheck_status: snapshot.payroll_precheck_status === 'ready' ? 'ready' : 'not_requested',
        updated_at: '2026-06-19T02:20:00.000Z'
      })
      return { rows: [{ id: snapshot.id }] }
    }
    if (
      normalized.includes('update hr.attendance_month_recalculation_snapshots') &&
      normalized.includes("confirmation_status = 'rejected'")
    ) {
      const snapshot = state.adminHrAttendanceSnapshots.find((item) => item.id === params[0])
      if (!snapshot) return { rows: [] }
      Object.assign(snapshot, {
        confirmation_status: 'rejected',
        confirmation_note: params[1] || '',
        confirmed_by: null,
        confirmed_at: null,
        rejected_by: params[2] || '',
        rejected_at: '2026-06-19T02:25:00.000Z',
        rejection_reason: params[3] || '',
        payroll_precheck_status: 'not_requested',
        payroll_precheck_requested_by: null,
        payroll_precheck_requested_at: null,
        payroll_precheck_note: null,
        updated_at: '2026-06-19T02:25:00.000Z'
      })
      return { rows: [{ id: snapshot.id }] }
    }
    if (
      normalized.includes('update hr.attendance_month_recalculation_snapshots') &&
      normalized.includes("payroll_precheck_status = 'ready'")
    ) {
      const snapshot = state.adminHrAttendanceSnapshots.find((item) =>
        item.id === params[0] && item.confirmation_status === 'confirmed'
      )
      if (!snapshot) return { rows: [] }
      Object.assign(snapshot, {
        payroll_precheck_status: 'ready',
        payroll_precheck_requested_by: params[1] || '',
        payroll_precheck_requested_at: '2026-06-19T02:22:00.000Z',
        payroll_precheck_note: params[2] || '',
        updated_at: '2026-06-19T02:22:00.000Z'
      })
      return { rows: [{ id: snapshot.id }] }
    }
    if (normalized.includes('from public.document_business_links')) {
      return { rows: state.adminDetail?.businessLinks || [] }
    }
    if (normalized.includes('from public.document_unmapped_fields')) {
      return { rows: state.adminDetail?.unmappedFields || [] }
    }
    if (normalized.includes('from public.ai_business_corrections')) {
      return { rows: state.adminDetail?.corrections || [] }
    }
    if (normalized.includes('from public.ai_business_recalculation_tasks')) {
      return { rows: state.adminDetail?.recalculationTasks || [] }
    }
    if (normalized.includes('from public.client_log_events')) {
      return { rows: state.adminDetail?.logs || [] }
    }
    if (normalized.includes('from public.collector_devices')) {
      if (normalized.includes("status <> 'disabled'") && state.device.status === 'disabled') {
        return { rows: [] }
      }
      return { rows: state.authorized ? [state.device] : [] }
    }
    if (normalized.includes('update public.collector_devices')) {
      const status = state.device.status === 'disabled' ? 'disabled' : 'active'
      const updated = {
        ...state.device,
        client_version: params[1] || state.device.client_version,
        webview_version: params[2] || state.device.webview_version,
        metadata: { ...(state.device.metadata || {}), ...(params[3] || {}) },
        status,
        last_seen_at: new Date().toISOString()
      }
      Object.assign(state.device, updated)
      return { rows: [updated] }
    }
    if (normalized.includes('from public.collector_watch_folders')) {
      return { rows: state.watchFolders }
    }
    if (normalized.includes('insert into public.client_log_events')) {
      state.clientLogInserts.push(params)
      return { rows: [] }
    }
    throw new Error(`Unexpected pool query: ${normalized}`)
  }

  async connect() {
    state.connected += 1
    return new FakeClient()
  }
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') return { Pool: FakePool }
  return originalLoad.call(this, request, parent, isMain)
}

const modulePath = '../../realtime/document-intake.js'
delete require.cache[require.resolve(modulePath)]
const { createDocumentIntakeHandlers } = require(modulePath)
Module._load = originalLoad

assert.equal(state.poolOptions.max, 5, 'invalid pool max env should fall back to 5')
assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')

function resetState() {
  state.authorized = true
  state.duplicateRows = []
  state.watchFolders = []
  state.uploadSessions = new Map()
  state.uploadChunks = new Map()
  state.businessLink = null
  state.correctionInserts = []
  state.recalculationTaskInserts = []
  state.businessLinkUpdates = []
  state.adminReviewPlan = null
  state.entryPlanUpdates = []
  state.adminOverview = {
    assetMetrics: {},
    deviceMetrics: {},
    recalculationTaskMetrics: {},
    statusBreakdown: []
  }
  state.adminAssets = []
  state.adminDetail = null
  state.adminBusinessSources = []
  state.adminRecalculationTasks = []
  state.adminProductionWorkReports = []
  state.productionWorkReportTableAvailable = true
  state.adminQualityInspections = []
  state.qualityInspectionTableAvailable = true
  state.adminHrAttendanceSnapshots = []
  state.hrAttendanceSnapshotTableAvailable = true
  state.adminPayrollPrecheckSnapshots = []
  state.payrollPrecheckViewAvailable = true
  state.adminPayrollPrecheckResults = []
  state.payrollPrecheckResultTableAvailable = true
  state.payrollReadyPrecheckViewAvailable = true
  state.payrollPrecheckTrialInserts = []
  state.payrollPrecheckResultUpdates = []
  state.adminDevices = []
  state.adminWatchFolders = []
  state.adminLogs = []
  state.retentionCandidates = []
  state.adminDeviceInserts = []
  state.adminDeviceUpdates = []
  state.adminBindResets = []
  state.watchFolderInserts = []
  state.clientLogInserts = []
  Object.assign(state.device, {
    id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    default_user_id: 'u_1',
    default_username: 'operator',
    default_role: 'warehouse',
    status: 'active',
    metadata: {}
  })
  delete state.device.binding_code_hash
  delete state.device.device_token_hash
  delete state.device.client_version
  delete state.device.last_seen_at
  delete state.device.updated_at
  state.clientQueries = []
  state.poolQueries = []
  state.assetInsertParams = []
  state.parseJobInserts = 0
  state.parseJobUpdates = []
  state.parseResultInserts = []
  state.classificationInserts = []
  state.entryPlanInserts = []
  state.unmappedFieldInserts = []
  state.assetStatusUpdates = []
  state.batchStatusUpdates = []
  state.connected = 0
}

function makeRequest(body = Buffer.alloc(0), headers = {}, url = '/', method = 'POST') {
  const req = Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(String(body))])
  req.headers = headers
  req.url = url
  req.method = method
  return req
}

async function collectBody(req, maxBytes = 1024 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('Payload too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  return text ? JSON.parse(text) : {}
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.payload = payload
}

const handlers = createDocumentIntakeHandlers({ sendJson, readJsonBody: collectBody })

async function call(handler, body, headers = {}) {
  const res = {}
  await handler(makeRequest(body, headers), res)
  return res
}

async function callJson(handler, body, url = '/', method = 'POST') {
  const res = {}
  await handler(makeRequest(JSON.stringify(body || {}), { 'content-type': 'application/json' }, url, method), res)
  return res
}

async function callRelease(url) {
  const res = {
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
    }
  }
  await handlers.handleGetCollectorRelease(makeRequest('', {}, url, 'GET'), res)
  return res
}

async function callGet(handler, url) {
  const res = {}
  await handler(makeRequest('', {}, url, 'GET'), res)
  return res
}

async function callDownloadAsset(url) {
  const res = {
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
    }
  }
  await handlers.handleDownloadAdminAsset(makeRequest('', {}, url, 'GET'), res)
  return res
}

async function callPreviewAsset(url) {
  const res = {}
  await handlers.handlePreviewAdminAsset(makeRequest('', {}, url, 'GET'), res)
  return res
}

async function headRelease(url) {
  const res = {
    ended: false,
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
    },
    end() {
      this.ended = true
    }
  }
  await handlers.handleGetCollectorRelease(makeRequest('', {}, url, 'HEAD'), res)
  return res
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function multipartBody(boundary, { metadata, metadataRaw, filename = 'upload.txt', fileContent = Buffer.from('hello'), fileField = 'file' } = {}) {
  const chunks = []
  const pushText = (text) => chunks.push(Buffer.from(text, 'utf8'))
  pushText(`--${boundary}\r\n`)
  pushText('Content-Disposition: form-data; name="metadata"\r\n')
  pushText('Content-Type: application/json\r\n\r\n')
  pushText(metadataRaw ?? JSON.stringify(metadata || {}))
  pushText(`\r\n--${boundary}\r\n`)
  pushText(`Content-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\n`)
  pushText('Content-Type: text/plain\r\n\r\n')
  chunks.push(fileContent)
  pushText(`\r\n--${boundary}--\r\n`)
  return Buffer.concat(chunks)
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(fullPath))
    if (entry.isFile()) files.push(fullPath)
  }
  return files
}

try {
  resetState()
  const missingFields = await call(
    handlers.handleBindDevice,
    JSON.stringify({ enterpriseCode: 'tenant001' }),
    { 'content-type': 'application/json' }
  )
  assert.equal(missingFields.statusCode, 400, 'bind should reject missing device/code fields')
  assert.equal(missingFields.payload.code, 'BIND_FIELDS_REQUIRED')
  assert.equal(state.connected, 0, 'bind validation should fail before opening a DB transaction')

  resetState()
  state.device.binding_code_hash = sha256('local-bind-code')
  const boundDevice = await call(
    handlers.handleBindDevice,
    JSON.stringify({
      enterpriseCode: 'local',
      deviceCode: 'warehouse-pc-01',
      deviceName: 'Local Collector 01',
      authorizationCode: 'local-bind-code',
      defaultUserId: 'local-user',
      defaultUsername: 'local-user',
      defaultRole: 'warehouse',
      clientVersion: '0.2.0',
      webViewVersion: 'WebView2/123'
    }),
    { 'content-type': 'application/json' }
  )
  assert.equal(boundDevice.statusCode, 200, `bind should update an existing device: ${JSON.stringify(boundDevice.payload)}`)
  assert.ok(boundDevice.payload.deviceToken, 'bind should issue a device token')
  assert.equal(boundDevice.payload.deviceName, 'Local Collector 01')
  assert.equal(boundDevice.payload.defaultUserId, 'local-user')
  assert.equal(state.connected, 1, 'bind should open one DB transaction')
  assert.ok(state.clientQueries.some((query) => String(query.sql).trim().toLowerCase() === 'begin'), 'bind should start a transaction')
  assert.ok(state.clientQueries.some((query) => String(query.sql).trim().toLowerCase() === 'commit'), 'bind should commit the transaction')
  const bindUpdate = state.clientQueries.find((query) => /update public\.collector_devices/i.test(query.sql))
  assert.ok(bindUpdate, 'bind should update the existing collector device')
  assert.equal(bindUpdate.params.length, 9, 'existing-device bind update should not pass an unused enterprise parameter')
  assert.equal(bindUpdate.params[0], 'device-1')
  assert.equal(bindUpdate.params[1], 'Local Collector 01')
  assert.equal(bindUpdate.params[2], 'local-user')
  assert.equal(bindUpdate.params[3], 'local-user')
  assert.equal(bindUpdate.params[4], 'warehouse')
  assert.match(bindUpdate.params[5], /^[a-f0-9]{64}$/)
  assert.equal(bindUpdate.params[6], '0.2.0')
  assert.equal(bindUpdate.params[7], 'WebView2/123')
  assert.equal(bindUpdate.params[8].bind_source, 'device_binding_code')

  resetState()
  state.authorized = false
  const unauthorized = await call(handlers.handleHeartbeat, '{}', { authorization: 'Bearer bad-token' })
  assert.equal(unauthorized.statusCode, 401, 'heartbeat should require a valid device token')
  assert.equal(unauthorized.payload.code, 'UNAUTHORIZED_DEVICE')

  resetState()
  state.device.status = 'disabled'
  const disabledConfigAccess = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(disabledConfigAccess.statusCode, 401, 'disabled device should not fetch remote config')
  assert.equal(disabledConfigAccess.payload.code, 'UNAUTHORIZED_DEVICE')
  const disabledHeartbeat = await call(
    handlers.handleHeartbeat,
    JSON.stringify({ clientVersion: '9.9.9' }),
    { authorization: 'Bearer good-token' }
  )
  assert.equal(disabledHeartbeat.statusCode, 401, 'disabled device heartbeat should not reactivate the device')
  assert.equal(disabledHeartbeat.payload.code, 'UNAUTHORIZED_DEVICE')
  assert.equal(state.device.status, 'disabled', 'disabled device status should remain disabled after heartbeat')

  const releaseDir = process.env.COLLECTOR_RELEASE_DIR
  await fs.mkdir(releaseDir, { recursive: true })
  const releaseManifest = Buffer.from(JSON.stringify({ version: '0.2.0' }))
  const releaseInstaller = Buffer.from('collector installer bytes')
  await fs.writeFile(path.join(releaseDir, 'update.json'), releaseManifest)
  await fs.writeFile(path.join(releaseDir, 'EISCore.Collector-0.2.0-win-x64-setup.exe'), releaseInstaller)
  const releaseManifestResponse = await callRelease('/document-intake/collector/releases/update.json')
  assert.equal(releaseManifestResponse.statusCode, 200, 'collector release manifest should be served')
  assert.equal(releaseManifestResponse.headers['Content-Type'], 'application/json; charset=utf-8')
  assert.equal(releaseManifestResponse.headers['Cache-Control'], 'no-store')
  assert.equal(releaseManifestResponse.body.toString('utf8'), releaseManifest.toString('utf8'))
  const releaseInstallerResponse = await callRelease('/document-intake/collector/releases/EISCore.Collector-0.2.0-win-x64-setup.exe')
  assert.equal(releaseInstallerResponse.statusCode, 200, 'collector release installer should be served')
  assert.equal(releaseInstallerResponse.headers['Content-Type'], 'application/vnd.microsoft.portable-executable')
  assert.equal(releaseInstallerResponse.headers['Content-Length'], String(releaseInstaller.length))
  assert.equal(releaseInstallerResponse.body.toString('utf8'), releaseInstaller.toString('utf8'))
  const releaseInstallerHead = await headRelease('/document-intake/collector/releases/EISCore.Collector-0.2.0-win-x64-setup.exe')
  assert.equal(releaseInstallerHead.statusCode, 200, 'collector release installer should support HEAD')
  assert.equal(releaseInstallerHead.headers['Content-Length'], String(releaseInstaller.length))
  assert.equal(releaseInstallerHead.ended, true, 'HEAD release response should end without a body')
  assert.equal(releaseInstallerHead.body, undefined, 'HEAD release response should not read the file body')
  const badReleasePath = await callRelease('/document-intake/collector/releases/..%2Fsecret.txt')
  assert.equal(badReleasePath.statusCode, 400, 'collector release route should reject path traversal')
  assert.equal(badReleasePath.payload.code, 'COLLECTOR_RELEASE_FILE_INVALID')
  const missingRelease = await callRelease('/document-intake/collector/releases/missing.exe')
  assert.equal(missingRelease.statusCode, 404, 'collector release route should return 404 for missing files')
  assert.equal(missingRelease.payload.code, 'COLLECTOR_RELEASE_NOT_FOUND')

  resetState()
  state.device.metadata = {
    remote_config: {
      version: 'cfg-v2',
      default_user_id: 'u_remote',
      default_username: 'remote-user',
      default_role: '远程仓库员',
      auto_start_enabled: true,
      heartbeat_interval_seconds: 45,
      watch_folders: [
        {
          folder_path: 'D:\\EISCore\\Inbox',
          folder_name: '仓库收单',
          default_user_id: 'u_folder',
          default_username: 'folder-user',
          default_role: '仓库员',
          enabled: true
        }
      ],
      upload: {
        max_file_bytes: 10 * 1024 * 1024,
        chunk_size_bytes: 1024 * 1024,
        retry_interval_seconds: 20,
        max_retry_count: 7,
        queue_retention_days: 9,
        allowed_extensions: ['.pdf', '.xlsx']
      },
      logs: {
        enabled: false,
        batch_size: 50,
        flush_interval_seconds: 12,
        retention_days: 15,
        high_priority_immediate: false
      },
      update: {
        enabled: true,
        manifest_url: 'https://example.test/eiscore-collector/update.json',
        check_interval_hours: 6,
        auto_install: false,
        installer_arguments: '/quiet /norestart'
      }
    }
  }
  const remoteConfig = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(remoteConfig.statusCode, 200, 'device config endpoint should return remote config')
  assert.equal(remoteConfig.payload.configVersion, 'cfg-v2')
  assert.equal(remoteConfig.payload.config.defaultUserId, 'u_remote')
  assert.equal(remoteConfig.payload.config.defaultUsername, 'remote-user')
  assert.equal(remoteConfig.payload.config.defaultRole, '远程仓库员')
  assert.equal(remoteConfig.payload.config.autoStartEnabled, true)
  assert.equal(remoteConfig.payload.config.heartbeatIntervalSeconds, 45)
  assert.equal(remoteConfig.payload.config.watchFolders[0].folderPath, 'D:\\EISCore\\Inbox')
  assert.equal(remoteConfig.payload.config.watchFolders[0].defaultUsername, 'folder-user')
  assert.equal(remoteConfig.payload.config.upload.maxFileBytes, 10 * 1024 * 1024)
  assert.equal(remoteConfig.payload.config.upload.chunkSizeBytes, 1024 * 1024)
  assert.equal(remoteConfig.payload.config.upload.queueRetentionDays, 9)
  assert.deepEqual(remoteConfig.payload.config.upload.allowedExtensions, ['.pdf', '.xlsx'])
  assert.equal(remoteConfig.payload.config.logs.enabled, false)
  assert.equal(remoteConfig.payload.config.logs.batchSize, 50)
  assert.equal(remoteConfig.payload.config.logs.retentionDays, 15)
  assert.equal(remoteConfig.payload.config.logs.highPriorityImmediate, false)
  assert.equal(remoteConfig.payload.config.update.enabled, true)
  assert.equal(remoteConfig.payload.config.update.manifestUrl, 'https://example.test/eiscore-collector/update.json')
  assert.equal(remoteConfig.payload.config.update.checkIntervalHours, 6)
  assert.equal(remoteConfig.payload.config.update.autoInstall, false)
  assert.equal(remoteConfig.payload.config.update.installerArguments, '/quiet /norestart')
  assert.equal(remoteConfig.payload.device.deviceTokenHash, undefined, 'device config should not leak token hashes')

  resetState()
  state.device.metadata = {
    remote_config: {
      autoStartEnabled: 'false',
      logs: { highPriorityImmediate: false }
    }
  }
  const camelBooleanConfig = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(camelBooleanConfig.statusCode, 200, 'device config should accept camelCase boolean flags')
  assert.equal(camelBooleanConfig.payload.config.autoStartEnabled, false)
  assert.equal(camelBooleanConfig.payload.config.logs.highPriorityImmediate, false)

  resetState()
  state.watchFolders = [{
    folder_path: 'E:\\EISCore\\DefaultInbox',
    folder_name: '默认收单',
    default_user_id: 'u_table',
    default_username: 'table-user',
    default_role: '表配置角色',
    enabled: true
  }]
  const defaultConfig = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(defaultConfig.statusCode, 200, 'device config endpoint should work without remote metadata')
  assert.equal(defaultConfig.payload.configVersion, 'default')
  assert.equal(defaultConfig.payload.config.defaultUserId, 'u_1')
  assert.equal(defaultConfig.payload.config.watchFolders.length, 1)
  assert.equal(defaultConfig.payload.config.watchFolders[0].folderPath, 'E:\\EISCore\\DefaultInbox')
  assert.equal(defaultConfig.payload.config.watchFolders[0].defaultUserId, 'u_table')
  assert.equal(defaultConfig.payload.config.watchFolders[0].defaultUsername, 'table-user')
  assert.equal(defaultConfig.payload.config.upload.maxFileBytes, 256 * 1024 * 1024)
  assert.deepEqual(defaultConfig.payload.config.upload.allowedExtensions, defaultCollectorAllowedExtensions)
  assert.equal(defaultConfig.payload.config.logs.enabled, true)
  assert.equal(defaultConfig.payload.config.logs.retentionDays, 30)

  resetState()
  state.device.metadata = { remote_config: { upload: { allowed_extensions: [] } } }
  const emptyAllowedConfig = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(emptyAllowedConfig.statusCode, 200, 'device config endpoint should accept explicit empty allowed extensions')
  assert.deepEqual(
    emptyAllowedConfig.payload.config.upload.allowedExtensions,
    [],
    'explicit empty allowed_extensions should not fall back to the default extension allow list'
  )

  resetState()
  state.watchFolders = [{ folder_path: 'F:\\HeartbeatInbox', folder_name: '心跳目录', enabled: true }]
  const heartbeatWithConfig = await call(
    handlers.handleHeartbeat,
    JSON.stringify({
      clientVersion: '1.2.3',
      webViewVersion: 'WebView2/124',
      health: {
        pendingLogCount: 2,
        totalUploadQueueCount: 5,
        uploadQueueByStatus: { queued: 3, failed: 2 },
        missingWatchFolderCount: 1
      }
    }),
    { authorization: 'Bearer good-token' }
  )
  assert.equal(
    heartbeatWithConfig.statusCode,
    200,
    `heartbeat should still succeed: ${JSON.stringify(heartbeatWithConfig.payload)}`
  )
  assert.equal(heartbeatWithConfig.payload.config.watchFolders[0].folderPath, 'F:\\HeartbeatInbox')
  assert.equal(state.device.client_version, '1.2.3')
  assert.equal(state.device.webview_version, 'WebView2/124')
  assert.equal(state.device.metadata.heartbeat_payload.health.pendingLogCount, 2)
  assert.equal(state.device.metadata.heartbeat_payload.health.uploadQueueByStatus.failed, 2)

  resetState()
  const unsafeClientLogBatch = await call(
    handlers.handleLogBatch,
    JSON.stringify({
      events: [{
        level: 'error',
        eventType: 'frontend_js_error',
        message: 'Authorization: Bearer message-secret token=plain-secret api_key=api-secret client_secret=client-secret csrf_token=csrf-secret phone 13812345678 id 110101199001011234',
        stack: 'stack with jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstu',
        route: '/collector/upload?token=route-secret',
        url: 'https://user:pass@example.test/page?token=url-secret&x-csrf-token=url-csrf-secret&ok=1',
        requestUrl: 'https://example.test/api?access_token=request-secret',
        clientSessionId: 'session-secret',
        traceId: 'trace-secret',
        metadata: {
          token: 'metadata-token-secret',
          cookie: 'session=metadata-cookie-secret',
          clientSecret: 'metadata-client-secret',
          csrfToken: 'metadata-csrf-secret',
          'x-csrf-token': 'metadata-x-csrf-secret',
          nested: {
            note: 'call 13900001111 and id 110101199001011234',
            url: 'https://meta:secret@example.test/?device_token=metadata-query-secret&client_secret=metadata-query-client-secret'
          },
          list: ['Bearer list-secret']
        }
      }]
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(unsafeClientLogBatch.statusCode, 200, `unsafe client logs should upload: ${JSON.stringify(unsafeClientLogBatch.payload)}`)
  assert.equal(unsafeClientLogBatch.payload.inserted, 1)
  assert.equal(state.clientLogInserts.length, 1, 'log batch should insert one sanitized log row')
  const sanitizedLogParams = JSON.stringify(state.clientLogInserts[0])
  for (const secret of [
    'message-secret',
    'plain-secret',
    'api-secret',
    'client-secret',
    'csrf-secret',
    'route-secret',
    'url-secret',
    'url-csrf-secret',
    'request-secret',
    'user:pass',
    'metadata-token-secret',
    'metadata-cookie-secret',
    'metadata-client-secret',
    'metadata-csrf-secret',
    'metadata-x-csrf-secret',
    'metadata-query-secret',
    'metadata-query-client-secret',
    'meta:secret',
    'list-secret',
    '13812345678',
    '13900001111',
    '110101199001011234'
  ]) {
    assert.ok(!sanitizedLogParams.includes(secret), `server-side log sanitization should remove ${secret}`)
  }
  assert.ok(sanitizedLogParams.includes('139****1111'), 'server-side log sanitization should mask phone numbers')
  assert.ok(sanitizedLogParams.includes('110101********1234'), 'server-side log sanitization should mask id cards')
  assert.equal(state.clientLogInserts[0][20].token, '***', 'server-side log sanitization should redact sensitive metadata keys')
  assert.equal(state.clientLogInserts[0][20].cookie, '***', 'server-side log sanitization should redact cookie metadata keys')
  assert.equal(state.clientLogInserts[0][20].clientSecret, '***', 'server-side log sanitization should redact client secret metadata keys')
  assert.equal(state.clientLogInserts[0][20].csrfToken, '***', 'server-side log sanitization should redact CSRF metadata keys')
  assert.equal(state.clientLogInserts[0][20]['x-csrf-token'], '***', 'server-side log sanitization should redact x-csrf metadata keys')

  resetState()
  const missingCorrectionFields = await call(
    handlers.handleRecordBusinessCorrection,
    JSON.stringify({ fieldName: 'quantity' }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(missingCorrectionFields.statusCode, 400, 'correction endpoint should require a link or target identifiers')
  assert.equal(missingCorrectionFields.payload.code, 'CORRECTION_FIELDS_REQUIRED')
  assert.equal(state.connected, 0, 'invalid correction payload should fail before opening a DB transaction')

  resetState()
  state.businessLink = {
    id: '11111111-1111-4111-8111-111111111111',
    target_schema: 'app_data',
    target_table: 'purchase_receipts',
    target_record_id: 'receipt-001',
    target_module: 'materials',
    target_document_type: '采购入库单',
    metadata: { ai_generated: true }
  }
  const businessCorrection = await call(
    handlers.handleRecordBusinessCorrection,
    JSON.stringify({
      businessLinkId: state.businessLink.id,
      fieldName: 'quantity',
      oldValue: '10',
      newValue: '12',
      correctionType: 'manual_correction',
      affectsBusinessResult: true,
      recalculationStatus: 'pending',
      correctedBy: 'warehouse-user',
      traceId: 'trace-correction-1',
      metadata: { reason: '人工复核修正' }
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(businessCorrection.statusCode, 200, `correction should be recorded: ${JSON.stringify(businessCorrection.payload)}`)
  assert.equal(businessCorrection.payload.ok, true)
  assert.equal(businessCorrection.payload.businessLinkId, state.businessLink.id)
  assert.equal(businessCorrection.payload.target.schema, 'app_data')
  assert.equal(businessCorrection.payload.target.table, 'purchase_receipts')
  assert.equal(businessCorrection.payload.target.recordId, 'receipt-001')
  assert.equal(businessCorrection.payload.affectsBusinessResult, true)
  assert.equal(businessCorrection.payload.recalculationStatus, 'pending')
  assert.equal(businessCorrection.payload.businessCorrectionPolicy, 'record_and_recalculate')
  assert.equal(businessCorrection.payload.recalculationTask.id, 'recalc-task-1')
  assert.equal(businessCorrection.payload.recalculationTask.status, 'pending')
  assert.equal(state.correctionInserts.length, 1, 'correction endpoint should insert one audit row')
  assert.equal(state.correctionInserts[0][0], state.businessLink.id)
  assert.equal(state.correctionInserts[0][1], 'app_data')
  assert.equal(state.correctionInserts[0][2], 'purchase_receipts')
  assert.equal(state.correctionInserts[0][3], 'receipt-001')
  assert.equal(state.correctionInserts[0][4], 'quantity')
  assert.equal(state.correctionInserts[0][5], '10')
  assert.equal(state.correctionInserts[0][6], '12')
  assert.equal(state.correctionInserts[0][7], 'manual_correction')
  assert.equal(state.correctionInserts[0][8], true)
  assert.equal(state.correctionInserts[0][9], 'pending')
  assert.equal(state.correctionInserts[0][10], 'warehouse-user')
  const correctionMetadata = JSON.parse(state.correctionInserts[0][11])
  assert.equal(correctionMetadata.reason, '人工复核修正')
  assert.equal(correctionMetadata.source, 'document_intake_api')
  assert.equal(correctionMetadata.device_id, 'device-1')
  assert.equal(correctionMetadata.trace_id, 'trace-correction-1')
  assert.equal(correctionMetadata.business_correction_policy, 'record_and_recalculate')
  assert.equal(state.recalculationTaskInserts.length, 1, 'impacting corrections should enqueue one recalculation task')
  assert.equal(state.recalculationTaskInserts[0][0], 'correction-1')
  assert.equal(state.recalculationTaskInserts[0][1], state.businessLink.id)
  assert.equal(state.recalculationTaskInserts[0][2], 'app_data')
  assert.equal(state.recalculationTaskInserts[0][3], 'purchase_receipts')
  assert.equal(state.recalculationTaskInserts[0][4], 'receipt-001')
  assert.equal(state.recalculationTaskInserts[0][5], 'business_result_recalculation')
  assert.equal(state.recalculationTaskInserts[0][6], 'pending')
  assert.equal(state.recalculationTaskInserts[0][8], 'warehouse-user')
  const recalculationTaskMetadata = JSON.parse(state.recalculationTaskInserts[0][9])
  assert.equal(recalculationTaskMetadata.business_correction_policy, 'record_and_recalculate')
  assert.equal(recalculationTaskMetadata.field_name, 'quantity')
  assert.equal(recalculationTaskMetadata.trace_id, 'trace-correction-1')
  assert.equal(state.businessLinkUpdates.length, 1, 'correction endpoint should update the linked AI business metadata')
  assert.equal(state.businessLinkUpdates[0][0], state.businessLink.id)
  const linkMetadata = JSON.parse(state.businessLinkUpdates[0][1])
  assert.equal(linkMetadata.ai_review_status, 'corrected')
  assert.equal(linkMetadata.last_correction_id, 'correction-1')
  assert.equal(linkMetadata.last_corrected_by, 'warehouse-user')
  assert.equal(linkMetadata.recalculation_task_id, 'recalc-task-1')
  assert.equal(linkMetadata.recalculation_task_status, 'pending')

  resetState()
  state.adminOverview = {
    assetMetrics: {
      today_file_count: 8,
      today_imported_count: 5,
      classified_count: 1,
      archived_count: 1,
      low_confidence_count: 2,
      unrecognized_count: 1,
      duplicate_count: 1,
      failed_count: 1
    },
    deviceMetrics: {
      active_device_count: 3,
      offline_device_count: 1
    },
    recalculationTaskMetrics: {
      pending_recalculation_task_count: 4,
      failed_recalculation_task_count: 1
    },
    statusBreakdown: [
      { status: 'imported', status_count: 5 },
      { status: 'unrecognized', status_count: 1 }
    ]
  }
  const adminOverview = await callGet(
    handlers.handleGetAdminOverview,
    '/document-intake/admin/overview?confidenceThreshold=0.75&activeWindowMinutes=15'
  )
  assert.equal(adminOverview.statusCode, 200, `admin overview should load: ${JSON.stringify(adminOverview.payload)}`)
  assert.equal(adminOverview.payload.confidenceThreshold, 0.75)
  assert.equal(adminOverview.payload.activeWindowMinutes, 15)
  assert.equal(adminOverview.payload.policies.defaultAutoImportMode, 'review_required')
  assert.equal(adminOverview.payload.policies.lowConfidencePolicy, 'archive_only')
  assert.equal(adminOverview.payload.policies.confidenceThreshold, 0.75)
  assert.equal(adminOverview.payload.policies.unmappedFieldPolicy, 'remarks')
  assert.equal(adminOverview.payload.metrics.todayFileCount, 8)
  assert.equal(adminOverview.payload.metrics.todayImportedCount, 5)
  assert.equal(adminOverview.payload.metrics.classifiedCount, 1)
  assert.equal(adminOverview.payload.metrics.archivedCount, 1)
  assert.equal(adminOverview.payload.metrics.lowConfidenceCount, 2)
  assert.equal(adminOverview.payload.metrics.activeDeviceCount, 3)
  assert.equal(adminOverview.payload.metrics.pendingRecalculationTaskCount, 4)
  assert.equal(adminOverview.payload.metrics.failedRecalculationTaskCount, 1)
  assert.deepEqual(adminOverview.payload.statusBreakdown[0], { status: 'imported', count: 5 })
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('classified_count') && sql.includes('archived_count')
    }),
    'admin overview should expose classified and archived asset counts'
  )

  const policyRead = await callGet(
    handlers.handleGetAdminPolicies,
    '/document-intake/admin/policies'
  )
  assert.equal(policyRead.statusCode, 200, `admin policies should load: ${JSON.stringify(policyRead.payload)}`)
  assert.equal(policyRead.payload.policy.defaultAutoImportMode, 'review_required')
  assert.equal(policyRead.payload.policy.lowConfidencePolicy, 'archive_only')
  assert.equal(policyRead.payload.policy.confidenceThreshold, 0.82)
  assert.ok(policyRead.payload.options.defaultAutoImportMode.includes('auto_import'))

  const policyUpdate = await callJson(
    handlers.handleUpdateAdminPolicies,
    {
      policy: {
        enabled: false,
        defaultAutoImportMode: 'archive_only',
        lowConfidencePolicy: 'review_required',
        unrecognizedFilePolicy: 'reject',
        duplicateFilePolicy: 'link_existing',
        unmappedFieldPolicy: 'properties',
        businessCorrectionPolicy: 'manual_review',
        logCollectionEnabled: false,
        confidenceThreshold: 0.64,
        logRetentionDays: 45,
        sourceFileRetentionDays: 90
      }
    },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(policyUpdate.statusCode, 200, `admin policies should update: ${JSON.stringify(policyUpdate.payload)}`)
  assert.equal(policyUpdate.payload.policy.enabled, false)
  assert.equal(policyUpdate.payload.policy.defaultAutoImportMode, 'archive_only')
  assert.equal(policyUpdate.payload.policy.businessCorrectionPolicy, 'manual_review')
  assert.equal(policyUpdate.payload.policy.logCollectionEnabled, false)
  assert.equal(policyUpdate.payload.policy.confidenceThreshold, 0.64)
  assert.equal(policyUpdate.payload.source, 'file')

  const deviceConfigAfterPolicyUpdate = await call(
    handlers.handleGetDeviceConfig,
    '',
    { authorization: 'Bearer good-token' }
  )
  assert.equal(deviceConfigAfterPolicyUpdate.statusCode, 200)
  assert.equal(deviceConfigAfterPolicyUpdate.payload.config.logs.enabled, false)
  assert.equal(deviceConfigAfterPolicyUpdate.payload.config.logs.retentionDays, 45)

  const persistedPolicy = JSON.parse(await fs.readFile(process.env.DOCUMENT_INTAKE_POLICY_FILE, 'utf8'))
  assert.equal(persistedPolicy.defaultAutoImportMode, 'archive_only')
  assert.equal(persistedPolicy.sourceFileRetentionDays, 90)

  const retentionFile = path.join(tmpRoot, 'retention-source-file.txt')
  const outsideRetentionFile = path.join(os.tmpdir(), `eiscore-outside-retention-${Date.now()}.txt`)
  await fs.writeFile(retentionFile, 'old source file')
  await fs.writeFile(outsideRetentionFile, 'outside source file')
  state.retentionCandidates = [
    {
      id: 'retention-asset-1',
      original_filename: 'retention-source-file.txt',
      storage_path: retentionFile,
      file_size: 15,
      created_at: '2026-01-01T00:00:00.000Z',
      metadata: {}
    },
    {
      id: 'retention-asset-2',
      original_filename: 'missing-source-file.txt',
      storage_path: path.join(tmpRoot, 'missing-source-file.txt'),
      file_size: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      metadata: {}
    },
    {
      id: 'retention-asset-3',
      original_filename: 'outside-source-file.txt',
      storage_path: outsideRetentionFile,
      file_size: 19,
      created_at: '2026-01-01T00:00:00.000Z',
      metadata: {}
    }
  ]
  const retentionDryRun = await callJson(
    handlers.handleRunAdminSourceFileRetention,
    { dryRun: true, limit: 5 },
    '/document-intake/admin/source-file-retention/run',
    'POST'
  )
  assert.equal(retentionDryRun.statusCode, 200, `source retention dry-run should load: ${JSON.stringify(retentionDryRun.payload)}`)
  assert.equal(retentionDryRun.payload.dryRun, true)
  assert.equal(retentionDryRun.payload.retentionDays, 90)
  assert.equal(retentionDryRun.payload.scannedCount, 3)
  assert.equal(retentionDryRun.payload.deletedCount, 0)
  assert.equal(retentionDryRun.payload.updatedCount, 0)
  assert.equal(retentionDryRun.payload.items[0].action, 'would_delete')
  assert.equal(retentionDryRun.payload.items[1].action, 'would_mark_missing')
  assert.equal(retentionDryRun.payload.items[2].reason, 'outside_storage_root')
  assert.ok(await fs.stat(retentionFile), 'dry-run should not delete source files')

  state.assetStatusUpdates = []
  const retentionRun = await callJson(
    handlers.handleRunAdminSourceFileRetention,
    { dryRun: false, limit: 5 },
    '/document-intake/admin/source-file-retention/run',
    'POST'
  )
  assert.equal(retentionRun.statusCode, 200, `source retention run should complete: ${JSON.stringify(retentionRun.payload)}`)
  assert.equal(retentionRun.payload.dryRun, false)
  assert.equal(retentionRun.payload.deletedCount, 1)
  assert.equal(retentionRun.payload.missingCount, 1)
  assert.equal(retentionRun.payload.skippedCount, 1)
  assert.equal(retentionRun.payload.updatedCount, 2)
  await assert.rejects(() => fs.stat(retentionFile), /ENOENT/)
  assert.ok(await fs.stat(outsideRetentionFile), 'retention run should not delete files outside storageRoot')
  assert.equal(state.assetStatusUpdates.length, 2, 'retention run should mark deleted and missing assets as purged')
  const retentionMetadata = JSON.parse(state.assetStatusUpdates[0].params[1])
  assert.equal(retentionMetadata.source_file_retention_status, 'purged')
  assert.equal(retentionMetadata.source_file_retention_action, 'delete_file')
  assert.equal(retentionMetadata.source_file_retention_days, 90)
  const missingRetentionMetadata = JSON.parse(state.assetStatusUpdates[1].params[1])
  assert.equal(missingRetentionMetadata.source_file_retention_action, 'mark_missing')
  await fs.rm(outsideRetentionFile, { force: true })

  const invalidPolicyUpdate = await callJson(
    handlers.handleUpdateAdminPolicies,
    { policy: { defaultAutoImportMode: 'invalid-mode', duplicateFilePolicy: 'invalid-duplicate' } },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(invalidPolicyUpdate.statusCode, 200)
  assert.equal(invalidPolicyUpdate.payload.policy.defaultAutoImportMode, 'archive_only')
  assert.equal(invalidPolicyUpdate.payload.policy.duplicateFilePolicy, 'link_existing')

  const updatedOverview = await callGet(
    handlers.handleGetAdminOverview,
    '/document-intake/admin/overview'
  )
  assert.equal(updatedOverview.statusCode, 200)
  assert.equal(updatedOverview.payload.confidenceThreshold, 0.64)
  assert.equal(updatedOverview.payload.policies.enabled, false)
  assert.equal(updatedOverview.payload.policies.defaultAutoImportMode, 'archive_only')

  const policyReset = await callJson(
    handlers.handleResetAdminPolicies,
    {},
    '/document-intake/admin/policies/reset',
    'POST'
  )
  assert.equal(policyReset.statusCode, 200, `admin policies should reset: ${JSON.stringify(policyReset.payload)}`)
  assert.equal(policyReset.payload.policy.enabled, true)
  assert.equal(policyReset.payload.policy.defaultAutoImportMode, 'review_required')
  assert.equal(policyReset.payload.policy.lowConfidencePolicy, 'archive_only')
  assert.equal(policyReset.payload.policy.confidenceThreshold, 0.82)
  assert.equal(policyReset.payload.policy.logCollectionEnabled, true)
  await assert.rejects(() => fs.stat(process.env.DOCUMENT_INTAKE_POLICY_FILE), /ENOENT/)

  state.adminRecalculationTasks = [{
    id: '66666666-6666-4666-8666-666666666666',
    correction_id: '77777777-7777-4777-8777-777777777777',
    business_link_id: '88888888-8888-4888-8888-888888888888',
    target_schema: 'purchase',
    target_table: 'purchase_receipts',
    target_record_id: 'PR-001',
    task_type: 'business_result_recalculation',
    status: 'pending',
    priority: 50,
    attempt_count: 1,
    next_attempt_at: '2026-06-19T01:10:01.000Z',
    locked_at: null,
    locked_by: '',
    requested_by: 'warehouse-user',
    requested_at: '2026-06-19T01:05:01.000Z',
    completed_at: null,
    last_error: null,
    metadata: { field_name: 'quantity' },
    asset_id: '22222222-2222-4222-8222-222222222222',
    original_filename: 'purchase-order.pdf',
    file_hash: 'a'.repeat(64),
    asset_status: 'imported',
    upload_source: 'watch_folder',
    operator_source: 'folder_binding_user',
    uploaded_by_user_id: 'u_warehouse',
    uploaded_by_username: 'warehouse-uploader',
    uploaded_by_role: 'warehouse',
    source_folder: 'D:\\EISCore\\Inbox',
    asset_metadata: { uploaded_by_role: 'warehouse' },
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    batch_no: 'DIB-TEST',
    batch_status: 'completed',
    target_module: 'purchase',
    target_document_type: '采购入库单'
  }]
  const recalculationTaskList = await callGet(
    handlers.handleListAdminRecalculationTasks,
    `/document-intake/admin/recalculation-tasks?status=pending&targetSchema=purchase&targetTable=purchase_receipts&targetRecordId=PR-001&requestedBy=warehouse-user&uploadedBy=warehouse-uploader&uploadedByRole=warehouse&uploadSource=watch_folder&operatorSource=folder_binding_user&sourceFolder=${encodeURIComponent('D:\\EISCore\\Inbox')}&search=purchase-order&limit=10&offset=0`
  )
  assert.equal(recalculationTaskList.statusCode, 200, `admin recalculation task list should load: ${JSON.stringify(recalculationTaskList.payload)}`)
  assert.equal(recalculationTaskList.payload.total, 1)
  assert.equal(recalculationTaskList.payload.items[0].id, '66666666-6666-4666-8666-666666666666')
  assert.equal(recalculationTaskList.payload.items[0].status, 'pending')
  assert.equal(recalculationTaskList.payload.items[0].attemptCount, 1)
  assert.equal(recalculationTaskList.payload.items[0].nextAttemptAt, '2026-06-19T01:10:01.000Z')
  assert.equal(recalculationTaskList.payload.items[0].targetRecordId, 'PR-001')
  assert.equal(recalculationTaskList.payload.items[0].sourceFilename, 'purchase-order.pdf')
  assert.equal(recalculationTaskList.payload.items[0].fileHash, 'a'.repeat(64))
  assert.equal(recalculationTaskList.payload.items[0].deviceCode, 'warehouse-pc-01')
  assert.equal(recalculationTaskList.payload.items[0].targetDocumentType, '采购入库单')
  assert.equal(recalculationTaskList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(recalculationTaskList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(recalculationTaskList.payload.items[0].uploadedByUsername, 'warehouse-uploader')
  assert.equal(recalculationTaskList.payload.items[0].uploadedByRole, 'warehouse')
  assert.equal(recalculationTaskList.payload.items[0].sourceFolder, 'D:\\EISCore\\Inbox')
  assert.equal(recalculationTaskList.payload.items[0].metadata.field_name, 'quantity')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from public.ai_business_recalculation_tasks t') &&
        sql.includes('t.status =') &&
        sql.includes('t.target_record_id =') &&
        sql.includes('a.upload_source =') &&
        sql.includes('a.source_folder ilike') &&
        sql.includes('a.uploaded_by_user_id =') &&
        sql.includes('a.uploaded_by_username =') &&
        sql.includes('a.uploaded_by_role') &&
        sql.includes('a.operator_source') &&
        item.params.includes('pending') &&
        item.params.includes('PR-001') &&
        item.params.includes('warehouse-user') &&
        item.params.includes('warehouse-uploader') &&
        item.params.includes('warehouse') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.some((param) => String(param).includes('D:\\EISCore\\Inbox')) &&
        item.params.some((param) => String(param).includes('purchase-order'))
    }),
    'admin recalculation task list should apply status, target, requester, upload ownership and search filters'
  )

  state.adminProductionWorkReports = [{
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    report_no: 'PR-20260617-001',
    report_date: '2026-06-17',
    work_order_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    work_order_no: 'WO-20260617-001',
    product_material_id: 21,
    product_material_code: 'FG-001',
    product_material_name: '香辣虾仁预制菜',
    process_name: '包装',
    workshop_name: '一车间',
    production_line: '预制菜一线',
    shift_name: '白班',
    team_name: 'A组',
    completed_qty: '300',
    good_qty: '292',
    defect_qty: '6',
    scrap_qty: '2',
    unit: '盒',
    operator: '许计划',
    report_status: 'active',
    remark: '订单补货',
    properties: { ai_generated: true },
    created_by: '许计划',
    created_at: '2026-06-17T08:00:00.000Z',
    updated_at: '2026-06-17T08:00:00.000Z',
    business_link_id: 'production-link-1',
    business_link_metadata: { duplicate_business_source: false },
    duplicate_business_source: false,
    asset_id: '22222222-2222-4222-8222-222222222222',
    original_filename: 'production-daily.xlsx',
    file_hash: 'hash-production-daily',
    asset_status: 'imported',
    upload_source: 'watch_folder',
    operator_source: 'folder_binding_user',
    uploaded_by_user_id: 'u_prod',
    uploaded_by_username: 'prod-user',
    uploaded_by_role: 'production',
    source_folder: 'D:\\EISCore\\Production',
    asset_metadata: {},
    device_code: 'prod-pc-01',
    device_name: 'Production PC 01',
    batch_no: 'DIB-PROD-001',
    batch_status: 'completed'
  }]
  const productionWorkReportList = await callGet(
    handlers.handleListAdminProductionWorkReports,
    '/document-intake/admin/production-work-reports?dateFrom=2026-06-01&dateTo=2026-06-30&reportNo=PR-20260617-001&workOrderNo=WO-20260617-001&productMaterialCode=FG-001&uploadedBy=prod-user&uploadedByRole=production&uploadSource=watch_folder&operatorSource=folder_binding_user&duplicateBusinessSource=false&sourceFolder=D%3A%5CEISCore%5CProduction&search=生产日报&limit=10&offset=0'
  )
  assert.equal(productionWorkReportList.statusCode, 200, `production work report list should load: ${JSON.stringify(productionWorkReportList.payload)}`)
  assert.equal(productionWorkReportList.payload.unavailable, false)
  assert.equal(productionWorkReportList.payload.total, 1)
  assert.equal(productionWorkReportList.payload.items[0].reportNo, 'PR-20260617-001')
  assert.equal(productionWorkReportList.payload.items[0].workOrderNo, 'WO-20260617-001')
  assert.equal(productionWorkReportList.payload.items[0].productMaterialCode, 'FG-001')
  assert.equal(productionWorkReportList.payload.items[0].completedQty, 300)
  assert.equal(productionWorkReportList.payload.items[0].goodQty, 292)
  assert.equal(productionWorkReportList.payload.items[0].defectQty, 6)
  assert.equal(productionWorkReportList.payload.items[0].scrapQty, 2)
  assert.equal(productionWorkReportList.payload.items[0].sourceFilename, 'production-daily.xlsx')
  assert.equal(productionWorkReportList.payload.items[0].uploadedByUsername, 'prod-user')
  assert.equal(productionWorkReportList.payload.items[0].uploadedByRole, 'production')
  assert.equal(productionWorkReportList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(productionWorkReportList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(productionWorkReportList.payload.items[0].sourceFolder, 'D:\\EISCore\\Production')
  assert.equal(productionWorkReportList.payload.items[0].duplicateBusinessSource, false)
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from scm.production_work_reports r') &&
        sql.includes('r.report_date >=') &&
        sql.includes('r.report_date <=') &&
        sql.includes('r.report_no =') &&
        sql.includes('r.work_order_no =') &&
        sql.includes('r.product_material_code =') &&
        sql.includes('a.uploaded_by_username') &&
        sql.includes('a.uploaded_by_role') &&
        sql.includes('a.upload_source') &&
        sql.includes('a.operator_source') &&
        sql.includes('a.source_folder ilike') &&
        sql.includes('a.upload_source =') &&
        sql.includes('coalesce(a.operator_source') &&
        sql.includes('a.uploaded_by_user_id =') &&
        sql.includes('a.uploaded_by_username =') &&
        sql.includes('coalesce(a.uploaded_by_role') &&
        sql.includes('r.report_no ilike') &&
        sql.includes("l.metadata as business_link_metadata") &&
        sql.includes("duplicate_business_source") &&
        sql.includes('l.id is not null') &&
        sql.includes("not in ('true', '1', 'yes', 'y', 'on', '是')") &&
        item.params.includes('2026-06-01') &&
        item.params.includes('2026-06-30') &&
        item.params.includes('PR-20260617-001') &&
        item.params.includes('WO-20260617-001') &&
        item.params.includes('FG-001') &&
        item.params.includes('prod-user') &&
        item.params.includes('production') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.some((param) => String(param).includes('D:\\EISCore\\Production')) &&
        item.params.some((param) => String(param).includes('生产日报'))
    }),
    'production work report list should apply date, report, work order, material, upload ownership, business duplicate, source folder and search filters'
  )

  const duplicateProductionWorkReportStart = state.poolQueries.length
  const duplicateProductionWorkReportList = await callGet(
    handlers.handleListAdminProductionWorkReports,
    '/document-intake/admin/production-work-reports?duplicateBusinessSource=true&limit=1'
  )
  assert.equal(duplicateProductionWorkReportList.statusCode, 200, `duplicate production work report list should load: ${JSON.stringify(duplicateProductionWorkReportList.payload)}`)
  assert.ok(
    state.poolQueries.slice(duplicateProductionWorkReportStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from scm.production_work_reports r') &&
        sql.includes('l.id is not null') &&
        sql.includes("lower(coalesce(l.metadata->>'duplicate_business_source'") &&
        sql.includes("in ('true', '1', 'yes', 'y', 'on', '是')")
    }),
    'production work report list should independently filter duplicate business source rows'
  )

  state.productionWorkReportTableAvailable = false
  state.adminProductionWorkReports = []
  const unavailableProductionWorkReportList = await callGet(
    handlers.handleListAdminProductionWorkReports,
    '/document-intake/admin/production-work-reports'
  )
  assert.equal(unavailableProductionWorkReportList.statusCode, 200, 'missing production work report table should be reported as unavailable')
  assert.equal(unavailableProductionWorkReportList.payload.unavailable, true)
  assert.equal(unavailableProductionWorkReportList.payload.total, 0)
  assert.match(unavailableProductionWorkReportList.payload.unavailableReason, /patch_document_intake_production_work_reports\.sql/)
  state.productionWorkReportTableAvailable = true

  state.adminQualityInspections = [{
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    doc_no: 'QC-20260617-001',
    inspection_type: '来料检验',
    source_doc_no: 'PO-20260617',
    item_code: 'RM-001',
    item_name: '冷轧钢卷',
    source_name: '南派供应链',
    inspection_batch_no: 'B20260617',
    sample_qty: '20',
    defect_qty: '2',
    result: '不合格',
    inspector: '马质检',
    inspection_date: '2026-06-17',
    remark: '外观划伤',
    status: 'active',
    properties: { ai_generated: true },
    created_at: '2026-06-17T09:00:00.000Z',
    updated_at: '2026-06-17T09:00:00.000Z',
    business_link_id: 'quality-link-1',
    business_link_metadata: { duplicate_business_source: true },
    duplicate_business_source: true,
    asset_id: '22222222-2222-4222-8222-222222222222',
    original_filename: 'quality-inspection.xlsx',
    file_hash: 'hash-quality-inspection',
    asset_status: 'imported',
    upload_source: 'watch_folder',
    operator_source: 'folder_binding_user',
    uploaded_by_user_id: 'u_qc',
    uploaded_by_username: 'qc-user',
    uploaded_by_role: 'quality',
    source_folder: 'D:\\EISCore\\QC',
    asset_metadata: {},
    device_code: 'qc-pc-01',
    device_name: 'QC PC 01',
    import_batch_no: 'DIB-QC-001',
    import_batch_status: 'completed'
  }]
  const qualityInspectionList = await callGet(
    handlers.handleListAdminQualityInspections,
    '/document-intake/admin/quality-inspections?dateFrom=2026-06-01&dateTo=2026-06-30&docNo=QC-20260617-001&sourceDocNo=PO-20260617&inspectionType=来料检验&itemCode=RM-001&result=不合格&inspector=马质检&uploadedBy=qc-user&uploadedByRole=quality&uploadSource=watch_folder&operatorSource=folder_binding_user&duplicateBusinessSource=true&sourceFolder=D%3A%5CEISCore%5CQC&search=质检记录&limit=10&offset=0'
  )
  assert.equal(qualityInspectionList.statusCode, 200, `quality inspection list should load: ${JSON.stringify(qualityInspectionList.payload)}`)
  assert.equal(qualityInspectionList.payload.unavailable, false)
  assert.equal(qualityInspectionList.payload.total, 1)
  assert.equal(qualityInspectionList.payload.items[0].docNo, 'QC-20260617-001')
  assert.equal(qualityInspectionList.payload.items[0].inspectionType, '来料检验')
  assert.equal(qualityInspectionList.payload.items[0].sourceDocNo, 'PO-20260617')
  assert.equal(qualityInspectionList.payload.items[0].itemCode, 'RM-001')
  assert.equal(qualityInspectionList.payload.items[0].sampleQty, 20)
  assert.equal(qualityInspectionList.payload.items[0].defectQty, 2)
  assert.equal(qualityInspectionList.payload.items[0].result, '不合格')
  assert.equal(qualityInspectionList.payload.items[0].inspector, '马质检')
  assert.equal(qualityInspectionList.payload.items[0].batchNo, 'B20260617')
  assert.equal(qualityInspectionList.payload.items[0].sourceFilename, 'quality-inspection.xlsx')
  assert.equal(qualityInspectionList.payload.items[0].uploadedByUsername, 'qc-user')
  assert.equal(qualityInspectionList.payload.items[0].uploadedByRole, 'quality')
  assert.equal(qualityInspectionList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(qualityInspectionList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(qualityInspectionList.payload.items[0].sourceFolder, 'D:\\EISCore\\QC')
  assert.equal(qualityInspectionList.payload.items[0].importBatchNo, 'DIB-QC-001')
  assert.equal(qualityInspectionList.payload.items[0].duplicateBusinessSource, true)
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from public.quality_inspections i') &&
        sql.includes('i.inspection_date >=') &&
        sql.includes('i.inspection_date <=') &&
        sql.includes('i.doc_no =') &&
        sql.includes('i.source_doc_no =') &&
        sql.includes('i.inspection_type =') &&
        sql.includes('i.item_code =') &&
        sql.includes('i.result =') &&
        sql.includes('i.inspector ilike') &&
        sql.includes('a.uploaded_by_username') &&
        sql.includes('a.uploaded_by_role') &&
        sql.includes('a.upload_source') &&
        sql.includes('a.operator_source') &&
        sql.includes('a.source_folder ilike') &&
        sql.includes('a.upload_source =') &&
        sql.includes('coalesce(a.operator_source') &&
        sql.includes('a.uploaded_by_user_id =') &&
        sql.includes('a.uploaded_by_username =') &&
        sql.includes('coalesce(a.uploaded_by_role') &&
        sql.includes('i.doc_no ilike') &&
        sql.includes('a.original_filename ilike') &&
        sql.includes('a.file_hash ilike') &&
        sql.includes('l.metadata as business_link_metadata') &&
        sql.includes('duplicate_business_source') &&
        sql.includes('l.id is not null') &&
        sql.includes("in ('true', '1', 'yes', 'y', 'on', '是')") &&
        item.params.includes('2026-06-01') &&
        item.params.includes('2026-06-30') &&
        item.params.includes('QC-20260617-001') &&
        item.params.includes('PO-20260617') &&
        item.params.includes('来料检验') &&
        item.params.includes('RM-001') &&
        item.params.includes('不合格') &&
        item.params.includes('qc-user') &&
        item.params.includes('quality') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.some((param) => String(param).includes('D:\\EISCore\\QC')) &&
        item.params.some((param) => String(param).includes('马质检')) &&
        item.params.some((param) => String(param).includes('质检记录'))
    }),
    'quality inspection list should apply date, document, source, type, material, result, inspector, upload ownership, business duplicate, source folder and search filters'
  )

  const formalQualityInspectionStart = state.poolQueries.length
  const formalQualityInspectionList = await callGet(
    handlers.handleListAdminQualityInspections,
    '/document-intake/admin/quality-inspections?duplicateBusinessSource=false&limit=1'
  )
  assert.equal(formalQualityInspectionList.statusCode, 200, `formal quality inspection list should load: ${JSON.stringify(formalQualityInspectionList.payload)}`)
  assert.ok(
    state.poolQueries.slice(formalQualityInspectionStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from public.quality_inspections i') &&
        sql.includes('l.id is not null') &&
        sql.includes("lower(coalesce(l.metadata->>'duplicate_business_source'") &&
        sql.includes("not in ('true', '1', 'yes', 'y', 'on', '是')")
    }),
    'quality inspection list should independently filter formal non-duplicate business source rows'
  )

  state.qualityInspectionTableAvailable = false
  state.adminQualityInspections = []
  const unavailableQualityInspectionList = await callGet(
    handlers.handleListAdminQualityInspections,
    '/document-intake/admin/quality-inspections'
  )
  assert.equal(unavailableQualityInspectionList.statusCode, 200, 'missing quality inspection table should be reported as unavailable')
  assert.equal(unavailableQualityInspectionList.payload.unavailable, true)
  assert.equal(unavailableQualityInspectionList.payload.total, 0)
  assert.match(unavailableQualityInspectionList.payload.unavailableReason, /quality_demo_schema\.sql/)
  state.qualityInspectionTableAvailable = true

  state.adminHrAttendanceSnapshots = [{
    id: '99999999-9999-4999-8999-999999999999',
    employee_month_key: 'E001:2026-06',
    employee_id: 'emp-1',
    employee_no: 'E001',
    employee_name: '张生产',
    dept_name: '生产部',
    month: '2026-06',
    record_count: 22,
    leave_count: 1,
    absent_count: 0,
    late_count: 2,
    early_count: 0,
    overtime_minutes: 150,
    first_att_date: '2026-06-01',
    last_att_date: '2026-06-30',
    source_target_schema: 'hr',
    source_target_table: 'document_intake_records',
    source_target_record_id: 'HR-ATT-001',
    last_task_id: '66666666-6666-4666-8666-666666666666',
    last_correction_id: '77777777-7777-4777-8777-777777777777',
    last_business_link_id: '88888888-8888-4888-8888-888888888888',
    summary: { status: 'ready_for_monthly_confirmation' },
    recalculated_at: '2026-06-19T02:10:00.000Z',
    created_at: '2026-06-19T02:10:00.000Z',
    updated_at: '2026-06-19T02:10:00.000Z',
    task_status: 'completed',
    task_requested_by: 'hr-user',
    task_completed_at: '2026-06-19T02:10:00.000Z',
    business_link_metadata: { duplicate_business_source: false },
    duplicate_business_source: false,
    confirmation_status: 'pending_confirmation',
    confirmation_note: '',
    confirmed_by: '',
    confirmed_at: null,
    rejected_by: '',
    rejected_at: null,
    rejection_reason: '',
    payroll_precheck_status: 'not_requested',
    payroll_precheck_requested_by: '',
    payroll_precheck_requested_at: null,
    payroll_precheck_note: '',
    asset_id: '22222222-2222-4222-8222-222222222222',
    original_filename: 'attendance-june.xlsx',
    file_hash: 'hash-attendance-june',
    upload_source: 'watch_folder',
    operator_source: 'folder_binding_user',
    uploaded_by_user_id: 'u_hr',
    uploaded_by_username: 'hr-operator',
    uploaded_by_role: 'hr',
    source_folder: 'D:\\EISCore\\HR',
    asset_metadata: {},
    device_code: 'hr-pc-01',
    device_name: 'HR PC 01',
    batch_no: 'DIB-HR-001',
    batch_status: 'completed'
  }]
  const hrAttendanceSnapshotList = await callGet(
    handlers.handleListAdminHrAttendanceSnapshots,
    '/document-intake/admin/hr-attendance-snapshots?month=2026-06&confirmationStatus=pending_confirmation&payrollPrecheckStatus=not_requested&employeeNo=E001&employeeName=张&deptName=生产&targetRecordId=HR-ATT-001&uploadedBy=hr-operator&uploadedByRole=hr&uploadSource=watch_folder&operatorSource=folder_binding_user&duplicateBusinessSource=false&sourceFolder=D%3A%5CEISCore%5CHR&search=attendance&limit=10&offset=0'
  )
  assert.equal(hrAttendanceSnapshotList.statusCode, 200, `admin HR attendance snapshot list should load: ${JSON.stringify(hrAttendanceSnapshotList.payload)}`)
  assert.equal(hrAttendanceSnapshotList.payload.unavailable, false)
  assert.equal(hrAttendanceSnapshotList.payload.total, 1)
  assert.equal(hrAttendanceSnapshotList.payload.items[0].id, '99999999-9999-4999-8999-999999999999')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].employeeName, '张生产')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].deptName, '生产部')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].month, '2026-06')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].overtimeMinutes, 150)
  assert.equal(hrAttendanceSnapshotList.payload.items[0].sourceTargetRecordId, 'HR-ATT-001')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].sourceFilename, 'attendance-june.xlsx')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].fileHash, 'hash-attendance-june')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].uploadedByUsername, 'hr-operator')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].uploadedByRole, 'hr')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].sourceFolder, 'D:\\EISCore\\HR')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].batchStatus, 'completed')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].taskStatus, 'completed')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].duplicateBusinessSource, false)
  assert.equal(hrAttendanceSnapshotList.payload.items[0].confirmationStatus, 'pending_confirmation')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].payrollPrecheckStatus, 'not_requested')
  assert.equal(hrAttendanceSnapshotList.payload.items[0].summary.status, 'ready_for_monthly_confirmation')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.attendance_month_recalculation_snapshots s') &&
        sql.includes('s.month =') &&
        sql.includes('s.employee_no =') &&
        sql.includes('s.employee_name ilike') &&
        sql.includes('s.dept_name ilike') &&
        sql.includes('s.source_target_record_id =') &&
        sql.includes('s.confirmation_status =') &&
        sql.includes('s.payroll_precheck_status =') &&
        sql.includes('l.metadata as business_link_metadata') &&
        sql.includes('duplicate_business_source') &&
        sql.includes('l.id is not null') &&
        sql.includes("not in ('true', '1', 'yes', 'y', 'on', '是')") &&
        sql.includes('a.uploaded_by_username') &&
        sql.includes('a.uploaded_by_role') &&
        sql.includes('a.upload_source') &&
        sql.includes('a.operator_source') &&
        sql.includes('a.source_folder ilike') &&
        sql.includes('a.upload_source =') &&
        sql.includes('coalesce(a.operator_source') &&
        sql.includes('a.uploaded_by_user_id =') &&
        sql.includes('a.uploaded_by_username =') &&
        sql.includes('coalesce(a.uploaded_by_role') &&
        sql.includes('a.original_filename ilike') &&
        item.params.includes('2026-06') &&
        item.params.includes('pending_confirmation') &&
        item.params.includes('not_requested') &&
        item.params.includes('E001') &&
        item.params.includes('%张%') &&
        item.params.includes('%生产%') &&
        item.params.includes('HR-ATT-001') &&
        item.params.includes('hr-operator') &&
        item.params.includes('hr') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.some((param) => String(param).includes('D:\\EISCore\\HR')) &&
        item.params.some((param) => String(param).includes('attendance'))
    }),
    'admin HR attendance snapshot list should apply month, employee, department, upload ownership, business duplicate, source folder and search filters'
  )

  const duplicateHrAttendanceSnapshotStart = state.poolQueries.length
  const duplicateHrAttendanceSnapshotList = await callGet(
    handlers.handleListAdminHrAttendanceSnapshots,
    '/document-intake/admin/hr-attendance-snapshots?duplicateBusinessSource=true&limit=1'
  )
  assert.equal(duplicateHrAttendanceSnapshotList.statusCode, 200, `duplicate HR attendance snapshot list should load: ${JSON.stringify(duplicateHrAttendanceSnapshotList.payload)}`)
  assert.ok(
    state.poolQueries.slice(duplicateHrAttendanceSnapshotStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.attendance_month_recalculation_snapshots s') &&
        sql.includes('l.id is not null') &&
        sql.includes("lower(coalesce(l.metadata->>'duplicate_business_source'") &&
        sql.includes("in ('true', '1', 'yes', 'y', 'on', '是')")
    }),
    'admin HR attendance snapshot list should independently filter duplicate business source rows'
  )

  const prematurePayrollPrecheck = await callJson(
    handlers.handleUpdateAdminHrAttendanceSnapshot,
    { action: 'submit_payroll_precheck', actor: 'payroll-user' },
    '/document-intake/admin/hr-attendance-snapshots/99999999-9999-4999-8999-999999999999/action',
    'POST'
  )
  assert.equal(prematurePayrollPrecheck.statusCode, 409, 'HR snapshot should require confirmation before payroll precheck')
  assert.equal(prematurePayrollPrecheck.payload.code, 'HR_ATTENDANCE_SNAPSHOT_CONFIRMATION_REQUIRED')

  const confirmedHrAttendanceSnapshot = await callJson(
    handlers.handleUpdateAdminHrAttendanceSnapshot,
    { action: 'confirm', actor: 'hr-manager', note: '月度考勤已核对' },
    '/document-intake/admin/hr-attendance-snapshots/99999999-9999-4999-8999-999999999999/action',
    'POST'
  )
  assert.equal(confirmedHrAttendanceSnapshot.statusCode, 200, `HR snapshot confirm should succeed: ${JSON.stringify(confirmedHrAttendanceSnapshot.payload)}`)
  assert.equal(confirmedHrAttendanceSnapshot.payload.snapshot.confirmationStatus, 'confirmed')
  assert.equal(confirmedHrAttendanceSnapshot.payload.snapshot.confirmedBy, 'hr-manager')
  assert.equal(confirmedHrAttendanceSnapshot.payload.snapshot.confirmationNote, '月度考勤已核对')

  const submittedPayrollPrecheck = await callJson(
    handlers.handleUpdateAdminHrAttendanceSnapshot,
    { action: 'submit_payroll_precheck', actor: 'payroll-user', note: '进入 6 月薪资核算前置审核' },
    '/document-intake/admin/hr-attendance-snapshots/99999999-9999-4999-8999-999999999999/action',
    'POST'
  )
  assert.equal(submittedPayrollPrecheck.statusCode, 200, `HR snapshot payroll precheck should succeed: ${JSON.stringify(submittedPayrollPrecheck.payload)}`)
  assert.equal(submittedPayrollPrecheck.payload.snapshot.confirmationStatus, 'confirmed')
  assert.equal(submittedPayrollPrecheck.payload.snapshot.payrollPrecheckStatus, 'ready')
  assert.equal(submittedPayrollPrecheck.payload.snapshot.payrollPrecheckRequestedBy, 'payroll-user')

  state.adminPayrollPrecheckSnapshots = [{
    ...state.adminHrAttendanceSnapshots[0],
    snapshot_id: state.adminHrAttendanceSnapshots[0].id,
    precheck_status: 'ready',
    read_only_reference: true,
    payroll_mutation_allowed: false,
    payroll_reference: {
      reference_table: 'hr.attendance_month_recalculation_snapshots',
      snapshot_id: state.adminHrAttendanceSnapshots[0].id,
      employee_month_key: state.adminHrAttendanceSnapshots[0].employee_month_key,
      no_payroll_mutation: true
    }
  }]
  const payrollPrecheckSnapshotList = await callGet(
    handlers.handleListAdminPayrollPrecheckSnapshots,
    '/document-intake/admin/hr-payroll-precheck-snapshots?month=2026-06&employeeNo=E001&employeeName=张&deptName=生产&targetRecordId=HR-ATT-001&uploadedBy=hr-operator&uploadedByRole=hr&uploadSource=watch_folder&operatorSource=folder_binding_user&duplicateBusinessSource=false&sourceFolder=D%3A%5CEISCore%5CHR&search=attendance&limit=10&offset=0'
  )
  assert.equal(payrollPrecheckSnapshotList.statusCode, 200, `payroll precheck snapshot list should load: ${JSON.stringify(payrollPrecheckSnapshotList.payload)}`)
  assert.equal(payrollPrecheckSnapshotList.payload.unavailable, false)
  assert.equal(payrollPrecheckSnapshotList.payload.total, 1)
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].snapshotId, '99999999-9999-4999-8999-999999999999')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].payrollPrecheckStatus, 'ready')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].readOnlyReference, true)
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].payrollMutationAllowed, false)
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].payrollReference.no_payroll_mutation, true)
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].uploadedByUsername, 'hr-operator')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].uploadedByRole, 'hr')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].sourceFolder, 'D:\\EISCore\\HR')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].batchStatus, 'completed')
  assert.equal(payrollPrecheckSnapshotList.payload.items[0].duplicateBusinessSource, false)
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.v_payroll_precheck_attendance_snapshots q') &&
        sql.includes('left join public.document_business_links l') &&
        sql.includes('duplicate_business_source') &&
        sql.includes('l.id is not null') &&
        sql.includes("not in ('true', '1', 'yes', 'y', 'on', '是')") &&
        sql.includes('q.month =') &&
        sql.includes('q.employee_no =') &&
        sql.includes('q.employee_name ilike') &&
        sql.includes('q.dept_name ilike') &&
        sql.includes('q.source_target_record_id =') &&
        sql.includes('q.source_folder ilike') &&
        sql.includes('q.upload_source =') &&
        sql.includes('coalesce(q.operator_source') &&
        sql.includes('q.uploaded_by_user_id =') &&
        sql.includes('q.uploaded_by_username =') &&
        sql.includes('coalesce(q.uploaded_by_role') &&
        sql.includes('q.original_filename ilike') &&
        item.params.includes('2026-06') &&
        item.params.includes('E001') &&
        item.params.includes('%张%') &&
        item.params.includes('%生产%') &&
        item.params.includes('HR-ATT-001') &&
        item.params.includes('hr-operator') &&
        item.params.includes('hr') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.some((param) => String(param).includes('D:\\EISCore\\HR')) &&
        item.params.some((param) => String(param).includes('attendance'))
    }),
    'payroll precheck snapshot list should apply month, employee, department, upload ownership, business duplicate, source folder and search filters'
  )

  const duplicatePayrollPrecheckSnapshotStart = state.poolQueries.length
  const duplicatePayrollPrecheckSnapshotList = await callGet(
    handlers.handleListAdminPayrollPrecheckSnapshots,
    '/document-intake/admin/hr-payroll-precheck-snapshots?duplicateBusinessSource=true&limit=1'
  )
  assert.equal(duplicatePayrollPrecheckSnapshotList.statusCode, 200, `duplicate payroll precheck snapshot list should load: ${JSON.stringify(duplicatePayrollPrecheckSnapshotList.payload)}`)
  assert.ok(
    state.poolQueries.slice(duplicatePayrollPrecheckSnapshotStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.v_payroll_precheck_attendance_snapshots q') &&
        sql.includes('left join public.document_business_links l') &&
        sql.includes('l.id is not null') &&
        sql.includes("lower(coalesce(l.metadata->>'duplicate_business_source'") &&
        sql.includes("in ('true', '1', 'yes', 'y', 'on', '是')")
    }),
    'payroll precheck snapshot list should independently filter duplicate business source rows'
  )

  const generatedPayrollTrial = await callJson(
    handlers.handleGenerateAdminPayrollPrecheckTrial,
    { actor: 'payroll-user', note: '生成 6 月薪资前置试算' },
    '/document-intake/admin/hr-payroll-precheck-snapshots/99999999-9999-4999-8999-999999999999/trial?snapshotId=99999999-9999-4999-8999-999999999999',
    'POST'
  )
  assert.equal(generatedPayrollTrial.statusCode, 200, `payroll precheck trial should be generated: ${JSON.stringify(generatedPayrollTrial.payload)}`)
  assert.equal(generatedPayrollTrial.payload.result.snapshotId, '99999999-9999-4999-8999-999999999999')
  assert.equal(generatedPayrollTrial.payload.result.trialStatus, 'draft')
  assert.equal(generatedPayrollTrial.payload.result.employeeMonthKey, 'E001:2026-06')
  assert.equal(generatedPayrollTrial.payload.result.noPayrollMutation, true)
  assert.equal(generatedPayrollTrial.payload.result.payrollMutationAllowed, false)
  assert.equal(generatedPayrollTrial.payload.result.calculationBasis.noPayrollMutation, true)
  assert.equal(generatedPayrollTrial.payload.result.resultPayload.payrollMutationAllowed, false)
  assert.equal(generatedPayrollTrial.payload.result.sourceSnapshotReference.no_payroll_mutation, true)
  assert.equal(generatedPayrollTrial.payload.result.uploadedByUsername, 'hr-operator')
  assert.equal(generatedPayrollTrial.payload.result.uploadedByRole, 'hr')
  assert.equal(generatedPayrollTrial.payload.result.operatorSource, 'folder_binding_user')
  assert.equal(generatedPayrollTrial.payload.result.uploadSource, 'watch_folder')
  assert.equal(generatedPayrollTrial.payload.result.sourceFolder, 'D:\\EISCore\\HR')
  assert.equal(generatedPayrollTrial.payload.result.batchStatus, 'completed')
  assert.equal(generatedPayrollTrial.payload.result.sourceSnapshotReference.uploaded_by_username, 'hr-operator')
  assert.equal(generatedPayrollTrial.payload.result.sourceSnapshotReference.last_business_link_id, '88888888-8888-4888-8888-888888888888')
  assert.equal(generatedPayrollTrial.payload.result.sourceSnapshotReference.duplicate_business_source, false)
  assert.equal(generatedPayrollTrial.payload.result.lastBusinessLinkId, '88888888-8888-4888-8888-888888888888')
  assert.equal(generatedPayrollTrial.payload.result.duplicateBusinessSource, false)
  assert.equal(state.payrollPrecheckTrialInserts.length, 1, 'trial generation should upsert one payroll precheck result')
  assert.ok(
    state.poolQueries.some((item) => String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('insert into hr.payroll_precheck_results')),
    'trial generation should write only the payroll precheck result table'
  )
  assert.equal(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return /(insert into|update|delete from) hr\.payroll(?:\s|\(|$)/.test(sql)
    }),
    false,
    'trial generation must not mutate the official payroll table'
  )

  const payrollPrecheckResultList = await callGet(
    handlers.handleListAdminPayrollPrecheckResults,
    '/document-intake/admin/hr-payroll-precheck-results?month=2026-06&employeeNo=E001&employeeName=张&deptName=生产&trialStatus=draft&targetRecordId=HR-ATT-001&uploadedBy=hr-operator&uploadedByRole=hr&uploadSource=watch_folder&operatorSource=folder_binding_user&duplicateBusinessSource=false&sourceFolder=D%3A%5CEISCore%5CHR&search=attendance&limit=10&offset=0'
  )
  assert.equal(payrollPrecheckResultList.statusCode, 200, `payroll precheck result list should load: ${JSON.stringify(payrollPrecheckResultList.payload)}`)
  assert.equal(payrollPrecheckResultList.payload.unavailable, false)
  assert.equal(payrollPrecheckResultList.payload.total, 1)
  assert.equal(payrollPrecheckResultList.payload.items[0].snapshotId, '99999999-9999-4999-8999-999999999999')
  assert.equal(payrollPrecheckResultList.payload.items[0].trialStatus, 'draft')
  assert.equal(payrollPrecheckResultList.payload.items[0].noPayrollMutation, true)
  assert.equal(payrollPrecheckResultList.payload.items[0].payrollMutationAllowed, false)
  assert.equal(payrollPrecheckResultList.payload.items[0].uploadedByUsername, 'hr-operator')
  assert.equal(payrollPrecheckResultList.payload.items[0].uploadedByRole, 'hr')
  assert.equal(payrollPrecheckResultList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(payrollPrecheckResultList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(payrollPrecheckResultList.payload.items[0].sourceFolder, 'D:\\EISCore\\HR')
  assert.equal(payrollPrecheckResultList.payload.items[0].lastBusinessLinkId, '88888888-8888-4888-8888-888888888888')
  assert.equal(payrollPrecheckResultList.payload.items[0].duplicateBusinessSource, false)
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.payroll_precheck_results r') &&
        sql.includes('r.month =') &&
        sql.includes('r.employee_no =') &&
        sql.includes('r.employee_name ilike') &&
        sql.includes('r.dept_name ilike') &&
        sql.includes('r.trial_status =') &&
        sql.includes('r.source_target_record_id =') &&
        sql.includes('r.upload_source =') &&
        sql.includes('coalesce(r.operator_source') &&
        sql.includes('r.uploaded_by_user_id =') &&
        sql.includes('r.uploaded_by_username =') &&
        sql.includes('coalesce(r.uploaded_by_role') &&
        sql.includes('r.source_snapshot_reference') &&
        sql.includes("not in ('true', '1', 'yes', 'y', 'on', '是')") &&
        sql.includes('r.source_folder ilike') &&
        sql.includes('r.source_filename ilike') &&
        item.params.includes('2026-06') &&
        item.params.includes('E001') &&
        item.params.includes('%张%') &&
        item.params.includes('%生产%') &&
        item.params.includes('draft') &&
        item.params.includes('HR-ATT-001') &&
        item.params.includes('hr-operator') &&
        item.params.includes('hr') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.some((param) => String(param).includes('D:\\EISCore\\HR')) &&
        item.params.some((param) => String(param).includes('attendance'))
    }),
    'payroll precheck result list should apply month, employee, status, upload ownership, business duplicate, source and search filters'
  )

  const duplicatePayrollPrecheckResultStart = state.poolQueries.length
  const duplicatePayrollPrecheckResultList = await callGet(
    handlers.handleListAdminPayrollPrecheckResults,
    '/document-intake/admin/hr-payroll-precheck-results?duplicateBusinessSource=true&limit=1'
  )
  assert.equal(duplicatePayrollPrecheckResultList.statusCode, 200, `duplicate payroll precheck result list should load: ${JSON.stringify(duplicatePayrollPrecheckResultList.payload)}`)
  assert.ok(
    state.poolQueries.slice(duplicatePayrollPrecheckResultStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.payroll_precheck_results r') &&
        sql.includes("r.source_snapshot_reference->>'duplicate_business_source'") &&
        sql.includes("in ('true', '1', 'yes', 'y', 'on', '是')")
    }),
    'payroll precheck result list should independently filter duplicate business source rows'
  )

  const approvedPayrollTrial = await callJson(
    handlers.handleUpdateAdminPayrollPrecheckResult,
    { action: 'approve', actor: 'payroll-manager', note: '试算结果与考勤快照一致，允许进入薪资只读引用' },
    `/document-intake/admin/hr-payroll-precheck-results/${generatedPayrollTrial.payload.result.id}/action`,
    'POST'
  )
  assert.equal(approvedPayrollTrial.statusCode, 200, `payroll precheck result approve should succeed: ${JSON.stringify(approvedPayrollTrial.payload)}`)
  assert.equal(approvedPayrollTrial.payload.result.id, generatedPayrollTrial.payload.result.id)
  assert.equal(approvedPayrollTrial.payload.result.trialStatus, 'approved')
  assert.equal(approvedPayrollTrial.payload.result.reviewedBy, 'payroll-manager')
  assert.equal(approvedPayrollTrial.payload.result.reviewNote, '试算结果与考勤快照一致，允许进入薪资只读引用')
  assert.equal(approvedPayrollTrial.payload.result.noPayrollMutation, true)
  assert.equal(approvedPayrollTrial.payload.result.resultPayload.payrollMutationAllowed, false)
  assert.equal(state.payrollPrecheckResultUpdates.length, 1, 'approving trial should update one payroll precheck result')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('update hr.payroll_precheck_results') &&
        sql.includes('no_payroll_mutation = true') &&
        item.params.includes('approved') &&
        item.params.includes('payroll-manager')
    }),
    'approving trial should keep no_payroll_mutation true on the precheck result'
  )
  assert.equal(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return /(insert into|update|delete from) hr\.payroll(?:\s|\(|$)/.test(sql)
    }),
    false,
    'approving trial must not mutate the official payroll table'
  )

  const readyPayrollPrecheckResultList = await callGet(
    handlers.handleListAdminPayrollReadyPrecheckResults,
    '/document-intake/admin/hr-payroll-ready-precheck-results?month=2026-06&employeeNo=E001&employeeName=张&deptName=生产&targetRecordId=HR-ATT-001&uploadedBy=hr-operator&uploadedByRole=hr&uploadSource=watch_folder&operatorSource=folder_binding_user&duplicateBusinessSource=false&sourceFolder=D%3A%5CEISCore%5CHR&search=attendance&limit=10&offset=0'
  )
  assert.equal(readyPayrollPrecheckResultList.statusCode, 200, `payroll ready precheck result list should load: ${JSON.stringify(readyPayrollPrecheckResultList.payload)}`)
  assert.equal(readyPayrollPrecheckResultList.payload.unavailable, false)
  assert.equal(readyPayrollPrecheckResultList.payload.total, 1)
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].id, generatedPayrollTrial.payload.result.id)
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].trialStatus, 'approved')
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].readOnlyReference, true)
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].payrollMutationAllowed, false)
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].payrollReference.no_payroll_mutation, true)
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].uploadedByUsername, 'hr-operator')
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].uploadedByRole, 'hr')
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(readyPayrollPrecheckResultList.payload.items[0].sourceFolder, 'D:\\EISCore\\HR')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.v_payroll_ready_precheck_results r') &&
        sql.includes('r.month =') &&
        sql.includes('r.employee_no =') &&
        sql.includes('r.employee_name ilike') &&
        sql.includes('r.dept_name ilike') &&
        sql.includes('r.source_target_record_id =') &&
        sql.includes('r.upload_source =') &&
        sql.includes('coalesce(r.operator_source') &&
        sql.includes('r.uploaded_by_user_id =') &&
        sql.includes('r.uploaded_by_username =') &&
        sql.includes('coalesce(r.uploaded_by_role') &&
        sql.includes('r.source_snapshot_reference') &&
        sql.includes("not in ('true', '1', 'yes', 'y', 'on', '是')") &&
        sql.includes('r.source_folder ilike') &&
        sql.includes('r.source_filename ilike') &&
        item.params.includes('2026-06') &&
        item.params.includes('E001') &&
        item.params.includes('%张%') &&
        item.params.includes('%生产%') &&
        item.params.includes('HR-ATT-001') &&
        item.params.includes('hr-operator') &&
        item.params.includes('hr') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.some((param) => String(param).includes('D:\\EISCore\\HR')) &&
        item.params.some((param) => String(param).includes('attendance'))
    }),
    'payroll ready precheck result list should read the approved readonly view with upload ownership and business duplicate filters'
  )

  const duplicateReadyPayrollPrecheckResultStart = state.poolQueries.length
  const duplicateReadyPayrollPrecheckResultList = await callGet(
    handlers.handleListAdminPayrollReadyPrecheckResults,
    '/document-intake/admin/hr-payroll-ready-precheck-results?duplicateBusinessSource=true&limit=1'
  )
  assert.equal(duplicateReadyPayrollPrecheckResultList.statusCode, 200, `duplicate payroll ready precheck result list should load: ${JSON.stringify(duplicateReadyPayrollPrecheckResultList.payload)}`)
  assert.ok(
    state.poolQueries.slice(duplicateReadyPayrollPrecheckResultStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from hr.v_payroll_ready_precheck_results r') &&
        sql.includes("r.source_snapshot_reference->>'duplicate_business_source'") &&
        sql.includes("in ('true', '1', 'yes', 'y', 'on', '是')")
    }),
    'payroll ready precheck result list should independently filter duplicate business source rows'
  )

  state.payrollReadyPrecheckViewAvailable = false
  const unavailableReadyPayrollPrecheckResultList = await callGet(
    handlers.handleListAdminPayrollReadyPrecheckResults,
    '/document-intake/admin/hr-payroll-ready-precheck-results'
  )
  assert.equal(unavailableReadyPayrollPrecheckResultList.statusCode, 200, 'missing payroll ready precheck view should be reported as unavailable')
  assert.equal(unavailableReadyPayrollPrecheckResultList.payload.unavailable, true)
  assert.equal(unavailableReadyPayrollPrecheckResultList.payload.total, 0)
  assert.match(unavailableReadyPayrollPrecheckResultList.payload.unavailableReason, /v_payroll_ready_precheck_results/)
  state.payrollReadyPrecheckViewAvailable = true

  state.payrollPrecheckResultTableAvailable = false
  state.adminPayrollPrecheckResults = []
  const unavailablePayrollPrecheckResultList = await callGet(
    handlers.handleListAdminPayrollPrecheckResults,
    '/document-intake/admin/hr-payroll-precheck-results'
  )
  assert.equal(unavailablePayrollPrecheckResultList.statusCode, 200, 'missing payroll precheck result table should be reported as unavailable')
  assert.equal(unavailablePayrollPrecheckResultList.payload.unavailable, true)
  assert.equal(unavailablePayrollPrecheckResultList.payload.total, 0)
  assert.match(unavailablePayrollPrecheckResultList.payload.unavailableReason, /payroll_precheck_results/)
  state.payrollPrecheckResultTableAvailable = true

  state.payrollPrecheckViewAvailable = false
  state.adminPayrollPrecheckSnapshots = []
  const unavailablePayrollPrecheckList = await callGet(
    handlers.handleListAdminPayrollPrecheckSnapshots,
    '/document-intake/admin/hr-payroll-precheck-snapshots'
  )
  assert.equal(unavailablePayrollPrecheckList.statusCode, 200, 'missing payroll precheck view should be reported as an unavailable optional queue')
  assert.equal(unavailablePayrollPrecheckList.payload.unavailable, true)
  assert.equal(unavailablePayrollPrecheckList.payload.total, 0)
  assert.match(unavailablePayrollPrecheckList.payload.unavailableReason, /v_payroll_precheck_attendance_snapshots/)
  state.payrollPrecheckViewAvailable = true

  const rejectedHrAttendanceSnapshot = await callJson(
    handlers.handleUpdateAdminHrAttendanceSnapshot,
    { action: 'reject', actor: 'hr-manager', reason: '请假审批单缺失，退回重新修正' },
    '/document-intake/admin/hr-attendance-snapshots/99999999-9999-4999-8999-999999999999/action',
    'POST'
  )
  assert.equal(rejectedHrAttendanceSnapshot.statusCode, 200, `HR snapshot reject should succeed: ${JSON.stringify(rejectedHrAttendanceSnapshot.payload)}`)
  assert.equal(rejectedHrAttendanceSnapshot.payload.snapshot.confirmationStatus, 'rejected')
  assert.equal(rejectedHrAttendanceSnapshot.payload.snapshot.rejectedBy, 'hr-manager')
  assert.equal(rejectedHrAttendanceSnapshot.payload.snapshot.rejectionReason, '请假审批单缺失，退回重新修正')
  assert.equal(rejectedHrAttendanceSnapshot.payload.snapshot.payrollPrecheckStatus, 'not_requested')

  state.hrAttendanceSnapshotTableAvailable = false
  state.adminHrAttendanceSnapshots = []
  const unavailableHrAttendanceSnapshotList = await callGet(
    handlers.handleListAdminHrAttendanceSnapshots,
    '/document-intake/admin/hr-attendance-snapshots'
  )
  assert.equal(unavailableHrAttendanceSnapshotList.statusCode, 200, 'missing HR snapshot table should be reported as an unavailable optional view')
  assert.equal(unavailableHrAttendanceSnapshotList.payload.unavailable, true)
  assert.equal(unavailableHrAttendanceSnapshotList.payload.total, 0)
  assert.match(unavailableHrAttendanceSnapshotList.payload.unavailableReason, /patch_document_intake_hr_records\.sql/)
  state.hrAttendanceSnapshotTableAvailable = true

  const invalidRecalculationTaskList = await callGet(
    handlers.handleListAdminRecalculationTasks,
    '/document-intake/admin/recalculation-tasks?businessLinkId=not-a-uuid'
  )
  assert.equal(invalidRecalculationTaskList.statusCode, 400, 'recalculation task list should validate UUID filters')
  assert.equal(invalidRecalculationTaskList.payload.code, 'RECALCULATION_BUSINESS_LINK_ID_INVALID')

  const adminAssetId = '22222222-2222-4222-8222-222222222222'
  const adminBatchId = '33333333-3333-4333-8333-333333333333'
  const adminDeviceId = '44444444-4444-4444-8444-444444444444'
  const adminAssetRow = {
    id: adminAssetId,
    batch_id: adminBatchId,
    device_id: adminDeviceId,
    uploaded_by_user_id: 'u_2',
    uploaded_by_username: 'warehouse-user',
    uploaded_by_role: 'warehouse',
    operator_source: 'folder_binding_user',
    original_filename: 'purchase-order.pdf',
    storage_path: '/data/document-intake/purchase-order.pdf',
    mime_type: 'application/pdf',
    file_ext: '.pdf',
    file_size: '2048',
    file_hash: 'a'.repeat(64),
    source_folder: 'D:\\EISCore\\Inbox',
    upload_source: 'watch_folder',
    status: 'imported',
    duplicate_of_asset_id: null,
    duplicate: false,
    metadata: { source_device_code: 'warehouse-pc-01', uploaded_by_role: 'warehouse' },
    created_at: '2026-06-19T01:00:00.000Z',
    updated_at: '2026-06-19T01:03:00.000Z',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    classification_target_module: 'purchase',
    classification_target_document_type: '采购入库单',
    classification_target_kind: 'fixed_module_table',
    classification_confidence: '0.91',
    entry_target_module: 'purchase',
    entry_target_document_type: '采购入库单',
    entry_target_kind: 'fixed_module_table',
    document_count: 1,
    line_count: 3,
    entry_confidence: '0.88',
    entry_status: 'imported',
    entry_metadata: { auto_import_ready: true },
    business_link_count: 2,
    unmapped_field_count: 1,
    batch_no: 'DIB-TEST',
    batch_status: 'completed',
    batch_source: 'watch_folder'
  }
  state.adminAssets = [adminAssetRow]
  const adminAssetList = await callGet(
    handlers.handleListAdminAssets,
    `/document-intake/admin/assets?status=imported&duplicate=false&uploadSource=watch_folder&operatorSource=folder_binding_user&targetModule=purchase&targetDocumentType=${encodeURIComponent('采购入库单')}&sourceFolder=${encodeURIComponent('D:\\EISCore\\Inbox')}&deviceCode=warehouse-pc-01&uploadedBy=warehouse-user&uploadedByRole=warehouse&fileHash=${'a'.repeat(64)}&search=purchase&limit=10&offset=0`
  )
  assert.equal(adminAssetList.statusCode, 200, `admin asset list should load: ${JSON.stringify(adminAssetList.payload)}`)
  assert.equal(adminAssetList.payload.total, 1)
  assert.equal(adminAssetList.payload.items[0].originalFilename, 'purchase-order.pdf')
  assert.equal(adminAssetList.payload.items[0].batchNo, 'DIB-TEST')
  assert.equal(adminAssetList.payload.items[0].batchStatus, 'completed')
  assert.equal(adminAssetList.payload.items[0].deviceCode, 'warehouse-pc-01')
  assert.equal(adminAssetList.payload.items[0].sourceFolder, 'D:\\EISCore\\Inbox')
  assert.equal(adminAssetList.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(adminAssetList.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(adminAssetList.payload.items[0].uploadedByRole, 'warehouse')
  assert.equal(adminAssetList.payload.items[0].duplicate, false)
  assert.equal(adminAssetList.payload.items[0].duplicateOfAssetId, '')
  assert.equal(adminAssetList.payload.items[0].targetDocumentType, '采购入库单')
  assert.equal(adminAssetList.payload.items[0].reviewStatus, 'generated')
  assert.equal(adminAssetList.payload.items[0].generatedDocumentCount, 2)
  assert.equal(adminAssetList.payload.items[0].confidence, 0.88)
  assert.equal(adminAssetList.payload.items[0].actionHref, `/document-intake/admin/assets/${adminAssetId}`)
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.device_code =') &&
      item.params.includes('warehouse-pc-01')
    ),
    'admin asset list should filter by device code'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('a.file_hash =') &&
      item.params.includes('a'.repeat(64))
    ),
    'admin asset list should filter by file hash'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('a.upload_source =') &&
      item.params.includes('watch_folder')
    ),
    'admin asset list should filter by upload source'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('coalesce(a.operator_source') &&
      item.params.includes('folder_binding_user')
    ),
    'admin asset list should filter by operator source'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('a.source_folder ilike') &&
        item.params.includes('%D:\\EISCore\\Inbox%')
    }),
    'admin asset list should filter by source folder'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('a.uploaded_by_role') &&
        sql.includes('from public.document_assets a') &&
        sql.includes('order by a.created_at desc')
    }),
    'admin asset list should select the persisted uploaded role column'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('left join public.document_assets oa on oa.id = a.duplicate_of_asset_id') &&
        sql.includes('oa.original_filename as duplicate_of_original_filename') &&
        sql.includes('oa.file_hash as duplicate_of_file_hash')
    }),
    'admin asset list should select duplicate origin provenance for repeated files'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes("a.status <> 'duplicate'") && sql.includes('a.duplicate_of_asset_id is null')
    }),
    'admin asset list should filter non-duplicate files independently from status'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('a.uploaded_by_user_id =') &&
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('coalesce(a.uploaded_by_role') &&
      item.params.includes('warehouse-user')
    ),
    'admin asset list should filter by upload user id, username, or role'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('coalesce(a.uploaded_by_role') &&
        item.params.includes('warehouse')
    }),
    'admin asset list should filter independently by uploaded role'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from public.document_entry_plans ep') &&
        sql.includes('from public.document_classification_results cr') &&
        sql.includes('ep.target_module ilike') &&
        sql.includes('cr.target_module ilike') &&
        item.params.includes('%purchase%')
    }),
    'admin asset list should filter target module across entry plans and classification results'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from public.document_entry_plans ep') &&
        sql.includes('from public.document_classification_results cr') &&
        sql.includes('ep.target_document_type ilike') &&
        sql.includes('cr.target_document_type ilike') &&
        item.params.includes('%采购入库单%')
    }),
    'admin asset list should filter target document type across entry plans and classification results'
  )

  const duplicateListOriginalAssetId = '66666666-6666-4666-8666-666666666666'
  state.adminAssets = [{
    ...adminAssetRow,
    id: '55555555-5555-4555-8555-555555555555',
    original_filename: 'purchase-order-copy.pdf',
    status: 'duplicate',
    duplicate: true,
    duplicate_of_asset_id: duplicateListOriginalAssetId,
    duplicate_of_original_filename: 'purchase-order-original.pdf',
    duplicate_of_file_hash: 'b'.repeat(64),
    duplicate_of_uploaded_at: '2026-06-18T09:30:00.000Z',
    duplicate_of_upload_source: 'collector_desktop'
  }]
  const duplicateAssetList = await callGet(
    handlers.handleListAdminAssets,
    '/document-intake/admin/assets?duplicate=true&limit=10&offset=0'
  )
  assert.equal(duplicateAssetList.statusCode, 200, `duplicate admin asset list should load: ${JSON.stringify(duplicateAssetList.payload)}`)
  assert.equal(duplicateAssetList.payload.items[0].duplicate, true)
  assert.equal(duplicateAssetList.payload.items[0].duplicateOfAssetId, duplicateListOriginalAssetId)
  assert.equal(duplicateAssetList.payload.items[0].duplicateOfOriginalFilename, 'purchase-order-original.pdf')
  assert.equal(duplicateAssetList.payload.items[0].duplicateOfFileHash, 'b'.repeat(64))
  assert.equal(duplicateAssetList.payload.items[0].duplicateOfUploadedAt, '2026-06-18T09:30:00.000Z')
  assert.equal(duplicateAssetList.payload.items[0].duplicateOfUploadSource, 'collector_desktop')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes("a.status = 'duplicate'") && sql.includes('a.duplicate_of_asset_id is not null')
    }),
    'admin asset list should filter duplicate files by status or linked duplicate asset'
  )

  const camelDuplicateFilterStart = state.poolQueries.length
  const camelDuplicateAssetList = await callGet(
    handlers.handleListAdminAssets,
    '/document-intake/admin/assets?isDuplicate=true&limit=10&offset=0'
  )
  assert.equal(camelDuplicateAssetList.statusCode, 200, `camel-case duplicate asset list should load: ${JSON.stringify(camelDuplicateAssetList.payload)}`)
  assert.ok(
    state.poolQueries.slice(camelDuplicateFilterStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes("a.status = 'duplicate'") && sql.includes('a.duplicate_of_asset_id is not null')
    }),
    'admin asset list should support isDuplicate=true as a duplicate filter alias'
  )

  const snakeDuplicateFilterStart = state.poolQueries.length
  const snakeNonDuplicateAssetList = await callGet(
    handlers.handleListAdminAssets,
    '/document-intake/admin/assets?is_duplicate=false&limit=10&offset=0'
  )
  assert.equal(snakeNonDuplicateAssetList.statusCode, 200, `snake-case non-duplicate asset list should load: ${JSON.stringify(snakeNonDuplicateAssetList.payload)}`)
  assert.ok(
    state.poolQueries.slice(snakeDuplicateFilterStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes("a.status <> 'duplicate'") && sql.includes('a.duplicate_of_asset_id is null')
    }),
    'admin asset list should support is_duplicate=false as a non-duplicate filter alias'
  )

  const duplicateBusinessAssetFilterStart = state.poolQueries.length
  const duplicateBusinessAssetList = await callGet(
    handlers.handleListAdminAssets,
    '/document-intake/admin/assets?duplicateBusinessSource=true&limit=10&offset=0'
  )
  assert.equal(duplicateBusinessAssetList.statusCode, 200, `duplicate-business-source asset list should load: ${JSON.stringify(duplicateBusinessAssetList.payload)}`)
  assert.ok(
    state.poolQueries.slice(duplicateBusinessAssetFilterStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('exists ( select 1 from public.document_business_links bl') &&
        sql.includes('bl.asset_id = a.id') &&
        sql.includes("bl.metadata->>'duplicate_business_source'") &&
        sql.includes("in ('true', '1', 'yes', 'y', 'on', '是')") &&
        !/\bl\.metadata/.test(sql)
    }),
    'admin asset list should filter duplicate business sources through a scoped business-link exists clause'
  )

  const formalBusinessAssetFilterStart = state.poolQueries.length
  const formalBusinessAssetList = await callGet(
    handlers.handleListAdminAssets,
    '/document-intake/admin/assets?duplicate_business_source=false&limit=10&offset=0'
  )
  assert.equal(formalBusinessAssetList.statusCode, 200, `formal-business-source asset list should load: ${JSON.stringify(formalBusinessAssetList.payload)}`)
  assert.ok(
    state.poolQueries.slice(formalBusinessAssetFilterStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('exists ( select 1 from public.document_business_links bl') &&
        sql.includes('bl.asset_id = a.id') &&
        sql.includes("bl.metadata->>'duplicatebusinesssource'") &&
        sql.includes("not in ('true', '1', 'yes', 'y', 'on', '是')") &&
        !/\bl\.metadata/.test(sql)
    }),
    'admin asset list should filter formal business sources without referencing an unavailable business-link alias'
  )

  state.adminAssets = [{
    ...adminAssetRow,
    id: '55555555-5555-4555-8555-555555555556',
    original_filename: 'review-required.pdf',
    status: 'classified',
    entry_status: 'archived_only',
    entry_metadata: {
      manual_review_required: true,
      auto_import_policy_reason: 'default_auto_import_mode_review_required'
    },
    business_link_count: 0
  }]
  const reviewRequiredAssets = await callGet(
    handlers.handleListAdminAssets,
    '/document-intake/admin/assets?status=classified&limit=10&offset=0'
  )
  assert.equal(reviewRequiredAssets.statusCode, 200, `review-required asset list should load: ${JSON.stringify(reviewRequiredAssets.payload)}`)
  assert.equal(reviewRequiredAssets.payload.items[0].reviewStatus, 'review_required')
  assert.equal(reviewRequiredAssets.payload.items[0].reviewReason, 'default_auto_import_mode_review_required')

  state.adminReviewPlan = {
    id: 'entry-plan-review-1',
    asset_id: '55555555-5555-4555-8555-555555555556',
    batch_id: adminBatchId,
    asset_batch_id: adminBatchId,
    status: 'archived_only',
    target_kind: 'fixed_module_table',
    target_module: 'materials',
    target_document_type: '采购入库单',
    metadata: {
      auto_import_ready: false,
      manual_review_required: true
    },
    asset_status: 'classified'
  }
  const reviewApprove = await callJson(
    handlers.handleReviewAdminAsset,
    { action: 'approve_auto_import', reviewedBy: 'admin-user', reviewNote: '复核通过' },
    '/document-intake/admin/assets/55555555-5555-4555-8555-555555555556/review',
    'POST'
  )
  assert.equal(reviewApprove.statusCode, 200, `review approve should succeed: ${JSON.stringify(reviewApprove.payload)}`)
  assert.equal(reviewApprove.payload.autoImportReady, true)
  assert.equal(reviewApprove.payload.status, 'planned')
  assert.equal(reviewApprove.payload.nextStep, 'fixed_module_business_adapter')
  assert.equal(state.entryPlanUpdates.length, 1, 'review approve should update the latest entry plan')
  assert.match(state.entryPlanUpdates[0].sql, /status = 'planned'/)
  const reviewMetadataPatch = JSON.parse(state.entryPlanUpdates[0].params[1])
  assert.equal(reviewMetadataPatch.auto_import_ready, true)
  assert.equal(reviewMetadataPatch.manual_review_required, false)
  assert.equal(reviewMetadataPatch.ai_review_status, 'reviewed')
  assert.equal(reviewMetadataPatch.reviewed_by, 'admin-user')
  assert.equal(reviewMetadataPatch.review_note, '复核通过')
  const reviewBatchUpdate = state.batchStatusUpdates.find((item) =>
    item.params[0] === adminBatchId &&
    String(item.sql).includes("status = 'classifying'")
  )
  assert.ok(reviewBatchUpdate, 'review approve should move the batch back toward auto-import')
  const reviewBatchMetadata = JSON.parse(reviewBatchUpdate.params[1])
  assert.equal(reviewBatchMetadata.ai_review_status, 'reviewed')
  assert.equal(reviewBatchMetadata.reviewed_asset_id, '55555555-5555-4555-8555-555555555556')
  assert.equal(reviewBatchMetadata.reviewed_entry_plan_id, 'entry-plan-review-1')

  state.adminDetail = {
    asset: adminAssetRow,
    parseJobs: [{
      id: 'parse-job-1',
      asset_id: adminAssetId,
      batch_id: adminBatchId,
      status: 'success',
      parser_type: 'pdf_ocr',
      retry_count: 0,
      metadata: { engine: 'vision' },
      created_at: '2026-06-19T01:00:10.000Z'
    }],
    parseResults: [{
      id: 'parse-result-1',
      asset_id: adminAssetId,
      parse_job_id: 'parse-job-1',
      text_content: 'OCR text',
      tables: [{ name: 'lines' }],
      layout: { pages: 1 },
      ocr_result: { confidence: 0.95 },
      image_descriptions: ['receipt image'],
      metadata: {},
      created_at: '2026-06-19T01:00:30.000Z'
    }],
    classifications: [{
      id: 'classification-1',
      asset_id: adminAssetId,
      batch_id: adminBatchId,
      target_module: 'purchase',
      target_document_type: '采购入库单',
      target_kind: 'fixed_module_table',
      confidence: '0.91',
      reason: 'matched supplier and material columns',
      candidates: [],
      metadata: {},
      created_at: '2026-06-19T01:01:00.000Z'
    }],
    entryPlans: [{
      id: 'entry-plan-1',
      asset_id: adminAssetId,
      batch_id: adminBatchId,
      target_module: 'purchase',
      target_document_type: '采购入库单',
      target_kind: 'fixed_module_table',
      target_schema: 'purchase',
      target_table: 'purchase_receipts',
      mode: 'auto',
      document_count: 1,
      line_count: 3,
      confidence: '0.88',
      reason: 'all required fields mapped',
      columns_snapshot: [{ column: 'supplier' }, { column: 'quantity' }],
      documents: [{
        code: 'PR-001',
        source: 'basic_text',
        source_asset_filename: 'purchase-order.pdf',
        field_mapping_status: 'mapped_with_unmatched_remarks',
        fields: { supplier: '南派', quantity: '12' },
        line_items: [{ material: 'A001', quantity: '12' }],
        ai_unmapped_remarks: '【AI未匹配字段】\n供应商：南派'
      }],
      status: 'imported',
      metadata: {},
      created_at: '2026-06-19T01:01:30.000Z'
    }],
    businessLinks: [{
      id: 'link-1',
      asset_id: adminAssetId,
      batch_id: adminBatchId,
      entry_plan_id: 'entry-plan-1',
      target_schema: 'purchase',
      target_table: 'purchase_receipts',
      target_record_id: 'PR-001',
      target_module: 'purchase',
      target_document_type: '采购入库单',
      ai_confidence: '0.88',
      metadata: { ai_review_status: 'corrected' },
      created_at: '2026-06-19T01:02:00.000Z'
    }],
    unmappedFields: [{
      id: 'unmapped-1',
      asset_id: adminAssetId,
      batch_id: adminBatchId,
      entry_plan_id: 'entry-plan-1',
      target_schema: 'purchase',
      target_table: 'purchase_receipts',
      target_record_id: 'PR-001',
      name: 'remark_text',
      value: 'manual note',
      confidence: '0.4',
      source: 'ocr',
      write_location: 'remarks',
      metadata: {},
      created_at: '2026-06-19T01:02:20.000Z'
    }],
    corrections: [{
      id: 'correction-1',
      business_link_id: 'link-1',
      target_schema: 'purchase',
      target_table: 'purchase_receipts',
      target_record_id: 'PR-001',
      field_name: 'quantity',
      old_value: '10',
      new_value: '12',
      correction_type: 'manual_correction',
      affects_business_result: true,
      recalculation_status: 'pending',
      corrected_by: 'warehouse-user',
      corrected_at: '2026-06-19T01:05:00.000Z',
      metadata: { reason: '复核修正' }
    }],
    recalculationTasks: [{
      id: 'recalc-task-1',
      correction_id: 'correction-1',
      business_link_id: 'link-1',
      target_schema: 'purchase',
      target_table: 'purchase_receipts',
      target_record_id: 'PR-001',
      task_type: 'business_result_recalculation',
      status: 'pending',
      priority: 50,
      attempt_count: 0,
      next_attempt_at: null,
      locked_at: null,
      locked_by: null,
      requested_by: 'warehouse-user',
      requested_at: '2026-06-19T01:05:01.000Z',
      completed_at: null,
      last_error: null,
      metadata: { field_name: 'quantity' }
    }],
    logs: [{
      id: 'log-1',
      level: 'info',
      event_type: 'file_upload_completed',
      message: 'uploaded',
      device_id: adminDeviceId,
      device_name: 'Warehouse PC 01',
      username: 'warehouse-user',
      role: 'warehouse',
      trace_id: 'trace-admin-1',
      ai_import_batch_id: adminBatchId,
      source_file_hash: 'a'.repeat(64),
      uploaded_by_user_id: 'u_2',
      uploaded_by_username: 'warehouse-user',
      uploaded_by_role: 'warehouse',
      upload_source: 'watch_folder',
      operator_source: 'folder_binding_user',
      source_folder: 'D:\\EISCore\\Inbox',
      metadata: {},
      created_at: '2026-06-19T01:02:30.000Z'
    }]
  }
  const adminAssetDetail = await callGet(
    handlers.handleGetAdminAssetDetail,
    `/document-intake/admin/assets/${adminAssetId}`
  )
  assert.equal(adminAssetDetail.statusCode, 200, `admin asset detail should load: ${JSON.stringify(adminAssetDetail.payload)}`)
  assert.equal(adminAssetDetail.payload.asset.batchNo, 'DIB-TEST')
  assert.equal(adminAssetDetail.payload.asset.uploadedByRole, 'warehouse')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('a.uploaded_by_role') &&
        sql.includes('from public.document_assets a') &&
        sql.includes('where a.id = $1') &&
        item.params[0] === adminAssetId
    }),
    'admin asset detail should select the persisted uploaded role column'
  )
  assert.equal(adminAssetDetail.payload.parseResults[0].textContent, 'OCR text')
  assert.equal(adminAssetDetail.payload.classifications[0].reason, 'matched supplier and material columns')
  assert.equal(adminAssetDetail.payload.entryPlans[0].targetTable, 'purchase_receipts')
  assert.equal(adminAssetDetail.payload.entryPlans[0].columnsSnapshot[0].column, 'supplier')
  assert.equal(adminAssetDetail.payload.entryPlans[0].documents[0].fields.supplier, '南派')
  assert.equal(adminAssetDetail.payload.entryPlans[0].documents[0].line_items[0].material, 'A001')
  assert.equal(adminAssetDetail.payload.businessLinks[0].targetRecordId, 'PR-001')
  assert.equal(adminAssetDetail.payload.unmappedFields[0].name, 'remark_text')
  assert.equal(adminAssetDetail.payload.corrections[0].fieldName, 'quantity')
  assert.equal(adminAssetDetail.payload.recalculationTasks[0].status, 'pending')
  assert.equal(adminAssetDetail.payload.recalculationTasks[0].targetRecordId, 'PR-001')
  assert.equal(adminAssetDetail.payload.recalculationTasks[0].metadata.field_name, 'quantity')
  assert.equal(adminAssetDetail.payload.logs[0].traceId, 'trace-admin-1')
  assert.equal(adminAssetDetail.payload.logs[0].uploadedByUsername, 'warehouse-user')
  assert.equal(adminAssetDetail.payload.logs[0].uploadedByRole, 'warehouse')
  assert.equal(adminAssetDetail.payload.logs[0].uploadSource, 'watch_folder')
  assert.equal(adminAssetDetail.payload.logs[0].operatorSource, 'folder_binding_user')
  assert.equal(adminAssetDetail.payload.logs[0].sourceFolder, 'D:\\EISCore\\Inbox')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('from public.client_log_events l') &&
        sql.includes('$6::text as uploaded_by_user_id') &&
        item.params.includes('warehouse-user') &&
        item.params.includes('warehouse') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user')
    }),
    'admin asset detail logs should attach the asset upload ownership snapshot'
  )

  const duplicateOriginalAssetId = '66666666-6666-4666-8666-666666666666'
  state.adminDetail.asset = {
    ...adminAssetRow,
    id: '77777777-7777-4777-8777-777777777777',
    status: 'duplicate',
    duplicate: true,
    duplicate_of_asset_id: duplicateOriginalAssetId,
    duplicate_of_original_filename: 'purchase-order-original.pdf',
    duplicate_of_file_hash: 'b'.repeat(64),
    duplicate_of_uploaded_at: '2026-06-18T09:30:00.000Z',
    duplicate_of_upload_source: 'collector_desktop'
  }
  const duplicateAssetDetail = await callGet(
    handlers.handleGetAdminAssetDetail,
    '/document-intake/admin/assets/77777777-7777-4777-8777-777777777777'
  )
  assert.equal(duplicateAssetDetail.statusCode, 200, `duplicate admin asset detail should load: ${JSON.stringify(duplicateAssetDetail.payload)}`)
  assert.equal(duplicateAssetDetail.payload.asset.duplicate, true)
  assert.equal(duplicateAssetDetail.payload.asset.duplicateOfAssetId, duplicateOriginalAssetId)
  assert.equal(duplicateAssetDetail.payload.asset.duplicateOfOriginalFilename, 'purchase-order-original.pdf')
  assert.equal(duplicateAssetDetail.payload.asset.duplicateOfFileHash, 'b'.repeat(64))
  assert.equal(duplicateAssetDetail.payload.asset.duplicateOfUploadedAt, '2026-06-18T09:30:00.000Z')
  assert.equal(duplicateAssetDetail.payload.asset.duplicateOfUploadSource, 'collector_desktop')
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('left join public.document_assets oa on oa.id = a.duplicate_of_asset_id') &&
        sql.includes('oa.original_filename as duplicate_of_original_filename')
    }),
    'admin asset detail should join the original asset for duplicate provenance'
  )
  state.adminDetail.asset = adminAssetRow

  const missingBusinessSourceFields = await callGet(
    handlers.handleListAdminBusinessSources,
    '/document-intake/admin/business-sources'
  )
  assert.equal(missingBusinessSourceFields.statusCode, 400, 'business source lookup should require a business record locator')
  assert.equal(missingBusinessSourceFields.payload.code, 'BUSINESS_SOURCE_FIELDS_REQUIRED')

  const invalidBusinessLinkSource = await callGet(
    handlers.handleListAdminBusinessSources,
    '/document-intake/admin/business-sources?businessLinkId=not-a-uuid'
  )
  assert.equal(invalidBusinessLinkSource.statusCode, 400, 'business source lookup should validate businessLinkId')
  assert.equal(invalidBusinessLinkSource.payload.code, 'BUSINESS_LINK_ID_INVALID')

  const businessSourceRow = {
    business_link_id: 'link-1',
    asset_id: adminAssetId,
    business_link_batch_id: adminBatchId,
    entry_plan_id: 'entry-plan-1',
    target_schema: 'purchase',
    target_table: 'purchase_receipts',
    target_record_id: 'PR-001',
    business_target_module: 'purchase',
    business_target_document_type: '采购入库单',
    target_app_id: 'purchase-app',
    ai_confidence: '0.96',
    business_link_metadata: { ai_generated: true, duplicate_business_source: true },
    duplicate_business_source: true,
    business_link_created_at: '2026-06-19T01:02:00.000Z',
    asset_batch_id: adminBatchId,
    device_id: adminDeviceId,
    uploaded_by_user_id: 'u_2',
    uploaded_by_username: 'warehouse-user',
    uploaded_by_role: 'warehouse',
    operator_source: 'folder_binding_user',
    original_filename: 'purchase-order.pdf',
    mime_type: 'application/pdf',
    file_ext: '.pdf',
    file_size: '2048',
    file_hash: 'a'.repeat(64),
    source_folder: 'D:\\EISCore\\Inbox',
    upload_source: 'watch_folder',
    asset_status: 'imported',
    asset_metadata: {},
    duplicate_of_asset_id: null,
    duplicate: false,
    asset_created_at: '2026-06-19T01:00:00.000Z',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    batch_no: 'DIB-TEST',
    batch_status: 'completed'
  }
  state.adminBusinessSources = [businessSourceRow]
  const businessSources = await callGet(
    handlers.handleListAdminBusinessSources,
    `/document-intake/admin/business-sources?targetSchema=purchase&targetTable=purchase_receipts&targetRecordId=PR-001&uploadedBy=warehouse-user&uploadedByRole=warehouse&uploadSource=watch_folder&operatorSource=folder_binding_user&sourceFolder=${encodeURIComponent('D:\\EISCore\\Inbox')}&duplicateBusinessSource=true`
  )
  assert.equal(businessSources.statusCode, 200, `business source lookup should load: ${JSON.stringify(businessSources.payload)}`)
  assert.equal(businessSources.payload.total, 1)
  assert.equal(businessSources.payload.items[0].businessLink.targetRecordId, 'PR-001')
  assert.equal(businessSources.payload.items[0].businessLink.targetAppId, 'purchase-app')
  assert.equal(businessSources.payload.items[0].businessLink.duplicateBusinessSource, true)
  assert.equal(businessSources.payload.items[0].asset.originalFilename, 'purchase-order.pdf')
  assert.equal(businessSources.payload.items[0].asset.deviceCode, 'warehouse-pc-01')
  assert.equal(businessSources.payload.items[0].asset.uploadedByRole, 'warehouse')
  assert.equal(businessSources.payload.items[0].asset.actionHref, `/document-intake/admin/assets/${adminAssetId}`)
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('a.uploaded_by_role')
    ),
    'business source lookup should select uploaded_by_role from document assets'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase();
      return sql.includes('from public.document_business_links l') &&
        sql.includes('join public.document_assets a') &&
        sql.includes('a.upload_source =') &&
        sql.includes("coalesce(a.operator_source, a.metadata->>'operator_source'") &&
        sql.includes('a.source_folder ilike') &&
        sql.includes("lower(coalesce(l.metadata->>'duplicate_business_source'") &&
        sql.includes(")) in ('true', '1', 'yes', 'y', 'on', '是')") &&
        sql.includes('a.uploaded_by_user_id =') &&
        sql.includes('a.uploaded_by_username =') &&
        sql.includes('coalesce(a.uploaded_by_role') &&
        item.params.includes('watch_folder') &&
        item.params.includes('folder_binding_user') &&
        item.params.includes('%D:\\EISCore\\Inbox%') &&
        item.params.includes('warehouse-user') &&
        item.params.includes('warehouse');
    }),
    'business source lookup should filter by upload user, role, upload source, source folder and operator source'
  )

  state.adminBusinessSources = [{
    ...businessSourceRow,
    business_link_id: 'link-2',
    target_record_id: 'PR-002',
    business_link_metadata: { ai_generated: true, duplicate_business_source: false },
    duplicate_business_source: false
  }]
  const formalBusinessSources = await callGet(
    handlers.handleListAdminBusinessSources,
    '/document-intake/admin/business-sources?targetSchema=purchase&targetTable=purchase_receipts&targetRecordId=PR-002&duplicateBusinessSource=false'
  )
  assert.equal(formalBusinessSources.statusCode, 200, `formal business source lookup should load: ${JSON.stringify(formalBusinessSources.payload)}`)
  assert.equal(formalBusinessSources.payload.total, 1)
  assert.equal(formalBusinessSources.payload.items[0].businessLink.targetRecordId, 'PR-002')
  assert.equal(formalBusinessSources.payload.items[0].businessLink.duplicateBusinessSource, false)
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase();
      return sql.includes('from public.document_business_links l') &&
        sql.includes("lower(coalesce(l.metadata->>'duplicate_business_source'") &&
        sql.includes(")) not in ('true', '1', 'yes', 'y', 'on', '是')") &&
        item.params.includes('PR-002');
    }),
    'business source lookup should independently filter formal non-duplicate business sources'
  )

  const appRecordSources = await callGet(
    handlers.handleListAdminBusinessSources,
    '/document-intake/admin/business-sources?targetAppId=purchase-app&recordId=PR-001'
  )
  assert.equal(appRecordSources.statusCode, 200, 'business source lookup should support dynamic app record locator')
  assert.equal(appRecordSources.payload.items[0].asset.fileHash, 'a'.repeat(64))

  const adminSourceFile = path.join(tmpRoot, 'admin-source-files', 'purchase-order.pdf')
  await fs.mkdir(path.dirname(adminSourceFile), { recursive: true })
  await fs.writeFile(adminSourceFile, 'original purchase order bytes')
  state.adminDetail.asset.storage_path = adminSourceFile
  const adminAssetDownload = await callDownloadAsset(`/document-intake/admin/assets/${adminAssetId}/download`)
  assert.equal(adminAssetDownload.statusCode, 200, 'admin asset source file should download')
  assert.equal(adminAssetDownload.headers['Content-Type'], 'application/pdf')
  assert.match(adminAssetDownload.headers['Content-Disposition'], /purchase-order\.pdf/, 'download should preserve original filename')
  assert.equal(adminAssetDownload.body.toString('utf8'), 'original purchase order bytes')

  const unsupportedPreview = await callPreviewAsset(`/document-intake/admin/assets/${adminAssetId}/preview`)
  assert.equal(unsupportedPreview.statusCode, 415, 'admin asset preview should reject unsupported binary files')
  assert.equal(unsupportedPreview.payload.code, 'DOCUMENT_ASSET_PREVIEW_UNSUPPORTED')

  const adminPreviewFile = path.join(tmpRoot, 'admin-source-files', 'purchase-order.txt')
  await fs.writeFile(adminPreviewFile, '采购入库单\n供应商：南派\n物料,数量\nA001,12')
  state.adminDetail.asset.storage_path = adminPreviewFile
  state.adminDetail.asset.original_filename = 'purchase-order.txt'
  state.adminDetail.asset.mime_type = 'text/plain'
  const adminAssetPreview = await callPreviewAsset(`/document-intake/admin/assets/${adminAssetId}/preview`)
  assert.equal(adminAssetPreview.statusCode, 200, `admin asset source file should preview: ${JSON.stringify(adminAssetPreview.payload)}`)
  assert.equal(adminAssetPreview.payload.asset.originalFilename, 'purchase-order.txt')
  assert.equal(adminAssetPreview.payload.preview.truncated, false)
  assert.match(adminAssetPreview.payload.preview.text, /供应商：南派/, 'preview should return source text')

  state.adminDetail.asset.storage_path = path.join(os.tmpdir(), 'outside-document-intake-root.pdf')
  state.adminDetail.asset.original_filename = 'outside.txt'
  state.adminDetail.asset.mime_type = 'text/plain'
  const unsafeAssetDownload = await callDownloadAsset(`/document-intake/admin/assets/${adminAssetId}/download`)
  assert.equal(unsafeAssetDownload.statusCode, 404, 'admin asset download should reject paths outside the document intake storage root')
  const unsafeAssetPreview = await callPreviewAsset(`/document-intake/admin/assets/${adminAssetId}/preview`)
  assert.equal(unsafeAssetPreview.statusCode, 404, 'admin asset preview should reject paths outside the document intake storage root')
  await fs.rm(adminSourceFile, { force: true })
  await fs.rm(adminPreviewFile, { force: true })

  resetState()
  const adminCollectorDeviceId = '55555555-5555-4555-8555-555555555555'
  state.adminDevices = [{
    id: adminCollectorDeviceId,
    device_code: 'local-collector-01',
    device_name: 'Local Collector 01',
    enterprise_id: 'local',
    department_id: 'warehouse',
    default_user_id: 'u_device',
    default_username: 'device-user',
    default_role: '仓库员',
    server_base_url: 'http://localhost/agent',
    client_version: '0.2.0',
    webview_version: 'WebView2',
    status: 'active',
    last_seen_at: new Date().toISOString(),
    metadata: {
      remote_config_version: 'cfg-v1',
      heartbeat_payload: {
        health: {
          pendingUploadCount: 2,
          failedUploadCount: 1,
          pendingLogCount: 4,
          missingWatchFolderCount: 1,
          inaccessibleWatchFolderCount: 0
        }
      }
    },
    created_at: '2026-06-19T02:00:00.000Z',
    updated_at: '2026-06-19T02:05:00.000Z',
    watch_folder_count: 1,
    today_file_count: 3,
    total_file_count: 12,
    log_count: 4,
    last_asset_at: '2026-06-19T02:04:00.000Z'
  }]
  state.adminWatchFolders = [{
    id: 'folder-1',
    device_id: adminCollectorDeviceId,
    folder_path: 'D:\\EISCore\\Inbox',
    folder_name: '默认收单',
    default_user_id: 'u_folder',
    default_username: 'folder-user',
    default_role: '仓库员',
    enabled: true,
    metadata: {},
    created_at: '2026-06-19T02:01:00.000Z',
    updated_at: '2026-06-19T02:01:00.000Z'
  }]
  const deviceLastSeenFrom = '2026-06-19T01:00:00.000Z'
  const deviceLastSeenTo = '2026-06-19T03:00:00.000Z'
  const adminDeviceList = await callGet(
    handlers.handleListAdminDevices,
    `/document-intake/admin/devices?status=active&onlineStatus=active&healthIssue=upload_backlog&clientVersion=0.2&webviewVersion=WebView2&defaultUser=device-user&defaultRole=${encodeURIComponent('仓库员')}&lastSeenFrom=${encodeURIComponent(deviceLastSeenFrom)}&lastSeenTo=${encodeURIComponent(deviceLastSeenTo)}&search=local&limit=20&offset=0&activeWindowMinutes=60`
  )
  assert.equal(adminDeviceList.statusCode, 200, `admin device list should load: ${JSON.stringify(adminDeviceList.payload)}`)
  assert.equal(adminDeviceList.payload.total, 1)
  assert.equal(adminDeviceList.payload.items[0].deviceCode, 'local-collector-01')
  assert.equal(adminDeviceList.payload.items[0].onlineStatus, 'active')
  assert.equal(adminDeviceList.payload.items[0].clientVersion, '0.2.0')
  assert.equal(adminDeviceList.payload.items[0].webviewVersion, 'WebView2')
  assert.equal(adminDeviceList.payload.items[0].defaultUsername, 'device-user')
  assert.equal(adminDeviceList.payload.items[0].defaultRole, '仓库员')
  assert.equal(adminDeviceList.payload.items[0].healthSummary.uploadBacklogCount, 3)
  assert.equal(adminDeviceList.payload.items[0].healthSummary.pendingLogCount, 4)
  assert.equal(adminDeviceList.payload.items[0].healthSummary.missingWatchFolderCount, 1)
  assert.equal(adminDeviceList.payload.items[0].watchFolderCount, 1)
  assert.equal(adminDeviceList.payload.items[0].todayFileCount, 3)
  assert.equal(adminDeviceList.payload.items[0].metadata.remote_config_version, undefined, 'device list should not include metadata by default')
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.last_seen_at >= now()') &&
      item.params.includes('60 minutes')
    ),
    'admin device list should filter by computed online status'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('heartbeat_payload,health,pendinguploadcount') &&
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('heartbeat_payload,health,faileduploadcount')
    ),
    'admin device list should filter by health upload backlog'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.client_version ilike') &&
      item.params.includes('%0.2%')
    ),
    'admin device list should filter by client version'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.webview_version ilike') &&
      item.params.includes('%WebView2%')
    ),
    'admin device list should filter by WebView version'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('(d.default_user_id =') &&
      item.params.includes('device-user')
    ),
    'admin device list should filter by default upload user'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.default_role =') &&
      item.params.includes('仓库员')
    ),
    'admin device list should filter by default role'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.last_seen_at >=') &&
      item.params.includes(deviceLastSeenFrom)
    ),
    'admin device list should filter by last seen start time'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.last_seen_at <=') &&
      item.params.includes(deviceLastSeenTo)
    ),
    'admin device list should filter by last seen end time'
  )

  const deviceAliasFilterStart = state.poolQueries.length
  const aliasDeviceList = await callGet(
    handlers.handleListAdminDevices,
    `/document-intake/admin/devices?online_status=offline&health_issue=pending_log&webViewVersion=126&default_uploaded_by=u_device&last_seen_at_from=${encodeURIComponent(deviceLastSeenFrom)}&last_seen_at_to=${encodeURIComponent(deviceLastSeenTo)}&activeWindowMinutes=15`
  )
  assert.equal(aliasDeviceList.statusCode, 200, `admin device alias filters should load: ${JSON.stringify(aliasDeviceList.payload)}`)
  const aliasDeviceQueries = state.poolQueries.slice(deviceAliasFilterStart)
  assert.ok(
    aliasDeviceQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes("coalesce(d.status, '') <> 'disabled'") &&
      item.params.includes('15 minutes')
    ),
    'admin device list should support online_status=offline alias'
  )
  assert.ok(
    aliasDeviceQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('heartbeat_payload,health,pendinglogcount')
    ),
    'admin device list should support health_issue=pending_log alias'
  )
  assert.ok(
    aliasDeviceQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.webview_version ilike') &&
      item.params.includes('%126%')
    ),
    'admin device list should support webViewVersion alias'
  )
  assert.ok(
    aliasDeviceQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('(d.default_user_id =') &&
      item.params.includes('u_device')
    ),
    'admin device list should support default_uploaded_by alias'
  )
  assert.ok(
    aliasDeviceQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.last_seen_at >=') &&
      item.params.includes(deviceLastSeenFrom)
    ),
    'admin device list should support last_seen_at_from alias'
  )
  assert.ok(
    aliasDeviceQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.last_seen_at <=') &&
      item.params.includes(deviceLastSeenTo)
    ),
    'admin device list should support last_seen_at_to alias'
  )

  const adminDeviceDetail = await callGet(
    handlers.handleGetAdminDeviceDetail,
    `/document-intake/admin/devices/${adminCollectorDeviceId}?activeWindowMinutes=60`
  )
  assert.equal(adminDeviceDetail.statusCode, 200, `admin device detail should load: ${JSON.stringify(adminDeviceDetail.payload)}`)
  assert.equal(adminDeviceDetail.payload.device.deviceName, 'Local Collector 01')
  assert.equal(adminDeviceDetail.payload.device.watchFolders[0].folderPath, 'D:\\EISCore\\Inbox')
  assert.equal(adminDeviceDetail.payload.device.metadata.remote_config_version, 'cfg-v1')
  assert.equal(adminDeviceDetail.payload.device.deviceTokenHash, undefined, 'admin device detail should not leak token hashes')
  assert.equal(adminDeviceDetail.payload.device.bindingCodeHash, undefined, 'admin device detail should not leak binding hashes')

  resetState()
  const createDevice = await callJson(handlers.handleCreateAdminDevice, {
    enterpriseId: 'local',
    deviceCode: 'new-collector-01',
    deviceName: 'New Collector 01',
    authorizationCode: 'ADMIN-CODE-1',
    defaultUserId: 'u_new',
    defaultUsername: 'new-user',
    defaultRole: '仓库员',
    watchFolders: [{
      folderPath: 'E:\\EISCore\\Inbox',
      folderName: '新增收单',
      defaultUserId: 'u_new_folder',
      defaultUsername: 'new-folder-user',
      defaultRole: '收单员',
      enabled: true
    }]
  })
  assert.equal(createDevice.statusCode, 201, `admin device create should succeed: ${JSON.stringify(createDevice.payload)}`)
  assert.equal(createDevice.payload.authorizationCode, 'ADMIN-CODE-1')
  assert.equal(createDevice.payload.device.deviceCode, 'new-collector-01')
  assert.equal(createDevice.payload.device.watchFolders[0].folderPath, 'E:\\EISCore\\Inbox')
  assert.equal(createDevice.payload.device.watchFolders[0].defaultUsername, 'new-folder-user')
  assert.equal(state.adminDeviceInserts.length, 1, 'admin create should insert one device')
  assert.equal(state.adminDeviceInserts[0][8], sha256('ADMIN-CODE-1'), 'admin create should store only binding code hash')
  assert.equal(state.watchFolderInserts.length, 1, 'admin create should insert configured watch folder')

  const createdDeviceId = createDevice.payload.device.id
  const updateDevice = await callJson(
    handlers.handleUpdateAdminDevice,
    {
      deviceName: 'New Collector Renamed',
      defaultUsername: 'updated-user',
      defaultRole: '复核员',
      status: 'active',
      remoteConfig: {
        version: 'cfg-admin',
        logs: { retention_days: 20 }
      },
      watchFolders: [{
        folderPath: 'F:\\EISCore\\Review',
        folderName: '复核目录',
        defaultUserId: 'u_review',
        defaultUsername: 'review-user',
        defaultRole: '复核员',
        enabled: false
      }]
    },
    `/document-intake/admin/devices/${createdDeviceId}`,
    'PATCH'
  )
  assert.equal(updateDevice.statusCode, 200, `admin device update should succeed: ${JSON.stringify(updateDevice.payload)}`)
  assert.equal(updateDevice.payload.device.deviceName, 'New Collector Renamed')
  assert.equal(updateDevice.payload.device.defaultUsername, 'updated-user')
  assert.equal(updateDevice.payload.device.status, 'active')
  assert.equal(updateDevice.payload.device.watchFolders[0].defaultUsername, 'review-user')
  assert.equal(updateDevice.payload.device.watchFolders[0].enabled, false)
  assert.equal(updateDevice.payload.device.metadata.remote_config.version, 'cfg-admin')
  assert.equal(state.adminDeviceUpdates.length, 1, 'admin update should update one device')

  const resetBindCode = await callJson(
    handlers.handleResetAdminDeviceBindCode,
    { authorizationCode: 'RESET-CODE-1' },
    `/document-intake/admin/devices/${createdDeviceId}/reset-bind-code`,
    'POST'
  )
  assert.equal(resetBindCode.statusCode, 200, `admin reset bind code should succeed: ${JSON.stringify(resetBindCode.payload)}`)
  assert.equal(resetBindCode.payload.authorizationCode, 'RESET-CODE-1')
  assert.equal(resetBindCode.payload.device.status, 'pending')
  assert.equal(state.adminBindResets.length, 1, 'admin reset should update one device')
  assert.equal(state.adminBindResets[0][1], sha256('RESET-CODE-1'), 'admin reset should store only the new binding code hash')

  resetState()
  state.adminLogs = [{
    id: 'log-admin-1',
    level: 'error',
    event_type: 'file_upload_failed',
    message: 'upload failed',
    stack: 'stack trace',
    device_id: adminCollectorDeviceId,
    device_code: 'local-collector-01',
    device_name: 'Local Collector 01',
    user_id: 'u_device',
    username: 'device-user',
    role: '仓库员',
    app_module: 'document_intake',
    route: '/collector/upload',
    url: '',
    request_url: 'http://localhost/agent/document-intake/assets/upload',
    status_code: 500,
    client_session_id: 'session-1',
    trace_id: 'trace-log-1',
    ai_import_batch_id: adminBatchId,
    ai_import_batch_no: 'DIB-LOG-001',
    source_file_hash: 'b'.repeat(64),
    source_asset_id: adminAssetId,
    source_asset_count: 1,
    asset_status: 'failed',
    duplicate: true,
    uploaded_by_user_id: 'uploader-1',
    uploaded_by_username: 'warehouse-user',
    uploaded_by_role: 'warehouse',
    upload_source: 'watch_folder',
    operator_source: 'folder_binding_user',
    source_folder: 'D:\\EISCore\\Warehouse',
    app_version: '0.2.0',
    webview_version: 'WebView2',
    metadata: { retryable: true },
    created_at: '2026-06-19T03:00:00.000Z'
  }]
  const adminLogs = await callGet(
    handlers.handleListAdminLogs,
    `/document-intake/admin/logs?deviceCode=local-collector-01&username=device-user&role=${encodeURIComponent('仓库员')}&appModule=document_intake&route=/collector/upload&level=error&eventType=file_upload_failed&clientSessionId=session-1&traceId=trace-log-1&batchId=${adminBatchId}&batchNo=DIB-LOG-001&fileHash=${'b'.repeat(64)}&assetStatus=failed&duplicate=true&uploadedBy=warehouse-user&uploadedByRole=warehouse&uploadSource=watch_folder&operatorSource=folder_binding_user&sourceFolder=${encodeURIComponent('D:\\EISCore\\Warehouse')}&limit=50`
  )
  assert.equal(adminLogs.statusCode, 200, `admin logs should load: ${JSON.stringify(adminLogs.payload)}`)
  assert.equal(adminLogs.payload.total, 1)
  assert.equal(adminLogs.payload.items[0].deviceCode, 'local-collector-01')
  assert.equal(adminLogs.payload.items[0].eventType, 'file_upload_failed')
  assert.equal(adminLogs.payload.items[0].role, '仓库员')
  assert.equal(adminLogs.payload.items[0].clientSessionId, 'session-1')
  assert.equal(adminLogs.payload.items[0].traceId, 'trace-log-1')
  assert.equal(adminLogs.payload.items[0].aiImportBatchNo, 'DIB-LOG-001')
  assert.equal(adminLogs.payload.items[0].sourceFileHash, 'b'.repeat(64))
  assert.equal(adminLogs.payload.items[0].sourceAssetId, adminAssetId)
  assert.equal(adminLogs.payload.items[0].sourceAssetCount, 1)
  assert.equal(adminLogs.payload.items[0].assetStatus, 'failed')
  assert.equal(adminLogs.payload.items[0].duplicate, true)
  assert.equal(adminLogs.payload.items[0].uploadedByUsername, 'warehouse-user')
  assert.equal(adminLogs.payload.items[0].uploadedByRole, 'warehouse')
  assert.equal(adminLogs.payload.items[0].uploadSource, 'watch_folder')
  assert.equal(adminLogs.payload.items[0].operatorSource, 'folder_binding_user')
  assert.equal(adminLogs.payload.items[0].sourceFolder, 'D:\\EISCore\\Warehouse')
  assert.equal(adminLogs.payload.items[0].metadata.retryable, true)
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('l.client_session_id =') &&
      item.params.includes('session-1')
    ),
    'admin log list should filter by client session id'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('d.device_code =') &&
      item.params.includes('local-collector-01')
    ),
    'admin log list should filter by device code'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('(l.username =') &&
      item.params.includes('device-user')
    ),
    'admin log list should filter by username or user id'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('l.role =') &&
      item.params.includes('仓库员')
    ),
    'admin log list should filter by user role'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('l.app_module =') &&
      item.params.includes('document_intake')
    ),
    'admin log list should filter by app module'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('l.route =') &&
      item.params.includes('/collector/upload')
    ),
    'admin log list should filter by route'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('lower(l.level) =') &&
      item.params.includes('error')
    ),
    'admin log list should filter by level'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('l.event_type =') &&
      item.params.includes('file_upload_failed')
    ),
    'admin log list should filter by event type'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('l.trace_id =') &&
      item.params.includes('trace-log-1')
    ),
    'admin log list should filter by trace id'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('l.source_file_hash =') &&
      item.params.includes('b'.repeat(64))
    ),
    'admin log list should filter by source file hash'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('array_agg(a.id order by a.created_at desc, a.id desc') &&
        sql.includes('as source_asset_id') &&
        sql.includes('as source_asset_count') &&
        sql.includes('as asset_status') &&
        sql.includes('as duplicate')
    }),
    'admin log list should expose linked source asset id, status and duplicate marker for direct traceability'
  )
  assert.ok(
    state.poolQueries.some((item) =>
      String(item.sql).replace(/\s+/g, ' ').toLowerCase().includes('b.batch_no ilike') &&
      item.params.includes('%DIB-LOG-001%')
    ),
    'admin log list should filter by import batch number'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('exists ( select 1 from public.document_assets a') &&
        sql.includes('a.uploaded_by_username =') &&
        item.params.includes('warehouse-user')
    }),
    'admin log list should filter by linked asset uploaded user'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes("a.metadata->>'uploaded_by_role'") &&
        item.params.includes('warehouse')
    }),
    'admin log list should filter by linked asset uploaded role'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('exists ( select 1 from public.document_assets a') &&
        sql.includes('a.status =') &&
        item.params.includes('failed')
    }),
    'admin log list should filter by linked source asset status'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('exists ( select 1 from public.document_assets a') &&
        sql.includes("a.status = 'duplicate'") &&
        sql.includes('a.duplicate_of_asset_id is not null')
    }),
    'admin log list should filter by linked source asset duplicate marker'
  )
  const nonDuplicateLogQueryStart = state.poolQueries.length
  const nonDuplicateAdminLogs = await callGet(
    handlers.handleListAdminLogs,
    '/document-intake/admin/logs?duplicate=false&limit=1'
  )
  assert.equal(nonDuplicateAdminLogs.statusCode, 200, `admin non-duplicate logs should load: ${JSON.stringify(nonDuplicateAdminLogs.payload)}`)
  assert.ok(
    state.poolQueries.slice(nonDuplicateLogQueryStart).some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('exists ( select 1 from public.document_assets a') &&
        sql.includes("a.status <> 'duplicate'") &&
        sql.includes('a.duplicate_of_asset_id is null')
    }),
    'admin log list should filter non-duplicate linked source assets independently'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes('a.upload_source =') &&
        item.params.includes('watch_folder')
    }),
    'admin log list should filter by linked asset upload source'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes("a.metadata->>'operator_source'") &&
        item.params.includes('folder_binding_user')
    }),
    'admin log list should filter by linked asset operator source'
  )
  assert.ok(
    state.poolQueries.some((item) => {
      const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
      return sql.includes("l.metadata->>'source_folder'") &&
        sql.includes('a.source_folder ilike') &&
        item.params.includes('%D:\\EISCore\\Warehouse%')
    }),
    'admin log list should filter by log metadata or linked asset source folder'
  )

  resetState()
  const boundary = '----eiscore-test-boundary'
  const fileContent = Buffer.from('采购入库单\n供应商：南派\n物料,数量\nA001,12')
  const badHash = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: { original_filename: '../unsafe:name.txt', file_hash: 'bad-hash' },
      filename: '../unsafe:name.txt',
      fileContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(badHash.statusCode, 400, 'upload should reject mismatched client hash')
  assert.equal(badHash.payload.code, 'FILE_HASH_MISMATCH')
  assert.equal(state.connected, 0, 'hash mismatch should fail before opening an upload transaction')

  resetState()
  const badMetadata = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, { metadataRaw: '{"bad":', fileContent }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(badMetadata.statusCode, 400, 'upload should reject malformed metadata JSON')
  assert.equal(badMetadata.payload.code, 'BAD_METADATA')

  resetState()
  const goodUpload = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: {
        original_filename: '../unsafe:name.txt',
        file_hash: sha256(fileContent),
        file_size: 999999,
        uploaded_by_username: 'operator',
        source_folder: 'D:\\EISCore\\Inbox'
      },
      filename: '../unsafe:name.txt',
      fileContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(goodUpload.statusCode, 200, 'valid upload should succeed')
  assert.equal(goodUpload.payload.duplicate, false)
  assert.equal(state.assetInsertParams.length, 1, 'valid upload should insert one asset')
  assert.equal(state.assetInsertParams[0][6], 'unsafe_name.txt', 'stored filename should be sanitized')
  assert.equal(state.assetInsertParams[0][10], fileContent.length, 'server should store the real uploaded byte length')
  assert.equal(state.assetInsertParams[0][12], 'D:\\EISCore\\Inbox', 'server should persist the source watch folder')
  assert.equal(state.parseJobInserts, 1, 'new uploads should create a parse job')
  assert.equal(state.parseResultInserts.length, 1, 'basic text uploads should create one parse result')
  assert.match(state.parseResultInserts[0][2], /采购入库单/, 'basic parse result should preserve text content')
  assert.deepEqual(state.parseResultInserts[0][3][0].columns, ['物料', '数量'], 'basic text parser should extract simple CSV table headers')
  assert.deepEqual(state.parseResultInserts[0][3][0].rows[0], { '物料': 'A001', '数量': '12' }, 'basic text parser should extract simple CSV table rows')
  assert.equal(state.classificationInserts.length, 1, 'basic text uploads should create one classification result')
  assert.equal(state.classificationInserts[0][2], 'materials')
  assert.equal(state.classificationInserts[0][3], '采购入库单')
  assert.equal(state.entryPlanInserts.length, 1, 'classified text uploads should create one entry plan')
  assert.equal(state.entryPlanInserts[0][2], 'materials')
  assert.equal(state.entryPlanInserts[0][3], '采购入库单')
  assert.equal(state.entryPlanInserts[0][5], 'one_document_with_lines')
  assert.equal(state.entryPlanInserts[0][10][0].fields['供应商'], '南派', 'entry plan should preserve extracted key-value fields')
  assert.deepEqual(state.entryPlanInserts[0][10][0].line_items[0], { '物料': 'A001', '数量': '12' }, 'entry plan should preserve extracted line items')
  assert.deepEqual(state.entryPlanInserts[0][10][0].tables_preview[0].columns, ['物料', '数量'], 'entry plan should expose table preview for fixed-module auto entry')
  assert.equal(state.entryPlanInserts[0][10][0].field_mapping_status, 'basic_text_extracted')
  assert.equal(state.entryPlanInserts[0][11], 'archived_only', 'review-required policy should stop automatic worker consumption')
  assert.equal(state.entryPlanInserts[0][12].auto_import_ready, false, 'review-required policy should mark entry plan as not auto-importable')
  assert.equal(state.entryPlanInserts[0][12].next_step, 'manual_review_or_archive')
  assert.equal(state.entryPlanInserts[0][12].auto_import_policy_action, 'manual_review_required')
  assert.equal(state.entryPlanInserts[0][12].auto_import_policy_reason, 'default_auto_import_mode_review_required')
  assert.match(state.entryPlanInserts[0][10][0].ai_unmapped_remarks, /【AI未匹配字段】/, 'entry plan should render unmapped fields into remarks text')
  assert.match(state.entryPlanInserts[0][10][0].ai_unmapped_remarks, /供应商：南派/, 'remarks text should include extracted field values')
  assert.match(state.entryPlanInserts[0][10][0].ai_unmapped_remarks, /来源文件：unsafe_name.txt/, 'remarks text should include source filename')
  assert.equal(state.entryPlanInserts[0][10][0].remarks, state.entryPlanInserts[0][10][0].ai_unmapped_remarks, 'remarks should mirror AI supplemental remarks')
  assert.equal(state.entryPlanInserts[0][10][0].properties.__ai_unmapped_fields[0].name, '供应商')
  assert.equal(state.entryPlanInserts[0][10][0].properties.__ai_unmapped_write_location, 'remarks')
  assert.equal(state.entryPlanInserts[0][12].unmapped_field_policy, 'remarks', 'entry plan metadata should declare remarks fallback policy')
  assert.equal(state.entryPlanInserts[0][12].unmapped_field_count, 1)
  assert.ok(
    state.batchStatusUpdates.some((item) => item.params[1] === 'completed' && item.params[2].includes('manual_review_required')),
    'review-required policy should complete the batch without launching auto import'
  )
  assert.equal(state.unmappedFieldInserts.length, 1, 'basic text fields should be stored as structured unmapped fields')
  assert.equal(state.unmappedFieldInserts[0][3], '供应商')
  assert.equal(state.unmappedFieldInserts[0][4], '南派')
  assert.equal(state.unmappedFieldInserts[0][7].extractor, 'basic_text_key_value')
  assert.equal(state.unmappedFieldInserts[0][7].write_location, 'remarks')
  assert.match(state.unmappedFieldInserts[0][7].remarks_text, /供应商：南派/)
  assert.ok(
    state.assetStatusUpdates.some((item) => String(item.sql).includes("status = 'classified'")),
    'classified text upload should advance asset status to classified'
  )
  const storedUploadFiles = (await listFiles(tmpRoot)).filter((filePath) => {
    const relativeToReleaseDir = path.relative(process.env.COLLECTOR_RELEASE_DIR, filePath)
    return relativeToReleaseDir.startsWith('..') || path.isAbsolute(relativeToReleaseDir)
  })
  assert.equal(storedUploadFiles.length, 1, 'new uploads should be written to storage')

  resetState()
  Object.assign(state.device, {
    default_user_id: '',
    default_username: '',
    default_role: 'warehouse'
  })
  const unknownOwnerContent = Buffer.from('未知上传人测试\n仅用于岗位兜底\n')
  const unknownOwnerUpload = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: {
        original_filename: 'unknown-owner.txt',
        file_hash: sha256(unknownOwnerContent)
      },
      filename: 'unknown-owner.txt',
      fileContent: unknownOwnerContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(unknownOwnerUpload.statusCode, 200, 'upload without user identity should still be accepted')
  assert.equal(state.assetInsertParams.length, 1, 'unknown-owner upload should insert one asset')
  assert.equal(state.assetInsertParams[0][2], '', 'unknown-owner upload should not invent a user id')
  assert.equal(state.assetInsertParams[0][3], '', 'unknown-owner upload should not invent a username')
  assert.equal(state.assetInsertParams[0][4], 'warehouse', 'unknown-owner upload should persist the default role column for traceability')
  assert.equal(state.assetInsertParams[0][5], 'unknown', 'unknown-owner upload should be explicitly marked unknown')
  assert.equal(state.assetInsertParams[0][16].uploaded_by_role, 'warehouse', 'unknown-owner upload should keep the default role in metadata for compatibility')

  const typeMappingPolicy = await callJson(
    handlers.handleUpdateAdminPolicies,
    {
      policy: {
        documentTypeMappings: [{
          id: 'custom-safety-inspection',
          name: '安全巡检',
          targetModule: 'equipment',
          targetDocumentType: '安全巡检记录',
          targetKind: 'fixed_module_table',
          keywords: ['安全巡检', '隐患'],
          priority: 250,
          enabled: true
        }]
      }
    },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(typeMappingPolicy.statusCode, 200, 'document type mapping policy should save')
  assert.equal(typeMappingPolicy.payload.policy.documentTypeMappings[0].id, 'custom-safety-inspection')

  resetState()
  const customMappingContent = Buffer.from('安全巡检记录\n隐患：电箱未锁\n整改负责人：张三\n')
  const customMappingUpload = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: {
        original_filename: 'safety-inspection.txt',
        file_hash: sha256(customMappingContent)
      },
      filename: 'safety-inspection.txt',
      fileContent: customMappingContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(customMappingUpload.statusCode, 200, 'custom mapping text upload should succeed')
  assert.equal(state.classificationInserts.length, 1, 'custom mapping upload should create one classification')
  assert.equal(state.classificationInserts[0][2], 'equipment')
  assert.equal(state.classificationInserts[0][3], '安全巡检记录')
  assert.equal(state.classificationInserts[0][8].classifier, 'document_type_mapping_policy')
  assert.equal(state.classificationInserts[0][8].mapping_id, 'custom-safety-inspection')
  assert.equal(state.entryPlanInserts[0][12].document_type_mapping_source, 'policy_mapping')
  assert.equal(state.entryPlanInserts[0][12].document_type_mapping_id, 'custom-safety-inspection')
  assert.equal(state.entryPlanInserts[0][12].document_type_mapping_priority, 250)

  const clearTypeMappingPolicy = await callJson(
    handlers.handleUpdateAdminPolicies,
    { policy: { documentTypeMappings: [] } },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(clearTypeMappingPolicy.statusCode, 200, 'document type mappings should clear')
  assert.equal(clearTypeMappingPolicy.payload.policy.documentTypeMappings.length, 0)

  const unrecognizedContent = Buffer.from('会议纪要\n天气晴朗\n仅用于策略测试\n')
  const uploadUnrecognizedText = async (filename = 'meeting-notes.txt') => call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: {
        original_filename: filename,
        file_hash: sha256(unrecognizedContent)
      },
      filename,
      fileContent: unrecognizedContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )

  resetState()
  const defaultUnrecognizedUpload = await uploadUnrecognizedText()
  assert.equal(defaultUnrecognizedUpload.statusCode, 200, 'unrecognized text upload should still be archived')
  assert.equal(state.classificationInserts.length, 0, 'unrecognized text should not create a classification')
  assert.equal(state.entryPlanInserts.length, 0, 'unrecognized text should not create an entry plan')
  const defaultUnrecognizedAssetUpdate = state.assetStatusUpdates.at(-1)
  assert.equal(defaultUnrecognizedAssetUpdate.params[1], 'unrecognized')
  const defaultUnrecognizedAssetMetadata = JSON.parse(defaultUnrecognizedAssetUpdate.params[2])
  assert.equal(defaultUnrecognizedAssetMetadata.unrecognized_file_policy, 'archive_and_review')
  assert.equal(defaultUnrecognizedAssetMetadata.unrecognized_policy_action, 'archive_and_review')
  assert.equal(defaultUnrecognizedAssetMetadata.manual_review_required, true)
  const defaultUnrecognizedBatchUpdate = state.batchStatusUpdates.at(-1)
  assert.equal(defaultUnrecognizedBatchUpdate.params[1], 'completed')
  const defaultUnrecognizedBatchMetadata = JSON.parse(defaultUnrecognizedBatchUpdate.params[2])
  assert.equal(defaultUnrecognizedBatchMetadata.unrecognized_policy_action, 'archive_and_review')
  assert.equal(defaultUnrecognizedBatchMetadata.auto_import_ready, false)

  const archiveOnlyPolicy = await callJson(
    handlers.handleUpdateAdminPolicies,
    { policy: { unrecognizedFilePolicy: 'archive_only' } },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(archiveOnlyPolicy.statusCode, 200, 'unrecognized policy should switch to archive_only')
  assert.equal(archiveOnlyPolicy.payload.policy.unrecognizedFilePolicy, 'archive_only')
  resetState()
  const archiveOnlyUpload = await uploadUnrecognizedText('archive-only-notes.txt')
  assert.equal(archiveOnlyUpload.statusCode, 200)
  const archiveOnlyAssetUpdate = state.assetStatusUpdates.at(-1)
  assert.equal(archiveOnlyAssetUpdate.params[1], 'archived')
  const archiveOnlyMetadata = JSON.parse(archiveOnlyAssetUpdate.params[2])
  assert.equal(archiveOnlyMetadata.unrecognized_policy_action, 'archive_only')
  assert.equal(archiveOnlyMetadata.manual_review_required, false)

  const rejectPolicy = await callJson(
    handlers.handleUpdateAdminPolicies,
    { policy: { unrecognizedFilePolicy: 'reject' } },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(rejectPolicy.statusCode, 200, 'unrecognized policy should switch to reject')
  assert.equal(rejectPolicy.payload.policy.unrecognizedFilePolicy, 'reject')
  resetState()
  const rejectedUnrecognizedUpload = await uploadUnrecognizedText('reject-notes.txt')
  assert.equal(rejectedUnrecognizedUpload.statusCode, 200)
  const rejectedAssetUpdate = state.assetStatusUpdates.at(-1)
  assert.equal(rejectedAssetUpdate.params[1], 'failed')
  const rejectedMetadata = JSON.parse(rejectedAssetUpdate.params[2])
  assert.equal(rejectedMetadata.unrecognized_policy_action, 'reject')
  assert.equal(rejectedMetadata.unrecognized_policy_reason, 'unrecognized_file_rejected')
  const rejectedBatchUpdate = state.batchStatusUpdates.at(-1)
  assert.equal(rejectedBatchUpdate.params[1], 'failed')

  const restoreUnrecognizedPolicy = await callJson(
    handlers.handleUpdateAdminPolicies,
    { policy: { unrecognizedFilePolicy: 'archive_and_review' } },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(restoreUnrecognizedPolicy.statusCode, 200, 'unrecognized policy should restore to archive_and_review for later tests')

  resetState()
  const chunkSize = 256 * 1024
  const chunkedContent = Buffer.alloc(chunkSize * 2 + 17)
  for (let index = 0; index < chunkedContent.length; index += 1) {
    chunkedContent[index] = index % 251
  }
  const chunkedHash = sha256(chunkedContent)

  const badChunkHashInit = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      original_filename: 'chunked.pdf',
      file_hash: 'not-a-sha256',
      file_size: chunkedContent.length,
      chunk_size: chunkSize,
      total_chunks: 3
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(badChunkHashInit.statusCode, 400, 'chunk init should reject invalid file hashes')
  assert.equal(badChunkHashInit.payload.code, 'CHUNK_INIT_FIELDS_REQUIRED')
  assert.equal(state.connected, 0, 'invalid chunk init should fail before opening a DB transaction')

  const badChunkCountInit = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      original_filename: 'chunked.pdf',
      file_hash: chunkedHash,
      file_size: chunkedContent.length,
      chunk_size: chunkSize,
      total_chunks: 2
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(badChunkCountInit.statusCode, 400, 'chunk init should reject mismatched chunk counts')
  assert.equal(badChunkCountInit.payload.code, 'CHUNK_COUNT_MISMATCH')

  resetState()
  const initChunk = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      original_filename: 'chunked.pdf',
      file_hash: chunkedHash,
      file_size: chunkedContent.length,
      mime_type: 'application/pdf',
      upload_source: 'watch_folder',
      chunk_size: chunkSize,
      total_chunks: 3,
      metadata: {
        uploaded_by_username: 'operator',
        client_queue_id: 42
      }
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(initChunk.statusCode, 200, `chunk init should succeed: ${JSON.stringify(initChunk.payload)}`)
  assert.equal(initChunk.payload.duplicate, false)
  assert.equal(initChunk.payload.totalChunks, 3)
  assert.deepEqual(initChunk.payload.missingChunks, [0, 1, 2])

  const incompleteChunk = await call(
    handlers.handleCompleteChunkUpload,
    JSON.stringify({ session_id: initChunk.payload.sessionId }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(incompleteChunk.statusCode, 409, 'chunk complete should reject missing parts')
  assert.equal(incompleteChunk.payload.code, 'UPLOAD_CHUNKS_MISSING')
  assert.deepEqual(incompleteChunk.payload.missingChunks, [0, 1, 2])

  const uploadChunk = async (index, bytes) => call(
    handlers.handleUploadChunk,
    multipartBody(boundary, {
      metadata: {
        session_id: initChunk.payload.sessionId,
        chunk_index: index,
        chunk_hash: sha256(bytes)
      },
      filename: `chunk-${index}.part`,
      fileContent: bytes,
      fileField: 'chunk'
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )

  state.connected = 0
  const mismatchedChunkHash = await call(
    handlers.handleUploadChunk,
    multipartBody(boundary, {
      metadata: {
        session_id: initChunk.payload.sessionId,
        chunk_index: 0,
        chunk_hash: '0'.repeat(64)
      },
      filename: 'chunk-0.part',
      fileContent: chunkedContent.subarray(0, chunkSize),
      fileField: 'chunk'
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(mismatchedChunkHash.statusCode, 400, 'chunk upload should reject bad client hashes')
  assert.equal(mismatchedChunkHash.payload.code, 'CHUNK_HASH_MISMATCH')
  assert.equal(state.connected, 0, 'chunk hash mismatch should fail before opening an upload transaction')

  const chunk0 = await uploadChunk(0, chunkedContent.subarray(0, chunkSize))
  assert.equal(chunk0.statusCode, 200, `chunk 0 should upload: ${JSON.stringify(chunk0.payload)}`)
  assert.equal(chunk0.payload.duplicate, false)
  assert.equal(chunk0.payload.uploadedChunks, 1)
  const duplicateChunk0 = await uploadChunk(0, chunkedContent.subarray(0, chunkSize))
  assert.equal(duplicateChunk0.statusCode, 200, 'same chunk should be idempotent')
  assert.equal(duplicateChunk0.payload.duplicate, true)
  assert.equal(duplicateChunk0.payload.uploadedChunks, 1)
  const conflictingChunk0 = Buffer.from(chunkedContent.subarray(0, chunkSize))
  conflictingChunk0[0] = (conflictingChunk0[0] + 1) % 255
  const chunkConflict = await uploadChunk(0, conflictingChunk0)
  assert.equal(chunkConflict.statusCode, 409, 'different bytes for an uploaded chunk should conflict')
  assert.equal(chunkConflict.payload.code, 'CHUNK_CONFLICT')
  const wrongSizeChunk = await uploadChunk(1, chunkedContent.subarray(chunkSize, chunkSize * 2 - 1))
  assert.equal(wrongSizeChunk.statusCode, 400, 'non-final chunks must match configured chunk size')
  assert.equal(wrongSizeChunk.payload.code, 'CHUNK_SIZE_MISMATCH')
  const chunk1 = await uploadChunk(1, chunkedContent.subarray(chunkSize, chunkSize * 2))
  assert.equal(chunk1.statusCode, 200, `chunk 1 should upload: ${JSON.stringify(chunk1.payload)}`)
  const chunk2 = await uploadChunk(2, chunkedContent.subarray(chunkSize * 2))
  assert.equal(chunk2.statusCode, 200, `chunk 2 should upload: ${JSON.stringify(chunk2.payload)}`)

  const resumeInit = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      originalFilename: 'chunked.pdf',
      fileHash: chunkedHash,
      fileSize: chunkedContent.length,
      mimeType: 'application/pdf',
      uploadSource: 'watch_folder',
      chunkSize,
      totalChunks: 3
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.deepEqual(resumeInit.payload.uploadedChunks, [0, 1, 2], 'chunk init should report uploaded chunks for resume')
  assert.deepEqual(resumeInit.payload.missingChunks, [], 'chunk init should report no missing chunks after upload')

  const completeChunk = await call(
    handlers.handleCompleteChunkUpload,
    JSON.stringify({ session_id: initChunk.payload.sessionId }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(completeChunk.statusCode, 200, `chunk complete should succeed: ${JSON.stringify(completeChunk.payload)}`)
  assert.equal(completeChunk.payload.duplicate, false)
  assert.equal(completeChunk.payload.status, 'uploaded')
  assert.equal(state.assetInsertParams.at(-1)[6], 'chunked.pdf')
  assert.equal(state.assetInsertParams.at(-1)[10], chunkedContent.length)
  assert.equal(state.assetInsertParams.at(-1)[11], chunkedHash)
  assert.equal(state.parseJobInserts, 1, 'chunked complete should create one parse job')

  resetState()
  state.duplicateRows = [{ id: 'asset-original', storage_path: '/already/stored.txt' }]
  const duplicateUpload = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: { file_hash: sha256(fileContent) },
      fileContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(duplicateUpload.statusCode, 200, 'duplicate upload should still return success')
  assert.equal(duplicateUpload.payload.duplicate, true)
  assert.equal(duplicateUpload.payload.duplicatePolicy, 'skip_duplicate')
  assert.equal(state.parseJobInserts, 0, 'duplicate uploads should not create a parse job')

  const allowReimportPolicy = await callJson(
    handlers.handleUpdateAdminPolicies,
    { policy: { duplicateFilePolicy: 'allow_reimport' } },
    '/document-intake/admin/policies',
    'PATCH'
  )
  assert.equal(allowReimportPolicy.statusCode, 200, 'duplicate policy should switch to allow_reimport')
  assert.equal(allowReimportPolicy.payload.policy.duplicateFilePolicy, 'allow_reimport')

  resetState()
  state.duplicateRows = [{ id: 'asset-original', storage_path: '/already/stored.txt' }]
  const duplicateReimport = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: { file_hash: sha256(fileContent) },
      fileContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(duplicateReimport.statusCode, 200, 'allow_reimport duplicate upload should succeed')
  assert.equal(duplicateReimport.payload.duplicate, false)
  assert.equal(duplicateReimport.payload.duplicatePolicy, 'allow_reimport')
  assert.equal(duplicateReimport.payload.status, 'uploaded')
  assert.equal(state.assetInsertParams.at(-1)[14], 'uploaded')
  assert.equal(state.assetInsertParams.at(-1)[15], null)
  assert.equal(state.parseJobInserts, 1, 'allow_reimport duplicates should create a new parse job')
  const reimportMetadata = state.assetInsertParams.at(-1)[16]
  assert.equal(reimportMetadata.duplicate_file_policy, 'allow_reimport')
  assert.equal(reimportMetadata.duplicate_policy_action, 'allow_reimport')

  resetState()
  state.duplicateRows = [{ id: 'asset-original', storage_path: '/already/stored.txt' }]
  const allowReimportChunkInit = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      originalFilename: 'duplicate-chunked.pdf',
      fileHash: sha256(fileContent),
      fileSize: fileContent.length,
      mimeType: 'application/pdf',
      uploadSource: 'watch_folder',
      chunkSize: fileContent.length,
      totalChunks: 1
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(allowReimportChunkInit.statusCode, 200, 'allow_reimport chunk init should create a session instead of short-circuiting as duplicate')
  assert.equal(allowReimportChunkInit.payload.duplicate, false)
  assert.equal(allowReimportChunkInit.payload.duplicatePolicy, 'allow_reimport')
  assert.ok(allowReimportChunkInit.payload.sessionId, 'allow_reimport chunk init should return a session id')

  console.log('PASS: document intake regression')
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true })
}
