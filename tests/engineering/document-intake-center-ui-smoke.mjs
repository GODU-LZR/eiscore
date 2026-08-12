// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const appUrl = process.env.EISCORE_DOCUMENT_INTAKE_CENTER_URL || 'http://127.0.0.1:8083/apps/document-intake-center'
const appsBaseUrl = new URL('/apps/', appUrl).toString()
const playwrightLibDir = path.join(repoRoot, 'tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu')

if (fs.existsSync(playwrightLibDir)) {
  process.env.LD_LIBRARY_PATH = [playwrightLibDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isReachable(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1000)
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal })
    return response.ok || response.status === 404
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForReachable(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isReachable(url)) return
    await delay(500)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function ensureDevServer() {
  if (await isReachable(appsBaseUrl)) return null

  const child = spawn('npm', ['--prefix', 'eiscore-apps', 'run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: repoRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore'
  })
  child.unref()

  try {
    await waitForReachable(appsBaseUrl)
    return child
  } catch (error) {
    stopDevServer(child)
    throw error
  }
}

function stopDevServer(child) {
  if (!child?.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      // ignore cleanup errors
    }
  }
}

function jsonRoute(payload) {
  return (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload)
  })
}

let reviewRequestCount = 0
let assetDownloadRequestCount = 0
let assetPreviewRequestCount = 0
const assetRequestUrls = []
const deviceRequestUrls = []
const deviceUpdatePayloads = []
const businessSourceRequestUrls = []
const logRequestUrls = []
const recalculationTaskRequestUrls = []
const productionReportRequestUrls = []
const qualityInspectionRequestUrls = []
const policyUpdatePayloads = []
const sourceRetentionPayloads = []
const hrAttendanceSnapshotRequestUrls = []
const hrAttendanceSnapshotActionPayloads = []
const payrollPrecheckRequestUrls = []
const payrollPrecheckResultRequestUrls = []
const payrollReadyPrecheckRequestUrls = []
const payrollPrecheckTrialPayloads = []
const payrollPrecheckResultActionPayloads = []
const assetId = '22222222-2222-4222-8222-222222222222'
const businessLinkId = '77777777-7777-4777-8777-777777777777'

function requestHasParams(url, expectedParams) {
  const params = new URL(url).searchParams
  return Object.entries(expectedParams).every(([key, value]) => params.get(key) === value)
}

function requestLacksParams(url, keys) {
  const params = new URL(url).searchParams
  return keys.every((key) => !params.has(key))
}

async function installApiMocks(page) {
  const deviceId = '55555555-5555-4555-8555-555555555555'
  const policyOptions = {
    defaultAutoImportMode: ['auto_import', 'review_required', 'archive_only'],
    lowConfidencePolicy: ['auto_import_with_review', 'review_required', 'archive_only'],
    unrecognizedFilePolicy: ['archive_and_review', 'archive_only', 'reject'],
    duplicateFilePolicy: ['skip_duplicate', 'link_existing', 'allow_reimport'],
    unmappedFieldPolicy: ['remarks', 'properties', 'ignore'],
    businessCorrectionPolicy: ['record_and_recalculate', 'record_only', 'manual_review']
  }
  const currentPolicy = {
    enabled: true,
    defaultAutoImportMode: 'auto_import',
    lowConfidencePolicy: 'auto_import_with_review',
    unrecognizedFilePolicy: 'archive_and_review',
    duplicateFilePolicy: 'skip_duplicate',
    unmappedFieldPolicy: 'remarks',
    businessCorrectionPolicy: 'record_and_recalculate',
    logCollectionEnabled: true,
    confidenceThreshold: 0.7,
    logRetentionDays: 30,
    sourceFileRetentionDays: 180,
    documentTypeMappings: []
  }

  await page.route('**/agent/document-intake/admin/overview**', jsonRoute({
    metrics: {
      todayFileCount: 4,
      todayImportedCount: 3,
      classifiedCount: 1,
      archivedCount: 1,
      lowConfidenceCount: 1,
      unrecognizedCount: 0,
      duplicateCount: 0,
      failedCount: 0,
      activeDeviceCount: 2,
      offlineDeviceCount: 1,
      pendingRecalculationTaskCount: 2,
      failedRecalculationTaskCount: 0
    },
    statusBreakdown: [
      { status: 'imported', count: 3 },
      { status: 'classified', count: 1 },
      { status: 'archived', count: 1 },
      { status: 'uploaded', count: 1 }
    ],
    policies: currentPolicy,
    policyOptions
  }))

  await page.route('**/agent/document-intake/admin/policies**', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON()
      policyUpdatePayloads.push(body)
      Object.assign(currentPolicy, body.policy || body.policies || body || {})
    } else if (request.method() === 'POST' && request.url().includes('/reset')) {
      Object.assign(currentPolicy, {
        enabled: true,
        defaultAutoImportMode: 'auto_import',
        lowConfidencePolicy: 'auto_import_with_review',
        unrecognizedFilePolicy: 'archive_and_review',
        duplicateFilePolicy: 'skip_duplicate',
        unmappedFieldPolicy: 'remarks',
        businessCorrectionPolicy: 'record_and_recalculate',
        logCollectionEnabled: true,
        confidenceThreshold: 0.7,
        logRetentionDays: 30,
        sourceFileRetentionDays: 180,
        documentTypeMappings: []
      })
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        policy: currentPolicy,
        policies: currentPolicy,
        options: policyOptions,
        policyOptions,
        source: request.method() === 'GET' ? 'environment' : 'file'
      })
    })
  })

  await page.route('**/agent/document-intake/admin/source-file-retention/run**', async (route) => {
    const body = route.request().postDataJSON()
    sourceRetentionPayloads.push(body)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        dryRun: body.dryRun !== false,
        retentionDays: body.retentionDays || 180,
        scannedCount: 2,
        deletedCount: body.dryRun === false ? 1 : 0,
        missingCount: 1,
        skippedCount: 0,
        updatedCount: body.dryRun === false ? 2 : 0,
        items: []
      })
    })
  })

  await page.route('**/agent/document-intake/admin/assets**', async (route) => {
    assetRequestUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: assetId,
            originalFilename: 'purchase-order.pdf',
            batchNo: 'DIB-SMOKE-001',
            batchStatus: 'completed',
            mimeType: 'application/pdf',
            status: 'imported',
            reviewStatus: 'review_required',
            reviewReason: 'default_auto_import_mode_review_required',
            fileHash: 'hash-purchase-order',
            deviceCode: 'local-collector-01',
            deviceName: 'Local Collector 01',
            sourceFolder: 'C:\\EISCore\\Watch\\purchase',
            uploadSource: 'watch_folder',
            operatorSource: 'folder_binding_user',
            duplicate: false,
            duplicateOfAssetId: '',
            uploadedByUsername: 'operator',
            uploadedByRole: 'purchase',
            uploadedAt: '2026-06-19T02:00:00.000Z',
            targetDocumentType: 'purchase_order',
            targetModule: 'ams',
            generatedDocumentCount: 1,
            confidence: 0.96
          },
          {
            id: 'asset-copy-001',
            originalFilename: 'purchase-order-copy.pdf',
            batchNo: 'DIB-SMOKE-002',
            batchStatus: 'completed',
            mimeType: 'application/pdf',
            status: 'duplicate',
            reviewStatus: 'generated',
            fileHash: 'hash-purchase-order-copy',
            deviceCode: 'local-collector-01',
            deviceName: 'Local Collector 01',
            sourceFolder: 'C:\\EISCore\\Watch\\purchase',
            uploadSource: 'watch_folder',
            operatorSource: 'folder_binding_user',
            duplicate: true,
            duplicateOfAssetId: 'asset-original-001',
            duplicateOfOriginalFilename: 'purchase-order-original.pdf',
            duplicateOfFileHash: 'original-hash-purchase-order',
            duplicateOfUploadedAt: '2026-06-18T09:30:00.000Z',
            duplicateOfUploadSource: 'collector_desktop',
            uploadedByUsername: 'operator',
            uploadedByRole: 'purchase',
            uploadedAt: '2026-06-19T02:05:00.000Z',
            targetDocumentType: 'purchase_order',
            targetModule: 'ams',
            generatedDocumentCount: 0,
            confidence: 0.96
          }
        ],
        total: 2
      })
    })
  })

  await page.route('**/agent/document-intake/admin/business-sources**', async (route) => {
    const routeUrl = new URL(route.request().url())
    const duplicateBusinessSource = routeUrl.searchParams.get('duplicateBusinessSource') !== 'false'
    businessSourceRequestUrls.push(routeUrl.toString())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            businessLink: {
              id: businessLinkId,
              targetSchema: 'app_data',
              targetTable: 'ams_purchase_order',
              targetRecordId: 'PO-20260619-001',
              targetAppId: 'purchase-app',
              targetDocumentType: 'purchase_order',
              duplicateBusinessSource,
              aiConfidence: 0.96
            },
            asset: {
              id: assetId,
              originalFilename: 'purchase-order.pdf',
              fileHash: 'hash-purchase-order',
              deviceCode: 'local-collector-01',
              deviceName: 'Local Collector 01',
              sourceFolder: 'C:\\EISCore\\Watch\\purchase',
              status: 'imported',
              duplicate: false,
              uploadedByUsername: 'operator',
              uploadedByRole: 'purchase',
              uploadSource: 'watch_folder',
              operatorSource: 'folder_binding_user',
              batchNo: 'DIB-SMOKE-001',
              batchStatus: 'completed',
              uploadedAt: '2026-06-19T02:00:00.000Z'
            }
          }
        ],
        total: 1
      })
    })
  })

  await page.route('**/agent/document-intake/admin/recalculation-tasks**', async (route) => {
    recalculationTaskRequestUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'recalc-task-1',
            correctionId: 'correction-1',
            businessLinkId,
            targetSchema: 'app_data',
            targetTable: 'ams_purchase_order',
            targetRecordId: 'PO-20260619-001',
            targetModule: 'ams',
            targetDocumentType: 'purchase_order',
            taskType: 'business_result_recalculation',
            status: 'pending',
            priority: 50,
            attemptCount: 1,
            nextAttemptAt: '',
            lockedAt: '',
            lockedBy: '',
            requestedBy: 'warehouse-user',
            requestedAt: '2026-06-19T02:04:30.000Z',
            completedAt: '',
            lastError: '',
            assetId,
            sourceFilename: 'purchase-order.pdf',
            fileHash: 'hash-purchase-order',
            assetStatus: 'imported',
            uploadSource: 'watch_folder',
            operatorSource: 'folder_binding_user',
            uploadedByUserId: 'u_warehouse',
            uploadedByUsername: 'warehouse-uploader',
            uploadedByRole: 'warehouse',
            sourceFolder: 'C:\\EISCore\\Watch\\purchase',
            deviceCode: 'local-collector-01',
            deviceName: 'Local Collector 01',
            batchNo: 'DIB-SMOKE-001',
            batchStatus: 'completed',
            metadata: { field_name: 'quantity' }
          }
        ],
        total: 1
      })
    })
  })

  await page.route('**/agent/document-intake/admin/production-work-reports**', async (route) => {
    productionReportRequestUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unavailable: false,
        items: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            reportNo: 'PR-20260617-001',
            reportDate: '2026-06-17',
            workOrderNo: 'WO-20260617-001',
            productMaterialCode: 'FG-001',
            productMaterialName: '香辣虾仁预制菜',
            processName: '包装',
            workshopName: '一车间',
            productionLine: '预制菜一线',
            shiftName: '白班',
            teamName: 'A组',
            completedQty: 300,
            goodQty: 292,
            defectQty: 6,
            scrapQty: 2,
            unit: '盒',
            operator: '许计划',
            reportStatus: 'active',
            businessLinkId,
            duplicateBusinessSource: false,
            sourceFilename: 'production-daily.xlsx',
            fileHash: 'hash-production-daily',
            assetId,
            uploadSource: 'watch_folder',
            operatorSource: 'folder_binding_user',
            uploadedByUsername: 'prod-user',
            uploadedByRole: 'production',
            sourceFolder: 'C:\\EISCore\\Watch\\production',
            deviceCode: 'prod-pc-01',
            deviceName: 'Production PC 01',
            batchNo: 'DIB-PROD-001',
            batchStatus: 'completed'
          }
        ],
        total: 1
      })
    })
  })

  await page.route('**/agent/document-intake/admin/quality-inspections**', async (route) => {
    qualityInspectionRequestUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unavailable: false,
        items: [
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            docNo: 'QC-20260617-001',
            inspectionType: '来料检验',
            sourceDocNo: 'PO-20260617',
            itemCode: 'RM-001',
            itemName: '冷轧钢卷',
            sourceName: '南派供应链',
            batchNo: 'B20260617',
            sampleQty: 20,
            defectQty: 2,
            result: '不合格',
            inspector: '马质检',
            inspectionDate: '2026-06-17',
            status: 'active',
            businessLinkId,
            duplicateBusinessSource: true,
            sourceFilename: 'quality-inspection.xlsx',
            fileHash: 'hash-quality-inspection',
            assetId,
            uploadSource: 'watch_folder',
            operatorSource: 'folder_binding_user',
            uploadedByUsername: 'qc-user',
            uploadedByRole: 'quality',
            sourceFolder: 'C:\\EISCore\\Watch\\quality',
            deviceCode: 'qc-pc-01',
            deviceName: 'QC PC 01',
            importBatchNo: 'DIB-QC-001',
            batchStatus: 'completed'
          }
        ],
        total: 1
      })
    })
  })

  const hrAttendanceSnapshot = {
    id: '99999999-9999-4999-8999-999999999999',
    employeeMonthKey: 'E001:2026-06',
    employeeId: 'emp-1',
    employeeNo: 'E001',
    employeeName: '张生产',
    deptName: '生产部',
    month: '2026-06',
    recordCount: 22,
    leaveCount: 1,
    absentCount: 0,
    lateCount: 2,
    earlyCount: 0,
    overtimeMinutes: 150,
    firstAttDate: '2026-06-01',
    lastAttDate: '2026-06-30',
    sourceTargetSchema: 'hr',
    sourceTargetTable: 'document_intake_records',
    sourceTargetRecordId: 'HR-ATT-001',
    lastBusinessLinkId: businessLinkId,
    duplicateBusinessSource: false,
    sourceFilename: 'attendance-june.xlsx',
    fileHash: 'hash-attendance-june',
    uploadSource: 'watch_folder',
    operatorSource: 'folder_binding_user',
    uploadedByUsername: 'hr-operator',
    uploadedByRole: 'hr',
    sourceFolder: 'C:\\EISCore\\Watch\\hr',
    deviceCode: 'hr-pc-01',
    deviceName: 'HR PC 01',
    batchNo: 'DIB-HR-001',
    batchStatus: 'completed',
    taskStatus: 'completed',
    taskRequestedBy: 'hr-user',
    taskCompletedAt: '2026-06-19T02:10:00.000Z',
    confirmationStatus: 'pending_confirmation',
    confirmationNote: '',
    confirmedBy: '',
    confirmedAt: '',
    rejectedBy: '',
    rejectedAt: '',
    rejectionReason: '',
    payrollPrecheckStatus: 'not_requested',
    payrollPrecheckRequestedBy: '',
    payrollPrecheckRequestedAt: '',
    payrollPrecheckNote: '',
    recalculatedAt: '2026-06-19T02:10:00.000Z'
  }
  const payrollPrecheckResults = []

  await page.route('**/agent/document-intake/admin/hr-attendance-snapshots**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      hrAttendanceSnapshotActionPayloads.push(body)
      if (body.action === 'confirm') {
        hrAttendanceSnapshot.confirmationStatus = 'confirmed'
        hrAttendanceSnapshot.confirmationNote = body.note || ''
        hrAttendanceSnapshot.confirmedBy = 'admin'
        hrAttendanceSnapshot.confirmedAt = '2026-06-19T02:20:00.000Z'
      } else if (body.action === 'submit_payroll_precheck') {
        hrAttendanceSnapshot.payrollPrecheckStatus = 'ready'
        hrAttendanceSnapshot.payrollPrecheckRequestedBy = 'admin'
        hrAttendanceSnapshot.payrollPrecheckRequestedAt = '2026-06-19T02:22:00.000Z'
      } else if (body.action === 'reject') {
        hrAttendanceSnapshot.confirmationStatus = 'rejected'
        hrAttendanceSnapshot.rejectionReason = body.reason || ''
        hrAttendanceSnapshot.payrollPrecheckStatus = 'not_requested'
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action: body.action,
          snapshot: hrAttendanceSnapshot
        })
      })
      return
    }

    hrAttendanceSnapshotRequestUrls.push(request.url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unavailable: false,
        items: [hrAttendanceSnapshot],
        total: 1
      })
    })
  })

  await page.route('**/agent/document-intake/admin/hr-payroll-precheck-snapshots**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST' && request.url().includes('/trial')) {
      const body = request.postDataJSON()
      payrollPrecheckTrialPayloads.push(body)
      const result = {
        ...hrAttendanceSnapshot,
        id: '77777777-7777-4777-8777-777777777777',
        snapshotId: hrAttendanceSnapshot.id,
        trialStatus: 'draft',
        calculationVersion: 'attendance-precheck-v1',
        calculationBasis: {
          noPayrollMutation: true,
          payrollMutationAllowed: false,
          attendanceSummary: {
            recordCount: hrAttendanceSnapshot.recordCount,
            overtimeMinutes: hrAttendanceSnapshot.overtimeMinutes
          }
        },
        resultPayload: {
          status: 'draft',
          payrollMutationAllowed: false
        },
        generatedBy: 'admin',
        generatedAt: '2026-06-19T02:30:00.000Z',
        reviewNote: body.note || '',
        sourceSnapshotReference: {
          reference_table: 'hr.attendance_month_recalculation_snapshots',
          snapshot_id: hrAttendanceSnapshot.id,
          no_payroll_mutation: true
        },
        noPayrollMutation: true,
        payrollMutationAllowed: false
      }
      payrollPrecheckResults.splice(0, payrollPrecheckResults.length, result)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action: 'generate_trial',
          result
        })
      })
      return
    }

    payrollPrecheckRequestUrls.push(request.url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unavailable: false,
        items: [
          {
            ...hrAttendanceSnapshot,
            snapshotId: hrAttendanceSnapshot.id,
            confirmationStatus: 'confirmed',
            confirmedBy: hrAttendanceSnapshot.confirmedBy || 'admin',
            confirmedAt: hrAttendanceSnapshot.confirmedAt || '2026-06-19T02:20:00.000Z',
            payrollPrecheckStatus: 'ready',
            payrollPrecheckRequestedBy: hrAttendanceSnapshot.payrollPrecheckRequestedBy || 'admin',
            payrollPrecheckRequestedAt: hrAttendanceSnapshot.payrollPrecheckRequestedAt || '2026-06-19T02:22:00.000Z',
            precheckStatus: 'ready',
            readOnlyReference: true,
            payrollMutationAllowed: false,
            payrollReference: {
              reference_table: 'hr.attendance_month_recalculation_snapshots',
              snapshot_id: hrAttendanceSnapshot.id,
              employee_month_key: hrAttendanceSnapshot.employeeMonthKey,
              no_payroll_mutation: true
            }
          }
        ],
        total: 1
      })
    })
  })

  await page.route('**/agent/document-intake/admin/hr-payroll-precheck-results**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST' && request.url().includes('/action')) {
      const body = request.postDataJSON()
      payrollPrecheckResultActionPayloads.push(body)
      const result = payrollPrecheckResults[0]
      if (result) {
        result.trialStatus = body.action === 'reject' ? 'rejected' : 'approved'
        result.reviewedBy = 'admin'
        result.reviewedAt = '2026-06-19T02:40:00.000Z'
        result.reviewNote = body.note || ''
        result.resultPayload = {
          ...(result.resultPayload || {}),
          status: result.trialStatus,
          payrollMutationAllowed: false,
          noPayrollMutation: true
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action: result?.trialStatus || 'approved',
          result
        })
      })
      return
    }

    payrollPrecheckResultRequestUrls.push(request.url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unavailable: false,
        items: payrollPrecheckResults,
        total: payrollPrecheckResults.length
      })
    })
  })

  await page.route('**/agent/document-intake/admin/hr-payroll-ready-precheck-results**', async (route) => {
    payrollReadyPrecheckRequestUrls.push(route.request().url())
    const readyItems = payrollPrecheckResults
      .filter((item) => item.trialStatus === 'approved' && item.noPayrollMutation === true)
      .map((item) => ({
        ...item,
        readOnlyReference: true,
        payrollMutationAllowed: false,
        payrollReference: {
          reference_table: 'hr.payroll_precheck_results',
          result_id: item.id,
          snapshot_id: item.snapshotId,
          employee_month_key: item.employeeMonthKey,
          no_payroll_mutation: true
        }
      }))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unavailable: false,
        items: readyItems,
        total: readyItems.length
      })
    })
  })

  await page.route('**/agent/document-intake/admin/assets/*', jsonRoute({
    asset: {
      id: assetId,
      originalFilename: 'purchase-order.pdf',
      batchNo: 'DIB-SMOKE-001',
      batchStatus: 'completed',
      status: 'imported',
      reviewStatus: 'review_required',
      reviewReason: 'default_auto_import_mode_review_required',
      fileHash: 'hash-purchase-order',
      deviceCode: 'local-collector-01',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicate: true,
      duplicateOfAssetId: 'asset-original-001',
      duplicateOfOriginalFilename: 'purchase-order-original.pdf',
      duplicateOfFileHash: 'original-hash-purchase-order',
      duplicateOfUploadedAt: '2026-06-18T09:30:00.000Z',
      duplicateOfUploadSource: 'collector_desktop',
      uploadedByUsername: 'operator',
      uploadedByRole: 'purchase',
      targetDocumentType: 'purchase_order',
      confidence: 0.96,
      uploadedAt: '2026-06-19T02:00:00.000Z'
    },
    parseResults: [{ id: 'parse-1', textContent: 'Purchase order OCR text', confidence: 0.96 }],
    classifications: [{ id: 'class-1', targetDocumentType: 'purchase_order', reason: 'matched purchase fields', confidence: 0.96 }],
    entryPlans: [{
      id: 'plan-1',
      targetDocumentType: 'purchase_order',
      targetTable: 'ams_purchase_order',
      documentCount: 1,
      lineCount: 2,
      status: 'ready',
      metadata: {
        ai_unmapped_remarks: '【AI未匹配字段】\n供应商：南派\n来源文件：purchase-order.pdf',
        unmapped_field_policy: 'remarks'
      },
      documents: [{
        source: 'basic_text',
        source_asset_filename: 'purchase-order.pdf',
        field_mapping_status: 'basic_text_extracted',
        fields: { 供应商: '南派', 物料: 'A001' },
        line_items: [{ 物料: 'A001', 数量: '12' }],
        ai_unmapped_remarks: '【AI未匹配字段】\n供应商：南派\n来源文件：purchase-order.pdf'
      }]
    }],
    businessLinks: [{
      id: businessLinkId,
      targetModule: 'ams',
      targetDocumentType: 'purchase_order',
      targetTable: 'ams_purchase_order',
      targetRecordId: 'PO-20260619-001',
      targetAppId: 'purchase-app',
      aiConfidence: 0.96
    }],
    unmappedFields: [{ id: 'unmapped-1', name: '供应商', value: '南派', writeLocation: 'remarks', confidence: 0.78 }],
    corrections: [],
    recalculationTasks: [{
      id: 'recalc-task-1',
      targetTable: 'ams_purchase_order',
      targetRecordId: 'PO-20260619-001',
      taskType: 'business_result_recalculation',
      status: 'pending',
      priority: 50,
      requestedBy: 'warehouse-user',
      requestedAt: '2026-06-19T02:04:30.000Z',
      lastError: ''
    }],
    logs: [{
      id: 'asset-log-1',
      level: 'info',
      eventType: 'document_imported',
      message: 'Asset imported into business table',
      uploadedByUsername: 'operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      traceId: 'trace-asset-detail-1',
      requestUrl: 'https://nanpai.eissys.top/agent/document-intake/assets/upload',
      createdAt: '2026-06-19T02:04:00.000Z'
    }]
  }))

  await page.route('**/agent/document-intake/admin/assets/*/download', async (route) => {
    assetDownloadRequestCount += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: {
        'Content-Disposition': 'attachment; filename="purchase-order.pdf"'
      },
      body: 'original purchase order bytes'
    })
  })

  await page.route('**/agent/document-intake/admin/assets/*/preview', async (route) => {
    assetPreviewRequestCount += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        asset: {
          id: assetId,
          originalFilename: 'purchase-order.txt',
          mimeType: 'text/plain',
          fileSize: 48
        },
        preview: {
          text: '采购入库单\n供应商：南派\n物料,数量\nA001,12',
          truncated: false,
          maxBytes: 524288
        }
      })
    })
  })

  await page.route('**/agent/document-intake/admin/assets/*/review', async (route) => {
    reviewRequestCount += 1
    assert.equal(route.request().method(), 'POST')
    assert.equal(route.request().postDataJSON().action, 'approve_auto_import')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assetId,
        entryPlanId: 'plan-1',
        batchId: 'batch-smoke-1',
        status: 'planned',
        reviewStatus: 'reviewed',
        autoImportReady: true,
        nextStep: 'fixed_module_business_adapter'
      })
    })
  })

  await page.route('**/agent/document-intake/admin/devices**', async (route) => {
    deviceRequestUrls.push(route.request().url())
    return jsonRoute({
      items: [
        {
          id: deviceId,
          enterpriseId: 'local',
          deviceCode: 'local-collector-01',
          deviceName: 'Local Collector 01',
          status: 'active',
          onlineStatus: 'active',
          clientVersion: '0.2.0',
          webviewVersion: 'WebView2 126',
          defaultUserId: 'u_device',
          defaultUsername: 'operator',
          defaultRole: 'purchase',
          lastSeenAt: '2026-06-19T02:00:00.000Z',
          healthSummary: {
            uploadBacklogCount: 3,
            pendingLogCount: 2,
            missingWatchFolderCount: 1,
            inaccessibleWatchFolderCount: 0
          },
          watchFolderCount: 1,
          todayFileCount: 4,
          logCount: 1
        }
      ],
      total: 1
    })(route)
  })

  await page.route('**/agent/document-intake/admin/devices/*', async (route) => {
    const request = route.request()
    const device = {
      id: deviceId,
      enterpriseId: 'local',
      deviceCode: 'local-collector-01',
      deviceName: 'Local Collector 01',
      status: 'active',
      onlineStatus: 'active',
      clientVersion: '0.2.0',
      webviewVersion: 'WebView2 126',
      defaultUserId: 'u_device',
      defaultUsername: 'operator',
      defaultRole: 'purchase',
      lastSeenAt: '2026-06-19T02:00:00.000Z',
      healthSummary: {
        uploadBacklogCount: 3,
        pendingLogCount: 2,
        missingWatchFolderCount: 1,
        inaccessibleWatchFolderCount: 0
      },
      metadata: {
        remote_config_version: 'cfg-smoke-1',
        remote_config: {
          logs: { retention_days: 14 },
          upload: { max_retry_count: 3 }
        },
        heartbeat_payload: {
          health: {
            generatedAt: '2026-06-19T02:00:00.000Z',
            deviceStatus: 'active',
            pendingUploadCount: 3,
            oldestPendingUploadCreatedAt: '2026-06-19T01:20:00.000Z',
            failedUploadCount: 1,
            failedRetryExhaustedCount: 1,
            nextFailedRetryAt: '2026-06-19T02:30:00.000Z',
            failedUploadErrorSummaries: [
              {
                error: 'Network timeout',
                count: 2,
                oldestCreatedAt: '2026-06-19T01:22:00.000Z',
                latestCreatedAt: '2026-06-19T01:42:00.000Z'
              }
            ],
            pendingLogCount: 2,
            oldestPendingLogCreatedAt: '2026-06-19T01:10:00.000Z',
            watchFolderCount: 1,
            enabledWatchFolderCount: 1,
            missingWatchFolderCount: 1,
            inaccessibleWatchFolderCount: 0,
            watchFolderStatuses: [
              {
                folderPath: 'C:\\EISCore\\Watch\\purchase',
                folderName: 'Purchase documents',
                defaultUserId: 'u_1',
                defaultUsername: 'folder-operator',
                defaultRole: 'purchase',
                enabled: true,
                status: 'missing',
                reason: 'directory_not_found'
              }
            ],
            collectorDatabaseBytes: 1048576,
            dataDriveAvailableFreeBytes: 5368709120
          }
        }
      },
      watchFolders: [
        { folderPath: 'C:\\EISCore\\Watch\\purchase', folderName: 'Purchase documents', defaultUserId: 'u_1', defaultUsername: 'folder-operator', defaultRole: 'purchase', enabled: true }
      ]
    }
    if (request.method() === 'PATCH') {
      deviceUpdatePayloads.push(JSON.parse(request.postData() || '{}'))
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ device })
    })
  })

  await page.route('**/agent/document-intake/admin/logs**', async (route) => {
    logRequestUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'log-1',
            eventType: 'file_upload_failed',
            level: 'error',
            module: 'collector',
            route: '/upload',
            url: 'https://nanpai.eissys.top/apps/document-intake',
            requestUrl: 'https://nanpai.eissys.top/agent/document-intake/assets/upload',
            statusCode: 500,
            message: 'Upload failed',
            stack: 'UploadQueueProcessor.ProcessOnceAsync failed',
            deviceCode: 'local-collector-01',
            username: 'operator',
            role: 'warehouse',
            uploadedByUserId: 'uploader-1',
            uploadedByUsername: 'warehouse-user',
            uploadedByRole: 'warehouse',
            uploadSource: 'manual_drag_drop',
            operatorSource: 'folder_binding_user',
            sourceFolder: 'D:\\EISCore\\Warehouse',
            aiImportBatchNo: 'DIB-SMOKE-001',
            sourceFileHash: 'hash-purchase-order',
            sourceAssetId: assetId,
            sourceAssetCount: 1,
            assetStatus: 'failed',
            duplicate: true,
            clientSessionId: 'session-smoke-1',
            traceId: 'trace-smoke-1',
            appModule: 'collector',
            appVersion: '0.2.0',
            webviewVersion: 'WebView2 126',
            metadata: { retryable: true, reason: 'network' },
            createdAt: '2026-06-19T02:05:00.000Z'
          }
        ],
        total: 1
      })
    })
  })
}

const devServer = await ensureDevServer()
let browser

try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(15000)
  page.setDefaultNavigationTimeout(30000)
  await page.addInitScript(() => {
    const payload = {
      sub: 'admin',
      role: 'admin',
      permissions: ['document_intake.view', 'document_intake.manage'],
      exp: Math.floor(Date.now() / 1000) + 3600
    }
    const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    localStorage.setItem('auth_token', `header.${encoded}.signature`)
    localStorage.setItem('user_info', JSON.stringify({ id: 'admin', username: 'admin', role: 'admin' }))
  })
  await installApiMocks(page)

  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('.document-intake-center').waitFor({ state: 'visible', timeout: 15000 })
  await expectText(page, '自动正式入库')
  await expectText(page, '入库后复核')
  await expectText(page, '写备注')
  await expectText(page, '已分类')
  await expectText(page, '已归档')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/policies') &&
      response.request().method() === 'GET' &&
      response.status() === 200
    ),
    page.getByRole('button', { name: '配置策略' }).click()
  ])
  const policyDialog = page.locator('.el-dialog').filter({ hasText: '智能收单策略' })
  await policyDialog.getByText('记录并重算').waitFor({ state: 'visible', timeout: 10000 })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/source-file-retention/run') &&
      response.request().method() === 'POST' &&
      response.status() === 200
    ),
    policyDialog.getByRole('button', { name: '预检源文件' }).click()
  ])
  assert.equal(sourceRetentionPayloads.at(-1)?.dryRun, true, 'source retention preview should use dry-run mode')
  assert.equal(sourceRetentionPayloads.at(-1)?.retentionDays, 180, 'source retention preview should use the policy form retention days')
  await policyDialog.getByText('预检 2 个，删除 0 个，缺失 1 个，跳过 0 个').waitFor({ state: 'visible', timeout: 10000 })
  await policyDialog.getByRole('button', { name: '新增映射' }).click()
  await policyDialog.getByPlaceholder('mapping_name').fill('安全巡检')
  await policyDialog.getByPlaceholder('target_module').fill('equipment')
  await policyDialog.getByPlaceholder('target_document_type').fill('安全巡检记录')
  await policyDialog.getByPlaceholder('match_keywords').fill('安全巡检、隐患')
  await policyDialog.locator('.mapping-editor .el-input-number input').fill('250')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/policies') &&
      response.request().method() === 'PATCH' &&
      response.status() === 200
    ),
    policyDialog.getByRole('button', { name: '保存' }).click()
  ])
  assert.equal(policyUpdatePayloads.at(-1)?.policy?.defaultAutoImportMode, 'auto_import', 'policy dialog should submit the current auto-import mode')
  assert.equal(policyUpdatePayloads.at(-1)?.policy?.businessCorrectionPolicy, 'record_and_recalculate', 'policy dialog should submit the correction policy')
  assert.equal(policyUpdatePayloads.at(-1)?.policy?.documentTypeMappings?.[0]?.targetModule, 'equipment', 'policy dialog should submit document type mappings')
  assert.deepEqual(policyUpdatePayloads.at(-1)?.policy?.documentTypeMappings?.[0]?.keywords, ['安全巡检', '隐患'], 'policy dialog should split document type mapping keywords')
  assert.equal(policyUpdatePayloads.at(-1)?.policy?.documentTypeMappings?.[0]?.priority, 250, 'policy dialog should submit document type mapping priority')
  await policyDialog.waitFor({ state: 'hidden', timeout: 10000 })
  await expectText(page, '待重算')
  await expectText(page, 'purchase-order.pdf')
  await expectText(page, 'purchase / 目录默认用户')
  await expectText(page, '待复核')
  await expectText(page, 'DIB-SMOKE-001')
  await expectText(page, '已完成')
  const assetPanel = page.locator('.stage-panel').nth(0)
  await assetPanel.getByText('监听目录').first().waitFor({ state: 'visible', timeout: 10000 })
  await assetPanel.getByText('目录默认用户').first().waitFor({ state: 'visible', timeout: 10000 })
  await assetPanel.getByText('非重复').first().waitFor({ state: 'visible', timeout: 10000 })
  await assetPanel.getByText('purchase-order-original.pdf（asset-original-001）').first().waitFor({ state: 'visible', timeout: 10000 })
  await assetPanel.getByText(/Hash original-has/).first().waitFor({ state: 'visible', timeout: 10000 })
  await assetPanel.getByPlaceholder('上传人').fill('operator')
  await assetPanel.getByPlaceholder('岗位 / 角色').fill('purchase')
  await assetPanel.getByPlaceholder('目标模块').fill('purchase')
  await assetPanel.getByPlaceholder('目标单据类型').fill('采购入库单')
  await assetPanel.getByPlaceholder('来源目录').fill('C:\\EISCore\\Watch\\purchase')
  await assetPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '非重复', exact: true }).click()
  await assetPanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '窗口拖拽', exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('option', { name: '手动选择', exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await assetPanel.locator('.filter-strip .el-select').nth(3).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await assetPanel.getByPlaceholder('文件 hash').fill('hash-purchase-order')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        duplicate: 'false',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        targetModule: 'purchase',
        targetDocumentType: '采购入库单',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        fileHash: 'hash-purchase-order'
      }) &&
      response.status() === 200
    ),
    assetPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    assetRequestUrls.some((url) => requestHasParams(url, {
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      duplicate: 'false',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      targetModule: 'purchase',
      targetDocumentType: '采购入库单',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      fileHash: 'hash-purchase-order'
    })),
    'asset query should include upload user, target business, duplicate, source, owner source, source folder, and file hash filters'
  )
  await assetPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '重复', exact: true }).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        duplicate: 'true',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        targetModule: 'purchase',
        targetDocumentType: '采购入库单',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        fileHash: 'hash-purchase-order'
      }) &&
      response.status() === 200
    ),
    assetPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    assetRequestUrls.some((url) => requestHasParams(url, {
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      duplicate: 'true',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      targetModule: 'purchase',
      targetDocumentType: '采购入库单',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      fileHash: 'hash-purchase-order'
    })),
    'asset query should independently support duplicate=true filtering'
  )
  await assetPanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '已归档', exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('option', { name: '已分类', exact: true }).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        status: 'classified',
        duplicate: 'true',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        targetModule: 'purchase',
        targetDocumentType: '采购入库单',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        fileHash: 'hash-purchase-order'
      }) &&
      response.status() === 200
    ),
    assetPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    assetRequestUrls.some((url) => requestHasParams(url, {
      status: 'classified',
      duplicate: 'true',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      targetModule: 'purchase',
      targetDocumentType: '采购入库单',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      fileHash: 'hash-purchase-order'
    })),
    'asset status filter should expose classified and archived states from the intake status model'
  )
  await assetPanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '手动选择', exact: true }).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        duplicate: 'true',
        uploadSource: 'manual_selected_file',
        operatorSource: 'folder_binding_user',
        targetModule: 'purchase',
        targetDocumentType: '采购入库单',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        fileHash: 'hash-purchase-order'
      }) &&
      response.status() === 200
    ),
    assetPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    assetRequestUrls.some((url) => requestHasParams(url, {
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      duplicate: 'true',
      uploadSource: 'manual_selected_file',
      operatorSource: 'folder_binding_user',
      targetModule: 'purchase',
      targetDocumentType: '采购入库单',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      fileHash: 'hash-purchase-order'
    })),
    'asset query should support native file-picker upload source filtering'
  )
  const resetAssetRequestStart = assetRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), [
        'status',
        'duplicate',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'targetModule',
        'targetDocumentType',
        'sourceFolder',
        'fileHash'
      ]) &&
      response.status() === 200
    ),
    assetPanel.getByRole('button', { name: '重置' }).click()
  ])
  assert.ok(
    assetRequestUrls.slice(resetAssetRequestStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, [
        'status',
        'duplicate',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'targetModule',
        'targetDocumentType',
        'sourceFolder',
        'fileHash'
      ])
    ),
    'asset reset should clear file list filters and reload the first page'
  )
  await page.getByRole('button', { name: '详情' }).first().click()
  await expectText(page, '重复来源')
  await expectText(page, 'purchase-order-original.pdf')
  await expectText(page, '桌面端')
  await expectText(page, 'AI补充备注')
  await expectText(page, '供应商：南派')
  await page.getByRole('tab', { name: '入库计划' }).click()
  await page.locator('.el-drawer').locator('.el-table__expand-icon').first().click()
  await expectText(page, '字段映射')
  await expectText(page, 'basic_text_extracted')
  await expectText(page, 'A001')
  await page.getByRole('tab', { name: '业务链接' }).click()
  const businessRecordLink = page.getByRole('link', { name: '打开' }).first()
  await businessRecordLink.waitFor({ state: 'visible', timeout: 10000 })
  assert.match(
    await businessRecordLink.getAttribute('href'),
    /\/apps\/app\/purchase-app\/record\/PO-20260619-001$/,
    'business link should expose a deep link to the generated app record'
  )
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets/') &&
      response.url().endsWith('/download') &&
      response.status() === 200
    ),
    page.getByRole('button', { name: '下载原始文件' }).click()
  ])
  assert.equal(assetDownloadRequestCount, 1, 'asset detail should download the original source file')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets/') &&
      response.url().endsWith('/preview') &&
      response.status() === 200
    ),
    page.getByRole('button', { name: '预览原始文件' }).click()
  ])
  assert.equal(assetPreviewRequestCount, 1, 'asset detail should preview the original source file')
  await page.getByText('采购入库单').last().waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.el-dialog').filter({ hasText: '原始文件预览' }).getByRole('button', { name: '关闭' }).click()
  await page.getByRole('tab', { name: '重算任务' }).click()
  await expectText(page, '待重算')
  await page.waitForFunction(
    () => document.querySelector('.el-drawer')?.innerText.includes('warehouse-user'),
    null,
    { timeout: 10000 }
  )
  await page.waitForFunction(
    () => document.querySelector('.el-drawer')?.innerText.includes('purchase / 目录默认用户'),
    null,
    { timeout: 10000 }
  )
  await page.getByRole('tab', { name: '入库日志' }).click()
  await expectText(page, 'document_imported')
  await expectText(page, 'operator')
  await expectText(page, 'purchase / 目录默认用户')
  await expectText(page, 'C:\\EISCore\\Watch\\purchase')
  await expectText(page, 'trace-asset-detail-1')
  await expectText(page, 'Asset imported into business table')
  await page.getByRole('button', { name: '复核通过并入库' }).click()
  await page.locator('.el-message-box').waitFor({ state: 'visible', timeout: 10000 })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets/') &&
      response.url().endsWith('/review') &&
      response.status() === 200
    ),
    page.locator('.el-message-box__btns .el-button--primary').click()
  ])
  assert.equal(reviewRequestCount, 1, 'review approve should call the review endpoint once')
  await page.getByRole('tab', { name: '业务链接' }).click()
  const businessTraceStart = businessSourceRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        businessLinkId
      }) &&
      response.status() === 200
    ),
    page.locator('.el-drawer').getByRole('button', { name: '追溯' }).click()
  ])
  assert.ok(
    businessSourceRequestUrls.slice(businessTraceStart).some((url) => requestHasParams(url, {
      businessLinkId
    })),
    'asset business link trace action should jump to source lookup by business link id'
  )
  await page.locator('.el-drawer').waitFor({ state: 'hidden', timeout: 10000 })
  await page.getByRole('heading', { name: '来源追溯' }).waitFor({ state: 'visible', timeout: 10000 })

  await page.locator('.nav-item').filter({ hasText: '来源追溯' }).click()
  const sourcePanel = page.locator('.stage-panel').filter({ hasText: '来源追溯' })
  await sourcePanel.getByPlaceholder('业务链接 ID').fill('')
  await sourcePanel.getByPlaceholder('应用 ID').fill('purchase-app')
  await sourcePanel.getByPlaceholder('业务记录 ID').fill('PO-20260619-001')
  await sourcePanel.getByPlaceholder('上传人').fill('operator')
  await sourcePanel.getByPlaceholder('岗位 / 角色').fill('purchase')
  await sourcePanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await sourcePanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await sourcePanel.getByPlaceholder('来源目录').fill('C:\\EISCore\\Watch\\purchase')
  await sourcePanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '重复业务来源', exact: true }).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        targetAppId: 'purchase-app',
        targetRecordId: 'PO-20260619-001',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        duplicateBusinessSource: 'true'
      }) &&
      response.status() === 200
    ),
    sourcePanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    businessSourceRequestUrls.some((url) => requestHasParams(url, {
      targetAppId: 'purchase-app',
      targetRecordId: 'PO-20260619-001',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      duplicateBusinessSource: 'true'
    })),
    'business source query should include app id, record id, upload ownership and source folder filters'
  )
  await sourcePanel.getByText('purchase-order.pdf').first().waitFor({ state: 'visible', timeout: 10000 })
  await sourcePanel.getByText('重复业务来源').first().waitFor({ state: 'visible', timeout: 10000 })
  await sourcePanel.getByText('purchase / 目录默认用户').first().waitFor({ state: 'visible', timeout: 10000 })
  await sourcePanel.getByText('hash-purchase-order').first().waitFor({ state: 'visible', timeout: 10000 })
  await sourcePanel.getByText('Local Collector 01').first().waitFor({ state: 'visible', timeout: 10000 })
  await sourcePanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '正式业务来源', exact: true }).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        targetAppId: 'purchase-app',
        targetRecordId: 'PO-20260619-001',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        duplicateBusinessSource: 'false'
      }) &&
      response.status() === 200
    ),
    sourcePanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    businessSourceRequestUrls.some((url) => requestHasParams(url, {
      targetAppId: 'purchase-app',
      targetRecordId: 'PO-20260619-001',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      duplicateBusinessSource: 'false'
    })),
    'business source query should independently support formal non-duplicate source filtering'
  )
  await sourcePanel.getByText('正式业务来源').first().waitFor({ state: 'visible', timeout: 10000 })
  const sourceAssetStart = assetRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        fileHash: 'hash-purchase-order',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        status: 'imported',
        duplicate: 'false'
      }) &&
      response.status() === 200
    ),
    sourcePanel.getByRole('button', { name: '文件' }).click()
  ])
  assert.ok(
    assetRequestUrls.slice(sourceAssetStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      fileHash: 'hash-purchase-order',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      status: 'imported',
      duplicate: 'false'
    })),
    'business source file action should jump to asset list with source asset status, duplicate and provenance filters'
  )
  await page.getByRole('heading', { name: '文件列表' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.nav-item').filter({ hasText: '来源追溯' }).click()
  await sourcePanel.getByText('purchase-order.pdf').first().waitFor({ state: 'visible', timeout: 10000 })
  const sourceLogStart = logRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        fileHash: 'hash-purchase-order',
        batchNo: 'DIB-SMOKE-001',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase'
      }) &&
      response.status() === 200
    ),
    sourcePanel.getByRole('button', { name: '日志' }).click()
  ])
  assert.ok(
    logRequestUrls.slice(sourceLogStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      fileHash: 'hash-purchase-order',
      batchNo: 'DIB-SMOKE-001',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase'
    })),
    'business source log action should jump to logs with source asset filters'
  )
  await page.locator('.nav-item').filter({ hasText: '来源追溯' }).click()
  await sourcePanel.getByText('purchase-order.pdf').first().waitFor({ state: 'visible', timeout: 10000 })
  const resetBusinessSourceRequestCount = businessSourceRequestUrls.length
  await sourcePanel.getByRole('button', { name: '重置', exact: true }).click()
  await sourcePanel.getByText('请输入业务记录条件后查询来源文件').waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForFunction(
    () => {
      const panel = [...document.querySelectorAll('.stage-panel')]
        .find((item) => item.innerText.includes('来源追溯'))
      if (!panel) return false
      const values = [...panel.querySelectorAll('input')].map((input) => input.value)
      return values.every((value) => value === '')
    },
    null,
    { timeout: 10000 }
  )
  assert.equal(
    businessSourceRequestUrls.length,
    resetBusinessSourceRequestCount,
    'business source reset should clear filters and results without issuing an empty lookup'
  )

  await page.locator('.nav-item').filter({ hasText: '重算任务' }).click()
  const recalculationPanel = page.locator('.stage-panel').filter({ has: page.locator('h3', { hasText: '重算任务' }) })
  await recalculationPanel.getByText('purchase-order.pdf').first().waitFor({ state: 'visible', timeout: 10000 })
  await recalculationPanel.getByText('PO-20260619-001').first().waitFor({ state: 'visible', timeout: 10000 })
  await recalculationPanel.getByText('warehouse-user').first().waitFor({ state: 'visible', timeout: 10000 })
  await recalculationPanel.getByText('warehouse-uploader').first().waitFor({ state: 'visible', timeout: 10000 })
  await recalculationPanel.getByText('warehouse / 目录默认用户').first().waitFor({ state: 'visible', timeout: 10000 })
  await recalculationPanel.getByText('C:\\EISCore\\Watch\\purchase / hash-purchase-order').first().waitFor({ state: 'visible', timeout: 10000 })
  await recalculationPanel.getByPlaceholder('业务记录 ID').fill('PO-20260619-001')
  await recalculationPanel.getByPlaceholder('请求人').fill('warehouse-user')
  await recalculationPanel.getByPlaceholder('上传人').fill('warehouse-uploader')
  await recalculationPanel.getByPlaceholder('岗位 / 角色').fill('warehouse')
  await recalculationPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await recalculationPanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await recalculationPanel.getByPlaceholder('来源目录').fill('C:\\EISCore\\Watch\\purchase')
  await recalculationPanel.getByPlaceholder('文件名 / hash / 错误').fill('purchase-order')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/recalculation-tasks') &&
      requestHasParams(response.url(), {
        status: 'pending',
        targetRecordId: 'PO-20260619-001',
        requestedBy: 'warehouse-user',
        uploadedBy: 'warehouse-uploader',
        uploadedByRole: 'warehouse',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        search: 'purchase-order'
      }) &&
      response.status() === 200
    ),
    recalculationPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    recalculationTaskRequestUrls.some((url) => requestHasParams(url, {
      status: 'pending',
      targetRecordId: 'PO-20260619-001',
      requestedBy: 'warehouse-user',
      uploadedBy: 'warehouse-uploader',
      uploadedByRole: 'warehouse',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      search: 'purchase-order'
    })),
    'recalculation task query should include status, target record, requester, upload ownership and search filters'
  )

  await page.locator('.nav-item').filter({ hasText: '生产报工' }).click()
  const productionReportPanel = page.locator('.stage-panel').filter({
    has: page.getByRole('heading', { name: '生产报工' })
  })
  await productionReportPanel.getByText('PR-20260617-001').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('WO-20260617-001').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('香辣虾仁预制菜').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('production-daily.xlsx').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('C:\\EISCore\\Watch\\production / hash-production-daily').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('正式业务来源').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('prod-user').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('production / 目录默认用户').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('监听目录 / completed').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByText('300盒').first().waitFor({ state: 'visible', timeout: 10000 })
  await productionReportPanel.getByPlaceholder('开始日期').fill('2026-06-01')
  await productionReportPanel.getByPlaceholder('结束日期').fill('2026-06-30')
  await productionReportPanel.getByPlaceholder('报工单号').fill('PR-20260617-001')
  await productionReportPanel.getByRole('textbox', { name: '工单号', exact: true }).fill('WO-20260617-001')
  await productionReportPanel.getByPlaceholder('产品编码').fill('FG-001')
  await productionReportPanel.getByPlaceholder('上传人').fill('prod-user')
  await productionReportPanel.getByPlaceholder('岗位 / 角色').fill('production')
  await productionReportPanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await productionReportPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await productionReportPanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '正式业务来源', exact: true }).last().click()
  await productionReportPanel.getByPlaceholder('来源目录').fill('D:\\EISCore\\Production')
  await productionReportPanel.getByPlaceholder('工序 / 车间 / 文件 / hash').fill('生产日报')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/production-work-reports') &&
      requestHasParams(response.url(), {
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        reportNo: 'PR-20260617-001',
        workOrderNo: 'WO-20260617-001',
        productMaterialCode: 'FG-001',
        uploadedBy: 'prod-user',
        uploadedByRole: 'production',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        duplicateBusinessSource: 'false',
        sourceFolder: 'D:\\EISCore\\Production',
        search: '生产日报'
      }) &&
      response.status() === 200
    ),
    productionReportPanel.getByRole('button', { name: '查询' }).click()
  ])
	  assert.ok(
	    productionReportRequestUrls.some((url) => requestHasParams(url, {
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      reportNo: 'PR-20260617-001',
      workOrderNo: 'WO-20260617-001',
      productMaterialCode: 'FG-001',
      uploadedBy: 'prod-user',
      uploadedByRole: 'production',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicateBusinessSource: 'false',
      sourceFolder: 'D:\\EISCore\\Production',
      search: '生产日报'
    })),
    'production report query should include date, report, work order, material, upload ownership, business duplicate, source folder and search filters'
  )
  const resetProductionReportStart = productionReportRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/production-work-reports') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), [
        'dateFrom',
        'dateTo',
        'reportNo',
        'workOrderNo',
        'productMaterialCode',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ]) &&
      response.status() === 200
    ),
    productionReportPanel.getByRole('button', { name: '重置', exact: true }).click()
  ])
  assert.ok(
    productionReportRequestUrls.slice(resetProductionReportStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, [
        'dateFrom',
        'dateTo',
        'reportNo',
        'workOrderNo',
        'productMaterialCode',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ])
    ),
    'production report reset should clear filters and reload the first page'
  )

  const productionSourceStart = businessSourceRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        businessLinkId,
        targetSchema: 'scm',
        targetTable: 'production_work_reports',
        targetRecordId: 'PR-20260617-001',
        uploadedBy: 'prod-user',
        uploadedByRole: 'production',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\production',
        duplicateBusinessSource: 'false'
      }) &&
      response.status() === 200
    ),
    productionReportPanel.getByRole('button', { name: '来源' }).first().click()
  ])
  assert.ok(
    businessSourceRequestUrls.slice(productionSourceStart).some((url) => requestHasParams(url, {
      businessLinkId,
      targetSchema: 'scm',
      targetTable: 'production_work_reports',
      targetRecordId: 'PR-20260617-001',
      uploadedBy: 'prod-user',
      uploadedByRole: 'production',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\production',
      duplicateBusinessSource: 'false'
    })),
    'production report source action should jump to source lookup with business link and upload ownership filters'
  )

  await page.locator('.nav-item').filter({ hasText: '质检记录' }).click()
  const qualityInspectionPanel = page.locator('.stage-panel').filter({
    has: page.getByRole('heading', { name: '质检记录' })
  })
  await qualityInspectionPanel.getByText('QC-20260617-001').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('冷轧钢卷').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('PO-20260617').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('不合格').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('quality-inspection.xlsx').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('C:\\EISCore\\Watch\\quality / hash-quality-inspection').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('重复业务来源').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('qc-user').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('quality / 目录默认用户').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('监听目录 / completed').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByText('10%').first().waitFor({ state: 'visible', timeout: 10000 })
  await qualityInspectionPanel.getByPlaceholder('开始日期').fill('2026-06-01')
  await qualityInspectionPanel.getByPlaceholder('结束日期').fill('2026-06-30')
  await qualityInspectionPanel.getByPlaceholder('检验单号').fill('QC-20260617-001')
  await qualityInspectionPanel.getByPlaceholder('来源单号').fill('PO-20260617')
  await qualityInspectionPanel.getByPlaceholder('检验类型').fill('来料检验')
  await qualityInspectionPanel.getByPlaceholder('物料编码').fill('RM-001')
  await qualityInspectionPanel.getByPlaceholder('判定').fill('不合格')
  await qualityInspectionPanel.getByPlaceholder('检验员').fill('马质检')
  await qualityInspectionPanel.getByPlaceholder('上传人').fill('qc-user')
  await qualityInspectionPanel.getByPlaceholder('岗位 / 角色').fill('quality')
  await qualityInspectionPanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await qualityInspectionPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await qualityInspectionPanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '重复业务来源', exact: true }).last().click()
  await qualityInspectionPanel.getByPlaceholder('来源目录').fill('C:\\EISCore\\Watch\\quality')
  await qualityInspectionPanel.getByPlaceholder('物料 / 批次 / 文件 / hash').fill('质检记录')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/quality-inspections') &&
      requestHasParams(response.url(), {
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        docNo: 'QC-20260617-001',
        sourceDocNo: 'PO-20260617',
        inspectionType: '来料检验',
        itemCode: 'RM-001',
        result: '不合格',
        inspector: '马质检',
        uploadedBy: 'qc-user',
        uploadedByRole: 'quality',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        duplicateBusinessSource: 'true',
        sourceFolder: 'C:\\EISCore\\Watch\\quality',
        search: '质检记录'
      }) &&
      response.status() === 200
    ),
    qualityInspectionPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    qualityInspectionRequestUrls.some((url) => requestHasParams(url, {
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      docNo: 'QC-20260617-001',
      sourceDocNo: 'PO-20260617',
      inspectionType: '来料检验',
      itemCode: 'RM-001',
      result: '不合格',
      inspector: '马质检',
      uploadedBy: 'qc-user',
      uploadedByRole: 'quality',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicateBusinessSource: 'true',
      sourceFolder: 'C:\\EISCore\\Watch\\quality',
      search: '质检记录'
    })),
    'quality inspection query should include date, document, source, type, material, result, inspector, upload ownership, business duplicate, source folder and search filters'
  )
  const resetQualityInspectionStart = qualityInspectionRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/quality-inspections') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), [
        'dateFrom',
        'dateTo',
        'docNo',
        'sourceDocNo',
        'inspectionType',
        'itemCode',
        'result',
        'inspector',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ]) &&
      response.status() === 200
    ),
    qualityInspectionPanel.getByRole('button', { name: '重置', exact: true }).click()
  ])
  assert.ok(
    qualityInspectionRequestUrls.slice(resetQualityInspectionStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, [
        'dateFrom',
        'dateTo',
        'docNo',
        'sourceDocNo',
        'inspectionType',
        'itemCode',
        'result',
        'inspector',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ])
    ),
    'quality inspection reset should clear filters and reload the first page'
  )

  const qualitySourceStart = businessSourceRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        businessLinkId,
        targetSchema: 'public',
        targetTable: 'quality_inspections',
        targetRecordId: 'QC-20260617-001',
        uploadedBy: 'qc-user',
        uploadedByRole: 'quality',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\quality',
        duplicateBusinessSource: 'true'
      }) &&
      response.status() === 200
    ),
    qualityInspectionPanel.getByRole('button', { name: '来源' }).first().click()
  ])
  assert.ok(
    businessSourceRequestUrls.slice(qualitySourceStart).some((url) => requestHasParams(url, {
      businessLinkId,
      targetSchema: 'public',
      targetTable: 'quality_inspections',
      targetRecordId: 'QC-20260617-001',
      uploadedBy: 'qc-user',
      uploadedByRole: 'quality',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\quality',
      duplicateBusinessSource: 'true'
    })),
    'quality inspection source action should jump to source lookup with business link and upload ownership filters'
  )

  await page.locator('.nav-item').filter({ hasText: '考勤快照' }).click()
  const hrAttendancePanel = page.locator('.stage-panel').filter({
    has: page.getByRole('heading', { name: '考勤快照' })
  })
  await hrAttendancePanel.getByText('张生产').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('生产部').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('attendance-june.xlsx').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('C:\\EISCore\\Watch\\hr / hash-attendance-june').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('正式业务来源').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('hr-operator').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('hr / 目录默认用户').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('监听目录 / completed').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('2.5h').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('待确认').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByText('未提交前置').first().waitFor({ state: 'visible', timeout: 10000 })
  await hrAttendancePanel.getByPlaceholder('月份 2026-06').fill('2026-06')
  await hrAttendancePanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '待确认', exact: true }).click()
  await hrAttendancePanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '未提交', exact: true }).click()
  await hrAttendancePanel.getByPlaceholder('员工编号').fill('E001')
  await hrAttendancePanel.getByPlaceholder('员工姓名').fill('张')
  await hrAttendancePanel.getByPlaceholder('部门').fill('生产')
  await hrAttendancePanel.getByPlaceholder('来源记录 ID').fill('HR-ATT-001')
  await hrAttendancePanel.getByPlaceholder('上传人').fill('hr-operator')
  await hrAttendancePanel.getByPlaceholder('岗位 / 角色').fill('hr')
  await hrAttendancePanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await hrAttendancePanel.locator('.filter-strip .el-select').nth(3).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await hrAttendancePanel.locator('.filter-strip .el-select').nth(4).click()
  await page.getByRole('option', { name: '正式业务来源', exact: true }).last().click()
  await hrAttendancePanel.getByPlaceholder('来源目录').fill('C:\\EISCore\\Watch\\hr')
  await hrAttendancePanel.getByPlaceholder('员工 / 文件 / hash').fill('attendance')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-attendance-snapshots') &&
      requestHasParams(response.url(), {
        month: '2026-06',
        confirmationStatus: 'pending_confirmation',
        payrollPrecheckStatus: 'not_requested',
        employeeNo: 'E001',
        employeeName: '张',
        deptName: '生产',
        sourceTargetRecordId: 'HR-ATT-001',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        duplicateBusinessSource: 'false',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        search: 'attendance'
      }) &&
      response.status() === 200
    ),
    hrAttendancePanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    hrAttendanceSnapshotRequestUrls.some((url) => requestHasParams(url, {
      month: '2026-06',
      confirmationStatus: 'pending_confirmation',
      payrollPrecheckStatus: 'not_requested',
      employeeNo: 'E001',
      employeeName: '张',
      deptName: '生产',
      sourceTargetRecordId: 'HR-ATT-001',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicateBusinessSource: 'false',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      search: 'attendance'
    })),
    'HR attendance snapshot query should include month, employee, department, upload ownership, business duplicate, source folder and search filters'
  )
  const resetHrAttendanceSnapshotStart = hrAttendanceSnapshotRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-attendance-snapshots') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), [
        'month',
        'confirmationStatus',
        'payrollPrecheckStatus',
        'employeeNo',
        'employeeName',
        'deptName',
        'sourceTargetRecordId',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ]) &&
      response.status() === 200
    ),
    hrAttendancePanel.getByRole('button', { name: '重置', exact: true }).click()
  ])
  assert.ok(
    hrAttendanceSnapshotRequestUrls.slice(resetHrAttendanceSnapshotStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, [
        'month',
        'confirmationStatus',
        'payrollPrecheckStatus',
        'employeeNo',
        'employeeName',
        'deptName',
        'sourceTargetRecordId',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ])
    ),
    'HR attendance snapshot reset should clear filters and reload the first page'
  )
  const hrSourceStart = businessSourceRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        businessLinkId,
        targetSchema: 'hr',
        targetTable: 'document_intake_records',
        targetRecordId: 'HR-ATT-001',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        duplicateBusinessSource: 'false'
      }) &&
      response.status() === 200
    ),
    hrAttendancePanel.getByRole('button', { name: '来源' }).first().click()
  ])
  assert.ok(
    businessSourceRequestUrls.slice(hrSourceStart).some((url) => requestHasParams(url, {
      businessLinkId,
      targetSchema: 'hr',
      targetTable: 'document_intake_records',
      targetRecordId: 'HR-ATT-001',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      duplicateBusinessSource: 'false'
    })),
    'HR attendance snapshot source action should jump to source lookup with business link and upload ownership filters'
  )
  await page.locator('.nav-item').filter({ hasText: '考勤快照' }).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-attendance-snapshots/99999999-9999-4999-8999-999999999999/action') &&
      response.request().method() === 'POST' &&
      response.status() === 200
    ),
    (async () => {
      await hrAttendancePanel.getByRole('button', { name: '确认' }).click()
      await page.locator('.el-message-box__btns .el-button--primary').click()
    })()
  ])
  assert.equal(hrAttendanceSnapshotActionPayloads.at(-1)?.action, 'confirm', 'HR snapshot confirm action should be posted')
  await hrAttendancePanel.getByText('已确认').first().waitFor({ state: 'visible', timeout: 10000 })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-attendance-snapshots/99999999-9999-4999-8999-999999999999/action') &&
      response.request().method() === 'POST' &&
      response.status() === 200
    ),
    (async () => {
      await hrAttendancePanel.getByRole('button', { name: '薪资前置' }).click()
      await page.locator('.el-message-box__btns .el-button--primary').click()
    })()
  ])
  assert.equal(
    hrAttendanceSnapshotActionPayloads.at(-1)?.action,
    'submit_payroll_precheck',
    'HR snapshot payroll precheck action should be posted after confirmation'
  )
  await hrAttendancePanel.getByText('已提交前置').first().waitFor({ state: 'visible', timeout: 10000 })

  await page.locator('.nav-item').filter({ hasText: '薪资前置' }).click()
  const payrollPrecheckPanel = page.locator('.stage-panel').filter({
    has: page.getByRole('heading', { name: '薪资前置' })
  })
  await payrollPrecheckPanel.getByText('张生产').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('不写薪资').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('attendance-june.xlsx').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('C:\\EISCore\\Watch\\hr / hash-attendance-june').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('正式业务来源').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('hr-operator').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('hr / 目录默认用户').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('监听目录 / completed').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByText('E001:2026-06').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollPrecheckPanel.getByPlaceholder('月份 2026-06').fill('2026-06')
  await payrollPrecheckPanel.getByPlaceholder('员工编号').fill('E001')
  await payrollPrecheckPanel.getByPlaceholder('员工姓名').fill('张')
  await payrollPrecheckPanel.getByPlaceholder('部门').fill('生产')
  await payrollPrecheckPanel.getByPlaceholder('来源记录 ID').fill('HR-ATT-001')
  await payrollPrecheckPanel.getByPlaceholder('上传人').fill('hr-operator')
  await payrollPrecheckPanel.getByPlaceholder('岗位 / 角色').fill('hr')
  await payrollPrecheckPanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await payrollPrecheckPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await payrollPrecheckPanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '正式业务来源', exact: true }).last().click()
  await payrollPrecheckPanel.getByPlaceholder('来源目录').fill('C:\\EISCore\\Watch\\hr')
  await payrollPrecheckPanel.getByPlaceholder('员工 / 文件 / hash').fill('attendance')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-snapshots') &&
      requestHasParams(response.url(), {
        month: '2026-06',
        employeeNo: 'E001',
        employeeName: '张',
        deptName: '生产',
        sourceTargetRecordId: 'HR-ATT-001',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        duplicateBusinessSource: 'false',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        search: 'attendance'
      }) &&
      response.status() === 200
    ),
    payrollPrecheckPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    payrollPrecheckRequestUrls.some((url) => requestHasParams(url, {
      month: '2026-06',
      employeeNo: 'E001',
      employeeName: '张',
      deptName: '生产',
      sourceTargetRecordId: 'HR-ATT-001',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicateBusinessSource: 'false',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      search: 'attendance'
    })),
    'payroll precheck snapshot query should include month, employee, department, upload ownership, business duplicate, source folder and search filters'
  )
  const resetPayrollPrecheckStart = payrollPrecheckRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-snapshots') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), [
        'month',
        'employeeNo',
        'employeeName',
        'deptName',
        'sourceTargetRecordId',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ]) &&
      response.status() === 200
    ),
    payrollPrecheckPanel.getByRole('button', { name: '重置', exact: true }).click()
  ])
  assert.ok(
    payrollPrecheckRequestUrls.slice(resetPayrollPrecheckStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, [
        'month',
        'employeeNo',
        'employeeName',
        'deptName',
        'sourceTargetRecordId',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'duplicateBusinessSource',
        'sourceFolder',
        'search'
      ])
    ),
    'payroll precheck snapshot reset should clear filters and reload the first page'
  )
  const payrollSourceStart = businessSourceRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        businessLinkId,
        targetSchema: 'hr',
        targetTable: 'document_intake_records',
        targetRecordId: 'HR-ATT-001',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        duplicateBusinessSource: 'false'
      }) &&
      response.status() === 200
    ),
    payrollPrecheckPanel.getByRole('button', { name: '来源' }).first().click()
  ])
  assert.ok(
    businessSourceRequestUrls.slice(payrollSourceStart).some((url) => requestHasParams(url, {
      businessLinkId,
      targetSchema: 'hr',
      targetTable: 'document_intake_records',
      targetRecordId: 'HR-ATT-001',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      duplicateBusinessSource: 'false'
    })),
    'payroll precheck source action should jump to source lookup with business link and upload ownership filters'
  )

  await page.locator('.nav-item').nth(1).click()
  await expectText(page, 'local-collector-01')
  await expectText(page, '0.2.0')
  await expectText(page, 'WebView2 126')
  await expectText(page, '上传 3')
  await expectText(page, '日志 2')
  await expectText(page, '缺失目录 1')
  await expectText(page, 'u_device / purchase')
  const devicePanel = page.locator('.stage-panel').nth(1)
  await devicePanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '活跃', exact: true }).click()
  await devicePanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '在线', exact: true }).click()
  await devicePanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '上传积压', exact: true }).click()
  await page.getByPlaceholder('客户端版本').fill('0.2')
  await page.getByPlaceholder('WebView 版本').fill('WebView2')
  await devicePanel.getByPlaceholder('默认上传人').fill('operator')
  await devicePanel.getByPlaceholder('默认岗位').fill('purchase')
  await devicePanel.getByPlaceholder('心跳开始').fill('2026-06-19T01:00:00.000Z')
  await devicePanel.getByPlaceholder('心跳结束').fill('2026-06-19T03:00:00.000Z')
  await page.getByPlaceholder('设备编号 / 名称 / 上传人').fill('local')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/devices') &&
      requestHasParams(response.url(), {
        status: 'active',
        onlineStatus: 'active',
        healthIssue: 'upload_backlog',
        clientVersion: '0.2',
        webviewVersion: 'WebView2',
        defaultUser: 'operator',
        defaultRole: 'purchase',
        lastSeenFrom: '2026-06-19T01:00:00.000Z',
        lastSeenTo: '2026-06-19T03:00:00.000Z',
        search: 'local'
      }) &&
      response.status() === 200
    ),
    devicePanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    deviceRequestUrls.some((url) => requestHasParams(url, {
      status: 'active',
      onlineStatus: 'active',
      healthIssue: 'upload_backlog',
      clientVersion: '0.2',
      webviewVersion: 'WebView2',
      defaultUser: 'operator',
      defaultRole: 'purchase',
      lastSeenFrom: '2026-06-19T01:00:00.000Z',
      lastSeenTo: '2026-06-19T03:00:00.000Z',
      search: 'local'
    })),
    'device query should include lifecycle status, online status, health issue, version, owner, role, heartbeat, and search filters'
  )
  const resetDeviceRequestStart = deviceRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/devices') &&
      requestHasParams(response.url(), { limit: '50', offset: '0', activeWindowMinutes: '10' }) &&
      requestLacksParams(response.url(), [
        'status',
        'onlineStatus',
        'healthIssue',
        'clientVersion',
        'webviewVersion',
        'defaultUser',
        'defaultRole',
        'lastSeenFrom',
        'lastSeenTo',
        'search'
      ]) &&
      response.status() === 200
    ),
    devicePanel.getByRole('button', { name: '重置', exact: true }).click()
  ])
  assert.ok(
    deviceRequestUrls.slice(resetDeviceRequestStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0', activeWindowMinutes: '10' }) &&
      requestLacksParams(url, [
        'status',
        'onlineStatus',
        'healthIssue',
        'clientVersion',
        'webviewVersion',
        'defaultUser',
        'defaultRole',
        'lastSeenFrom',
        'lastSeenTo',
        'search'
      ])
    ),
    'device reset should clear device management filters and reload the first page'
  )

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/devices/') &&
      response.request().method() === 'GET' &&
      response.status() === 200
    ),
    devicePanel.getByRole('button', { name: '查看监听目录 1' }).click()
  ])
  const watchFolderCountDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'C:\\EISCore\\Watch\\purchase'),
    null,
    { timeout: 10000 }
  )
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'folder-operator'),
    null,
    { timeout: 10000 }
  )
  await watchFolderCountDialog.getByRole('button', { name: '取消' }).click()

  const deviceFileCountAssetStart = assetRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase'
      }) &&
      response.status() === 200
    ),
    devicePanel.getByRole('button', { name: '查看今日文件 4' }).click()
  ])
  assert.ok(
    assetRequestUrls.slice(deviceFileCountAssetStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase'
    })),
    'device today file count should jump to asset list with device ownership filters'
  )

  await page.locator('.nav-item').nth(1).click()
  const deviceLogCountStart = logRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01'
      }) &&
      response.status() === 200
    ),
    devicePanel.getByRole('button', { name: '查看设备日志 1' }).click()
  ])
  assert.ok(
    logRequestUrls.slice(deviceLogCountStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01'
    })),
    'device log count should jump to log center with device filter'
  )

  await page.locator('.nav-item').nth(1).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase'
      }) &&
      response.status() === 200
    ),
    devicePanel.getByText('上传 3').first().click()
  ])
  assert.ok(
    assetRequestUrls.some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase'
    })),
    'device health upload backlog tag should jump to asset list with device ownership filters'
  )

  await page.locator('.nav-item').nth(1).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01'
      }) &&
      response.status() === 200
    ),
    devicePanel.getByText('日志 2').first().click()
  ])
  assert.ok(
    logRequestUrls.some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01'
    })),
    'device health log backlog tag should jump to log center with device filter'
  )

  await page.locator('.nav-item').nth(1).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        level: 'warn',
        eventType: 'file_watch_error',
        search: '监听目录不存在'
      }) &&
      response.status() === 200
    ),
    devicePanel.getByText('缺失目录 1').first().click()
  ])
  assert.ok(
    logRequestUrls.some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      level: 'warn',
      eventType: 'file_watch_error',
      search: '监听目录不存在'
    })),
    'device health missing folder tag should jump to watch folder error logs'
  )

  await page.locator('.nav-item').nth(1).click()
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'u_device'),
    null,
    { timeout: 10000 }
  )
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'folder-operator'),
    null,
    { timeout: 10000 }
  )
  await page.waitForFunction(
    () => [...document.querySelectorAll('textarea')].some((textarea) => textarea.value.includes('retention_days')),
    null,
    { timeout: 10000 }
  )
  const editDeviceDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await expectText(page, '健康快照')
  await expectText(page, '存在异常')
  await expectText(page, '待上传 3')
  await expectText(page, '失败 1')
  await expectText(page, '待传日志 2')
  await expectText(page, '缺失 1 / 不可访问 0')
  await expectText(page, '5.0 GB')
  await expectText(page, '数据库 1.0 MB')
  await expectText(page, '失败原因')
  await expectText(page, 'Network timeout')
  await expectText(page, '2 次')
  await expectText(page, '缺失')
  await editDeviceDialog.locator('textarea').first().fill(JSON.stringify({
    logs: { retention_days: 45 },
    upload: { max_retry_count: 5 }
  }, null, 2))
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/devices/') &&
      response.request().method() === 'PATCH' &&
      response.status() === 200
    ),
    editDeviceDialog.getByRole('button', { name: '保存' }).click()
  ])
  assert.equal(deviceUpdatePayloads.at(-1)?.configVersion, 'cfg-smoke-1', 'device update should keep the displayed config version')
  assert.equal(deviceUpdatePayloads.at(-1)?.remoteConfig?.logs?.retention_days, 45, 'device update should submit remote log config')
  assert.equal(deviceUpdatePayloads.at(-1)?.remoteConfig?.upload?.max_retry_count, 5, 'device update should submit remote upload config')

  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'u_device'),
    null,
    { timeout: 10000 }
  )
  const failedSummaryLogStart = logRequestUrls.length
  const failedSummaryDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        eventType: 'file_upload_failed',
        search: 'Network timeout'
      }) &&
      response.status() === 200
    ),
    failedSummaryDialog.locator('.health-error-row').filter({ hasText: 'Network timeout' }).click()
  ])
  assert.ok(
    logRequestUrls.slice(failedSummaryLogStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      eventType: 'file_upload_failed',
      search: 'Network timeout'
    })),
    'device health failed upload summary should jump to matching owned upload failure logs'
  )

  await page.locator('.nav-item').nth(1).click()
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'u_device'),
    null,
    { timeout: 10000 }
  )
  const snapshotAssetRequestStart = assetRequestUrls.length
  const snapshotUploadDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase'
      }) &&
      response.status() === 200
    ),
    snapshotUploadDialog.getByText('上传队列').click()
  ])
  assert.ok(
    assetRequestUrls.slice(snapshotAssetRequestStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase'
    })),
    'device health snapshot upload card should jump to asset list with device ownership filters'
  )

  await page.locator('.nav-item').nth(1).click()
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'u_device'),
    null,
    { timeout: 10000 }
  )
  const snapshotFailedLogStart = logRequestUrls.length
  const snapshotFailedDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'operator',
        uploadedByRole: 'purchase',
        eventType: 'file_upload_failed'
      }) &&
      response.status() === 200
    ),
    snapshotFailedDialog.getByText('失败队列').click()
  ])
  assert.ok(
    logRequestUrls.slice(snapshotFailedLogStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'operator',
      uploadedByRole: 'purchase',
      eventType: 'file_upload_failed'
    })),
    'device health snapshot failed upload card should jump to owned upload failure logs'
  )

  await page.locator('.nav-item').nth(1).click()
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'u_device'),
    null,
    { timeout: 10000 }
  )
  const snapshotFolderLogStart = logRequestUrls.length
  const snapshotFolderDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        level: 'warn',
        eventType: 'file_watch_error',
        search: '监听目录不存在'
      }) &&
      response.status() === 200
    ),
    snapshotFolderDialog.locator('.health-card').filter({ hasText: '监听目录' }).click()
  ])
  assert.ok(
    logRequestUrls.slice(snapshotFolderLogStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      level: 'warn',
      eventType: 'file_watch_error',
      search: '监听目录不存在'
    })),
    'device health snapshot watch folder card should jump to folder issue logs'
  )

  await page.locator('.nav-item').nth(1).click()
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'C:\\EISCore\\Watch\\purchase'),
    null,
    { timeout: 10000 }
  )
  const traceAssetDeviceDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'folder-operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase'
      }) &&
      response.status() === 200
    ),
    traceAssetDeviceDialog.getByRole('button', { name: '文件', exact: true }).click()
  ])
  assert.ok(
    assetRequestUrls.some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'folder-operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase'
    })),
    'watch folder file action should jump to asset list with device, folder, source and ownership filters'
  )

  await page.locator('.nav-item').nth(1).click()
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'C:\\EISCore\\Watch\\purchase'),
    null,
    { timeout: 10000 }
  )
  const traceLogDeviceDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'folder-operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase'
      }) &&
      response.status() === 200
    ),
    traceLogDeviceDialog.getByRole('button', { name: '日志', exact: true }).click()
  ])
  assert.ok(
    logRequestUrls.some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'folder-operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase'
    })),
    'watch folder log action should jump to log center with device, folder, source and ownership filters'
  )

  await page.locator('.nav-item').nth(1).click()
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((input) => input.value === 'C:\\EISCore\\Watch\\purchase'),
    null,
    { timeout: 10000 }
  )
  const issueLogDeviceDialog = page.locator('.el-dialog').filter({ hasText: '编辑采集设备' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        uploadedBy: 'folder-operator',
        uploadedByRole: 'purchase',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\purchase',
        level: 'warn',
        eventType: 'file_watch_error',
        search: '监听目录不存在'
      }) &&
      response.status() === 200
    ),
    issueLogDeviceDialog.getByRole('button', { name: '异常日志', exact: true }).click()
  ])
  assert.ok(
    logRequestUrls.some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      uploadedBy: 'folder-operator',
      uploadedByRole: 'purchase',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\purchase',
      level: 'warn',
      eventType: 'file_watch_error',
      search: '监听目录不存在'
    })),
    'watch folder issue log action should prefill warning file watch error filters'
  )

  await page.locator('.nav-item').nth(1).click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      response.url().includes('deviceCode=local-collector-01') &&
      response.status() === 200
    ),
    page.locator('.stage-panel').nth(1).getByRole('button', { name: '日志' }).first().click()
  ])
  assert.ok(
    logRequestUrls.some((url) => url.includes('deviceCode=local-collector-01')),
    'device row log action should jump to log center with device code filter'
  )
  await expectText(page, 'file_upload_failed')
  await expectText(page, 'session-smoke-1')
  await expectText(page, 'operator / warehouse')
  await page.locator('.stage-panel').nth(2).getByText('hash-purchase-order').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.stage-panel').nth(2).getByText('DIB-SMOKE-001').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.stage-panel').nth(2).locator('.el-table__expand-icon').first().click()
  await expectText(page, 'warehouse-user')
  await expectText(page, 'warehouse / 目录默认用户')
  await expectText(page, '窗口拖拽')
  await expectText(page, '失败')
  await expectText(page, 'D:\\EISCore\\Warehouse')
  await expectText(page, 'https://nanpai.eissys.top/agent/document-intake/assets/upload')
  await expectText(page, 'UploadQueueProcessor.ProcessOnceAsync failed')
  await expectText(page, '"retryable": true')
  const logPanel = page.locator('.stage-panel').nth(2)
  const assetStatusLogStart = logRequestUrls.length
  await logPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '失败', exact: true }).click()
  await logPanel.locator('.filter-strip .el-select').nth(4).click()
  await page.getByRole('option', { name: '重复', exact: true }).last().click()
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        assetStatus: 'failed',
        duplicate: 'true'
      }) &&
      response.status() === 200
    ),
    logPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    logRequestUrls.slice(assetStatusLogStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      assetStatus: 'failed',
      duplicate: 'true'
    })),
    'log center should filter by linked source asset status and duplicate marker'
  )
  await logPanel.locator('.el-table__expand-icon').first().click()
  const traceQuickLogStart = logRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        traceId: 'trace-smoke-1'
      }) &&
      response.status() === 200
    ),
    logPanel.getByRole('button', { name: '同 trace' }).click()
  ])
  assert.ok(
    logRequestUrls.slice(traceQuickLogStart).some((url) => requestHasParams(url, {
      traceId: 'trace-smoke-1'
    })),
    'log trace quick action should reload logs with trace id filter'
  )
  await logPanel.getByPlaceholder('设备编号').fill('local-collector-01')
  await logPanel.getByPlaceholder('用户ID / 用户名').fill('device-user')
  await logPanel.getByPlaceholder('岗位 / 角色').fill('warehouse')
  await logPanel.getByPlaceholder('模块').fill('collector')
  await logPanel.getByPlaceholder('页面 / 路由').fill('/upload')
  await logPanel.getByPlaceholder('事件类型').fill('file_upload_failed')
  await logPanel.getByPlaceholder('批次号').fill('DIB-SMOKE-001')
  await logPanel.getByPlaceholder('文件 hash').fill('hash-purchase-order')
  await logPanel.getByPlaceholder('上传人').fill('warehouse-user')
  await logPanel.getByPlaceholder('上传岗位').fill('warehouse')
  await logPanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '失败', exact: true }).click()
  await logPanel.locator('.filter-strip .el-select').nth(4).click()
  await page.getByRole('option', { name: '重复', exact: true }).last().click()
  await logPanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '窗口拖拽', exact: true }).click()
  await logPanel.locator('.filter-strip .el-select').nth(3).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await logPanel.getByPlaceholder('来源目录').fill('D:\\EISCore\\Warehouse')
  await logPanel.getByPlaceholder('会话 ID').fill('session-smoke-1')
  await logPanel.getByPlaceholder('trace_id').fill('trace-smoke-1')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        username: 'device-user',
        role: 'warehouse',
        appModule: 'collector',
        route: '/upload',
        eventType: 'file_upload_failed',
        batchNo: 'DIB-SMOKE-001',
        fileHash: 'hash-purchase-order',
        assetStatus: 'failed',
        duplicate: 'true',
        uploadedBy: 'warehouse-user',
        uploadedByRole: 'warehouse',
        uploadSource: 'manual_drag_drop',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'D:\\EISCore\\Warehouse',
        clientSessionId: 'session-smoke-1',
        traceId: 'trace-smoke-1'
      }) &&
      response.status() === 200
    ),
    logPanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    logRequestUrls.some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      username: 'device-user',
      role: 'warehouse',
      appModule: 'collector',
      route: '/upload',
      eventType: 'file_upload_failed',
      batchNo: 'DIB-SMOKE-001',
      fileHash: 'hash-purchase-order',
      assetStatus: 'failed',
      duplicate: 'true',
      uploadedBy: 'warehouse-user',
      uploadedByRole: 'warehouse',
      uploadSource: 'manual_drag_drop',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'D:\\EISCore\\Warehouse',
      clientSessionId: 'session-smoke-1',
      traceId: 'trace-smoke-1'
    })),
    'log query should include device, user, module, route, event, batch, file hash, asset status, duplicate, upload ownership, source folder, client session and trace filters'
  )
  const resetLogRequestStart = logRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/logs') &&
      requestHasParams(response.url(), { limit: '100', offset: '0' }) &&
      requestLacksParams(response.url(), [
        'level',
        'deviceCode',
        'username',
        'role',
        'appModule',
        'route',
        'eventType',
        'batchNo',
        'fileHash',
        'assetStatus',
        'duplicate',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'sourceFolder',
        'clientSessionId',
        'traceId',
        'search'
      ]) &&
      response.status() === 200
    ),
    logPanel.getByRole('button', { name: '重置', exact: true }).click()
  ])
  assert.ok(
    logRequestUrls.slice(resetLogRequestStart).some((url) =>
      requestHasParams(url, { limit: '100', offset: '0' }) &&
      requestLacksParams(url, [
        'level',
        'deviceCode',
        'username',
        'role',
        'appModule',
        'route',
        'eventType',
        'batchNo',
        'fileHash',
        'assetStatus',
        'duplicate',
        'uploadedBy',
        'uploadedByRole',
        'uploadSource',
        'operatorSource',
        'sourceFolder',
        'clientSessionId',
        'traceId',
        'search'
      ])
    ),
    'log reset should clear log center filters and reload the first page'
  )
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes(`/document-intake/admin/assets/${assetId}`) &&
      response.status() === 200
    ),
    logPanel.getByRole('button', { name: '详情' }).first().click()
  ])
  await page.locator('.el-drawer').filter({ hasText: '文件入库详情' }).waitFor({ state: 'visible', timeout: 10000 })
  await expectText(page, 'Purchase order OCR text')
  await page.locator('.el-drawer__close-btn').click()
  await page.locator('.el-drawer').waitFor({ state: 'hidden', timeout: 10000 })
  const logSourceAssetStart = assetRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/assets?') &&
      requestHasParams(response.url(), {
        deviceCode: 'local-collector-01',
        fileHash: 'hash-purchase-order',
        uploadedBy: 'warehouse-user',
        uploadedByRole: 'warehouse',
        uploadSource: 'manual_drag_drop',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'D:\\EISCore\\Warehouse'
      }) &&
      response.status() === 200
    ),
    logPanel.getByRole('button', { name: '文件' }).first().click()
  ])
  assert.ok(
    assetRequestUrls.slice(logSourceAssetStart).some((url) => requestHasParams(url, {
      deviceCode: 'local-collector-01',
      fileHash: 'hash-purchase-order',
      uploadedBy: 'warehouse-user',
      uploadedByRole: 'warehouse',
      uploadSource: 'manual_drag_drop',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'D:\\EISCore\\Warehouse'
    })),
    'log source file action should jump to asset list with source log filters'
  )

  assert.ok(await page.locator('.document-intake-center').isVisible())

  const payrollRuntimeUrl = new URL('/apps/payroll-precheck-review', appUrl).toString()
  await page.goto(payrollRuntimeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('.payroll-precheck-review').waitFor({ state: 'visible', timeout: 15000 })
  await expectText(page, '薪资复核')
  await expectText(page, '考勤只读引用')
  await expectText(page, '试算/复核结果')
  await expectText(page, '薪资模块只读引用')
  await expectText(page, '正式薪资未写入')
  await expectText(page, 'no_payroll_mutation=true')
  await expectText(page, '张生产')
  await expectText(page, '只读引用')
  await expectText(page, 'E001:2026-06')
  await expectText(page, 'hr-operator')
  await expectText(page, 'hr / 目录默认用户')
  const payrollRuntimePanel = page.locator('.payroll-precheck-review')
  const payrollResultPanel = payrollRuntimePanel.locator('.result-panel').filter({
    has: page.getByRole('heading', { name: '试算/复核结果' })
  })
  const payrollReadyPanel = payrollRuntimePanel.locator('.result-panel').filter({
    has: page.getByRole('heading', { name: '薪资模块只读引用' })
  })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-snapshots/99999999-9999-4999-8999-999999999999/trial') &&
      response.request().method() === 'POST' &&
      response.status() === 200
    ),
    payrollRuntimePanel.getByRole('button', { name: '生成试算' }).click()
  ])
  assert.equal(payrollPrecheckTrialPayloads.at(-1)?.action, 'generate_trial', 'payroll runtime should post generate_trial')
  await payrollResultPanel.getByText('待复核').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollResultPanel.getByText('不写薪资').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollResultPanel.getByText('attendance-june.xlsx').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollRuntimePanel.getByText('C:\\EISCore\\Watch\\hr / hash-attendance-june').first().waitFor({ state: 'visible', timeout: 10000 })
  const payrollResultTraceStart = businessSourceRequestUrls.length
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/business-sources') &&
      requestHasParams(response.url(), {
        businessLinkId,
        targetSchema: 'hr',
        targetTable: 'document_intake_records',
        targetRecordId: 'HR-ATT-001',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        duplicateBusinessSource: 'false'
      }) &&
      response.status() === 200
    ),
    payrollResultPanel.getByRole('button', { name: '来源' }).first().click()
  ])
  assert.ok(
    businessSourceRequestUrls.slice(payrollResultTraceStart).some((url) => requestHasParams(url, {
      businessLinkId,
      targetSchema: 'hr',
      targetTable: 'document_intake_records',
      targetRecordId: 'HR-ATT-001',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      duplicateBusinessSource: 'false'
    })),
    'payroll precheck result source action should query business sources with upload ownership and formal source filters'
  )
  await page.locator('.source-trace-dialog').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.source-trace-dialog .el-dialog__headerbtn').click()
  await page.locator('.source-trace-dialog').waitFor({ state: 'hidden', timeout: 10000 })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-results/77777777-7777-4777-8777-777777777777/action') &&
      response.request().method() === 'POST' &&
      response.status() === 200
    ),
    (async () => {
      await payrollResultPanel.getByRole('button', { name: '复核通过' }).click()
      await page.locator('.el-message-box__btns .el-button--primary').click()
    })()
  ])
  assert.equal(payrollPrecheckResultActionPayloads.at(-1)?.action, 'approve', 'payroll runtime should approve the precheck result')
  await payrollResultPanel.getByText('已通过').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollResultPanel.getByText('不写薪资').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollReadyPanel.getByText('只读引用').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollReadyPanel.getByText('hr.payroll_precheck_results').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollRuntimePanel.getByText('正式业务来源').first().waitFor({ state: 'visible', timeout: 10000 })
  await payrollRuntimePanel.getByPlaceholder('月份 2026-06').fill('2026-06')
  await payrollRuntimePanel.getByPlaceholder('员工编号').fill('E001')
  await payrollRuntimePanel.getByPlaceholder('员工姓名').fill('张')
  await payrollRuntimePanel.getByPlaceholder('部门').fill('生产')
  await payrollRuntimePanel.getByPlaceholder('上传人').fill('hr-operator')
  await payrollRuntimePanel.getByPlaceholder('岗位 / 角色').fill('hr')
  await payrollRuntimePanel.locator('.filter-strip .el-select').nth(0).click()
  await page.getByRole('option', { name: '监听目录', exact: true }).click()
  await payrollRuntimePanel.locator('.filter-strip .el-select').nth(1).click()
  await page.getByRole('option', { name: '目录默认用户', exact: true }).click()
  await payrollRuntimePanel.locator('.filter-strip .el-select').nth(2).click()
  await page.getByRole('option', { name: '正式业务来源', exact: true }).last().click()
  await payrollRuntimePanel.getByPlaceholder('来源目录').fill('C:\\EISCore\\Watch\\hr')
  await payrollRuntimePanel.getByPlaceholder('员工 / 文件 / hash').fill('attendance')
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-snapshots') &&
      requestHasParams(response.url(), {
        month: '2026-06',
        employeeNo: 'E001',
        employeeName: '张',
        deptName: '生产',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        duplicateBusinessSource: 'false',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        search: 'attendance'
      }) &&
      response.status() === 200
    ),
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-results') &&
      requestHasParams(response.url(), {
        month: '2026-06',
        employeeNo: 'E001',
        employeeName: '张',
        deptName: '生产',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        duplicateBusinessSource: 'false',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        search: 'attendance'
      }) &&
      response.status() === 200
    ),
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-ready-precheck-results') &&
      requestHasParams(response.url(), {
        month: '2026-06',
        employeeNo: 'E001',
        employeeName: '张',
        deptName: '生产',
        uploadedBy: 'hr-operator',
        uploadedByRole: 'hr',
        uploadSource: 'watch_folder',
        operatorSource: 'folder_binding_user',
        duplicateBusinessSource: 'false',
        sourceFolder: 'C:\\EISCore\\Watch\\hr',
        search: 'attendance'
      }) &&
      response.status() === 200
    ),
    payrollRuntimePanel.getByRole('button', { name: '查询' }).click()
  ])
  assert.ok(
    payrollPrecheckRequestUrls.some((url) => requestHasParams(url, {
      month: '2026-06',
      employeeNo: 'E001',
      employeeName: '张',
      deptName: '生产',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicateBusinessSource: 'false',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      search: 'attendance'
    })),
    'payroll runtime should query the payroll precheck queue with month, employee, department, upload ownership, business duplicate and search filters'
  )
  assert.ok(
    payrollPrecheckResultRequestUrls.some((url) => requestHasParams(url, {
      month: '2026-06',
      employeeNo: 'E001',
      employeeName: '张',
      deptName: '生产',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicateBusinessSource: 'false',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      search: 'attendance'
    })),
    'payroll runtime should query payroll precheck results with month, employee, department, upload ownership, business duplicate and search filters'
  )
  assert.ok(
    payrollReadyPrecheckRequestUrls.some((url) => requestHasParams(url, {
      month: '2026-06',
      employeeNo: 'E001',
      employeeName: '张',
      deptName: '生产',
      uploadedBy: 'hr-operator',
      uploadedByRole: 'hr',
      uploadSource: 'watch_folder',
      operatorSource: 'folder_binding_user',
      duplicateBusinessSource: 'false',
      sourceFolder: 'C:\\EISCore\\Watch\\hr',
      search: 'attendance'
    })),
    'payroll runtime should query payroll ready readonly results with month, employee, department, upload ownership, business duplicate and search filters'
  )
  const resetPayrollRuntimeQueueStart = payrollPrecheckRequestUrls.length
  const resetPayrollRuntimeResultStart = payrollPrecheckResultRequestUrls.length
  const resetPayrollRuntimeReadyStart = payrollReadyPrecheckRequestUrls.length
  const payrollRuntimeResetFilterKeys = [
    'month',
    'employeeNo',
    'employeeName',
    'deptName',
    'uploadedBy',
    'uploadedByRole',
    'uploadSource',
    'operatorSource',
    'duplicateBusinessSource',
    'sourceFolder',
    'search'
  ]
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-snapshots') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), payrollRuntimeResetFilterKeys) &&
      response.status() === 200
    ),
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-precheck-results') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), payrollRuntimeResetFilterKeys) &&
      response.status() === 200
    ),
    page.waitForResponse((response) =>
      response.url().includes('/document-intake/admin/hr-payroll-ready-precheck-results') &&
      requestHasParams(response.url(), { limit: '50', offset: '0' }) &&
      requestLacksParams(response.url(), payrollRuntimeResetFilterKeys) &&
      response.status() === 200
    ),
    payrollRuntimePanel.getByRole('button', { name: '重置', exact: true }).click()
  ])
  assert.ok(
    payrollPrecheckRequestUrls.slice(resetPayrollRuntimeQueueStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, payrollRuntimeResetFilterKeys)
    ),
    'payroll runtime reset should clear queue filters and reload the first page'
  )
  assert.ok(
    payrollPrecheckResultRequestUrls.slice(resetPayrollRuntimeResultStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, payrollRuntimeResetFilterKeys)
    ),
    'payroll runtime reset should clear trial result filters and reload the first page'
  )
  assert.ok(
    payrollReadyPrecheckRequestUrls.slice(resetPayrollRuntimeReadyStart).some((url) =>
      requestHasParams(url, { limit: '50', offset: '0' }) &&
      requestLacksParams(url, payrollRuntimeResetFilterKeys)
    ),
    'payroll runtime reset should clear ready readonly result filters and reload the first page'
  )

  console.log('PASS: document intake center UI smoke')
} finally {
  if (browser) await browser.close()
  stopDevServer(devServer)
}

async function expectText(page, text) {
  await page.getByText(text).first().waitFor({ state: 'visible', timeout: 10000 })
}
