// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const fs = require('fs');
const path = require('path');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

function positiveNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function envBoolean(value, fallback = false) {
  const text = envText(value).toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(text)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(text)) return false;
  return fallback;
}

function envChoice(value, fallback, allowed) {
  const text = envText(value, fallback).toLowerCase();
  return allowed.includes(text) ? text : fallback;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(envText(value, '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeOptionalText(value, maxLength) {
  return envText(value).slice(0, maxLength);
}

function normalizeKeywordList(value) {
  const rawKeywords = Array.isArray(value)
    ? value
    : envText(value).split(/[,，、\n]/);
  return [...new Set(rawKeywords
    .map((keyword) => normalizeOptionalText(keyword, 80))
    .filter(Boolean))]
    .slice(0, 30);
}

function normalizeDocumentTypeMappings(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((item, index) => {
    const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const targetModule = normalizeOptionalText(source.targetModule ?? source.target_module, 80);
    const targetDocumentType = normalizeOptionalText(source.targetDocumentType ?? source.target_document_type, 120);
    const keywords = normalizeKeywordList(source.keywords ?? source.keyword_list);
    if (!targetModule || !targetDocumentType || !keywords.length) return null;
    return {
      id: normalizeOptionalText(source.id, 80) || `${targetModule}:${targetDocumentType}:${index + 1}`,
      name: normalizeOptionalText(source.name, 120) || targetDocumentType,
      enabled: Object.prototype.hasOwnProperty.call(source, 'enabled') ? envBoolean(source.enabled, true) : true,
      targetModule,
      targetDocumentType,
      targetKind: normalizeOptionalText(source.targetKind ?? source.target_kind, 80) || 'fixed_module_table',
      keywords,
      priority: positiveInteger(source.priority, 100, { min: 0, max: 1000 })
    };
  }).filter(Boolean);
}

const allowedDocumentIntakePolicyChoices = Object.freeze({
  defaultAutoImportMode: Object.freeze(['auto_import', 'review_required', 'archive_only']),
  lowConfidencePolicy: Object.freeze(['auto_import_with_review', 'review_required', 'archive_only']),
  unrecognizedFilePolicy: Object.freeze(['archive_and_review', 'archive_only', 'reject']),
  duplicateFilePolicy: Object.freeze(['skip_duplicate', 'link_existing', 'allow_reimport']),
  unmappedFieldPolicy: Object.freeze(['remarks', 'properties', 'ignore']),
  businessCorrectionPolicy: Object.freeze(['record_and_recalculate', 'record_only', 'manual_review'])
});

const defaultDocumentIntakePolicyFile = path.join(__dirname, 'data', 'document-intake', 'policy.json');
const documentIntakePolicyFile = envText(process.env.DOCUMENT_INTAKE_POLICY_FILE) || defaultDocumentIntakePolicyFile;

function buildEnvDocumentIntakePolicy() {
  return {
    enabled: envBoolean(process.env.DOCUMENT_INTAKE_ENABLED, true),
    defaultAutoImportMode: envChoice(
      process.env.DOCUMENT_INTAKE_DEFAULT_AUTO_IMPORT_MODE,
      'auto_import',
      allowedDocumentIntakePolicyChoices.defaultAutoImportMode
    ),
    lowConfidencePolicy: envChoice(
      process.env.DOCUMENT_INTAKE_LOW_CONFIDENCE_POLICY,
      'auto_import_with_review',
      allowedDocumentIntakePolicyChoices.lowConfidencePolicy
    ),
    unrecognizedFilePolicy: envChoice(
      process.env.DOCUMENT_INTAKE_UNRECOGNIZED_FILE_POLICY,
      'archive_and_review',
      allowedDocumentIntakePolicyChoices.unrecognizedFilePolicy
    ),
    duplicateFilePolicy: envChoice(
      process.env.DOCUMENT_INTAKE_DUPLICATE_FILE_POLICY,
      'skip_duplicate',
      allowedDocumentIntakePolicyChoices.duplicateFilePolicy
    ),
    unmappedFieldPolicy: envChoice(
      process.env.DOCUMENT_INTAKE_UNMAPPED_FIELD_POLICY,
      'remarks',
      allowedDocumentIntakePolicyChoices.unmappedFieldPolicy
    ),
    businessCorrectionPolicy: envChoice(
      process.env.DOCUMENT_INTAKE_BUSINESS_CORRECTION_POLICY,
      'record_and_recalculate',
      allowedDocumentIntakePolicyChoices.businessCorrectionPolicy
    ),
    logCollectionEnabled: envBoolean(process.env.DOCUMENT_INTAKE_LOG_COLLECTION_ENABLED, true),
    confidenceThreshold: positiveNumber(process.env.DOCUMENT_INTAKE_CONFIDENCE_THRESHOLD, 0.7, { min: 0.01, max: 1 }),
    logRetentionDays: positiveInteger(process.env.DOCUMENT_INTAKE_LOG_RETENTION_DAYS, 30, { min: 1, max: 3650 }),
    sourceFileRetentionDays: positiveInteger(process.env.DOCUMENT_INTAKE_SOURCE_FILE_RETENTION_DAYS, 180, { min: 1, max: 3650 }),
    documentTypeMappings: normalizeDocumentTypeMappings(parseJsonArray(process.env.DOCUMENT_INTAKE_DOCUMENT_TYPE_MAPPINGS))
  };
}

function readPersistedDocumentIntakePolicy() {
  try {
    const text = fs.readFileSync(documentIntakePolicyFile, 'utf8');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      // Ignore invalid local policy files and keep the environment defaults.
    }
    return null;
  }
}

function normalizeDocumentIntakePolicy(input = {}, base = buildEnvDocumentIntakePolicy()) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    enabled: Object.prototype.hasOwnProperty.call(source, 'enabled') ? envBoolean(source.enabled, base.enabled) : base.enabled,
    defaultAutoImportMode: envChoice(
      source.defaultAutoImportMode ?? source.default_auto_import_mode,
      base.defaultAutoImportMode,
      allowedDocumentIntakePolicyChoices.defaultAutoImportMode
    ),
    lowConfidencePolicy: envChoice(
      source.lowConfidencePolicy ?? source.low_confidence_policy,
      base.lowConfidencePolicy,
      allowedDocumentIntakePolicyChoices.lowConfidencePolicy
    ),
    unrecognizedFilePolicy: envChoice(
      source.unrecognizedFilePolicy ?? source.unrecognized_file_policy,
      base.unrecognizedFilePolicy,
      allowedDocumentIntakePolicyChoices.unrecognizedFilePolicy
    ),
    duplicateFilePolicy: envChoice(
      source.duplicateFilePolicy ?? source.duplicate_file_policy,
      base.duplicateFilePolicy,
      allowedDocumentIntakePolicyChoices.duplicateFilePolicy
    ),
    unmappedFieldPolicy: envChoice(
      source.unmappedFieldPolicy ?? source.unmapped_field_policy,
      base.unmappedFieldPolicy,
      allowedDocumentIntakePolicyChoices.unmappedFieldPolicy
    ),
    businessCorrectionPolicy: envChoice(
      source.businessCorrectionPolicy ?? source.business_correction_policy,
      base.businessCorrectionPolicy,
      allowedDocumentIntakePolicyChoices.businessCorrectionPolicy
    ),
    logCollectionEnabled: Object.prototype.hasOwnProperty.call(source, 'logCollectionEnabled') ||
      Object.prototype.hasOwnProperty.call(source, 'log_collection_enabled')
      ? envBoolean(source.logCollectionEnabled ?? source.log_collection_enabled, base.logCollectionEnabled)
      : base.logCollectionEnabled,
    confidenceThreshold: positiveNumber(
      source.confidenceThreshold ?? source.confidence_threshold,
      base.confidenceThreshold,
      { min: 0.01, max: 1 }
    ),
    logRetentionDays: positiveInteger(
      source.logRetentionDays ?? source.log_retention_days,
      base.logRetentionDays,
      { min: 1, max: 3650 }
    ),
    sourceFileRetentionDays: positiveInteger(
      source.sourceFileRetentionDays ?? source.source_file_retention_days,
      base.sourceFileRetentionDays,
      { min: 1, max: 3650 }
    ),
    documentTypeMappings: normalizeDocumentTypeMappings(
      source.documentTypeMappings ?? source.document_type_mappings ?? base.documentTypeMappings
    )
  };
}

function persistDocumentIntakePolicy() {
  fs.mkdirSync(path.dirname(documentIntakePolicyFile), { recursive: true });
  fs.writeFileSync(documentIntakePolicyFile, `${JSON.stringify(documentIntakePolicy, null, 2)}\n`, 'utf8');
}

const baseDocumentIntakePolicy = Object.freeze(buildEnvDocumentIntakePolicy());
const persistedDocumentIntakePolicy = readPersistedDocumentIntakePolicy();
const documentIntakePolicy = normalizeDocumentIntakePolicy(persistedDocumentIntakePolicy || {}, baseDocumentIntakePolicy);
let documentIntakePolicySource = persistedDocumentIntakePolicy ? 'file' : 'environment';

function getDocumentIntakePolicy() {
  return { ...documentIntakePolicy };
}

function getDocumentIntakePolicyState() {
  return {
    policy: getDocumentIntakePolicy(),
    options: allowedDocumentIntakePolicyChoices,
    source: documentIntakePolicySource,
    policyFile: documentIntakePolicyFile
  };
}

function setDocumentIntakePolicy(input = {}) {
  const nextPolicy = normalizeDocumentIntakePolicy(input, documentIntakePolicy);
  Object.assign(documentIntakePolicy, nextPolicy);
  persistDocumentIntakePolicy();
  documentIntakePolicySource = 'file';
  return getDocumentIntakePolicy();
}

function resetDocumentIntakePolicy() {
  Object.assign(documentIntakePolicy, baseDocumentIntakePolicy);
  try {
    fs.unlinkSync(documentIntakePolicyFile);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  documentIntakePolicySource = 'environment';
  return getDocumentIntakePolicy();
}

function resolveEntryPlanImportPolicy(classification) {
  const confidence = Number(classification?.confidence || 0);
  const lowConfidence = confidence > 0 && confidence < documentIntakePolicy.confidenceThreshold;
  const base = {
    status: 'planned',
    autoImportReady: true,
    action: 'auto_import',
    reason: '',
    manualReviewRequired: false,
    lowConfidence
  };

  if (!documentIntakePolicy.enabled) {
    return {
      ...base,
      status: 'archived_only',
      autoImportReady: false,
      action: 'disabled',
      reason: 'document_intake_disabled'
    };
  }

  if (documentIntakePolicy.defaultAutoImportMode === 'archive_only') {
    return {
      ...base,
      status: 'archived_only',
      autoImportReady: false,
      action: 'archive_only',
      reason: 'default_auto_import_mode_archive_only'
    };
  }

  if (documentIntakePolicy.defaultAutoImportMode === 'review_required') {
    return {
      ...base,
      status: 'archived_only',
      autoImportReady: false,
      action: 'manual_review_required',
      reason: 'default_auto_import_mode_review_required',
      manualReviewRequired: true
    };
  }

  if (lowConfidence && documentIntakePolicy.lowConfidencePolicy === 'archive_only') {
    return {
      ...base,
      status: 'archived_only',
      autoImportReady: false,
      action: 'archive_only',
      reason: 'low_confidence_archive_only'
    };
  }

  if (lowConfidence && documentIntakePolicy.lowConfidencePolicy === 'review_required') {
    return {
      ...base,
      status: 'archived_only',
      autoImportReady: false,
      action: 'manual_review_required',
      reason: 'low_confidence_review_required',
      manualReviewRequired: true
    };
  }

  if (lowConfidence && documentIntakePolicy.lowConfidencePolicy === 'auto_import_with_review') {
    return {
      ...base,
      action: 'auto_import_with_review',
      reason: 'low_confidence_auto_import_with_review',
      manualReviewRequired: true
    };
  }

  return base;
}

module.exports = {
  allowedDocumentIntakePolicyChoices,
  baseDocumentIntakePolicy,
  documentIntakePolicy,
  documentIntakePolicyFile,
  getDocumentIntakePolicy,
  getDocumentIntakePolicyState,
  normalizeDocumentIntakePolicy,
  normalizeDocumentTypeMappings,
  resetDocumentIntakePolicy,
  setDocumentIntakePolicy,
  resolveEntryPlanImportPolicy
};
