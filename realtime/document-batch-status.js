// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

function toInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function deriveBatchImportStatus(counts = {}) {
  const successCount = toInteger(counts.success_count ?? counts.successCount);
  const partialCount = toInteger(counts.partial_count ?? counts.partialCount);
  const failedCount = toInteger(counts.failed_count ?? counts.failedCount);
  const remainingCount = toInteger(counts.remaining_count ?? counts.remainingCount);

  if (remainingCount > 0) return 'importing';
  if (failedCount > 0 && successCount === 0 && partialCount === 0) return 'failed';
  if (partialCount > 0 || (failedCount > 0 && successCount > 0)) return 'partial';
  return 'completed';
}

async function updateBatchStatusFromAssets(client, batchId, metadata = {}) {
  if (!batchId) return null;

  const countsResult = await client.query(
    `select
        count(*)::integer as file_count,
        count(*) filter (where status = 'imported')::integer as success_count,
        count(*) filter (where status = 'partial_imported')::integer as partial_count,
        count(*) filter (where status in ('failed', 'unrecognized'))::integer as failed_count,
        count(*) filter (where status = 'duplicate')::integer as duplicate_count,
        count(*) filter (
          where status not in ('imported', 'partial_imported', 'failed', 'unrecognized', 'duplicate', 'archived')
        )::integer as remaining_count
       from public.document_assets
      where batch_id = $1`,
    [batchId]
  );
  const counts = countsResult.rows[0] || {};
  const fileCount = toInteger(counts.file_count);
  if (fileCount <= 0) return null;

  const successCount = toInteger(counts.success_count);
  const partialCount = toInteger(counts.partial_count);
  const failedCount = toInteger(counts.failed_count);
  const duplicateCount = toInteger(counts.duplicate_count);
  const remainingCount = toInteger(counts.remaining_count);
  const status = deriveBatchImportStatus({ successCount, partialCount, failedCount, remainingCount });

  await client.query(
    `update public.document_import_batches
        set file_count = $2,
            success_count = $3,
            partial_count = $4,
            failed_count = $5,
            duplicate_count = $6,
            status = $7,
            finished_at = case when $8::boolean then now() else finished_at end,
            updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $9::jsonb
      where id = $1`,
    [
      batchId,
      fileCount,
      successCount,
      partialCount,
      failedCount,
      duplicateCount,
      status,
      remainingCount === 0,
      JSON.stringify({
        ...metadata,
        ai_import_batch_status: status,
        ai_import_counts: {
          file_count: fileCount,
          success_count: successCount,
          partial_count: partialCount,
          failed_count: failedCount,
          duplicate_count: duplicateCount,
          remaining_count: remainingCount
        }
      })
    ]
  );

  return {
    status,
    fileCount,
    successCount,
    partialCount,
    failedCount,
    duplicateCount,
    remainingCount
  };
}

module.exports = {
  deriveBatchImportStatus,
  updateBatchStatusFromAssets
};
