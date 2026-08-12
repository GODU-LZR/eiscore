using EISCore.Collector.Models;
using Microsoft.Data.Sqlite;
using System.Globalization;

namespace EISCore.Collector.Services;

public sealed class UploadQueueStore
{
    private static readonly HashSet<string> KnownStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        UploadQueueStatus.Pending,
        UploadQueueStatus.Hashing,
        UploadQueueStatus.Queued,
        UploadQueueStatus.Uploading,
        UploadQueueStatus.Uploaded,
        UploadQueueStatus.Failed,
        UploadQueueStatus.Duplicate,
        UploadQueueStatus.Ignored
    };

    public async Task EnsureCreatedAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await CollectorSqlite.ConfigureDatabaseAsync(connection, cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS upload_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                upload_source TEXT NOT NULL,
                source_folder TEXT NOT NULL DEFAULT '',
                device_id TEXT NOT NULL,
                windows_username TEXT NOT NULL DEFAULT '',
                uploaded_by_user_id TEXT NOT NULL,
                uploaded_by_username TEXT NOT NULL DEFAULT '',
                uploaded_by_role TEXT NOT NULL DEFAULT '',
                operator_source TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT NOT NULL DEFAULT '',
                next_retry_at TEXT NULL,
                created_at TEXT NOT NULL,
                uploaded_at TEXT NULL,
                server_asset_id TEXT NOT NULL DEFAULT '',
                server_batch_id TEXT NOT NULL DEFAULT '',
                server_batch_no TEXT NOT NULL DEFAULT '',
                server_processing_status TEXT NOT NULL DEFAULT '',
                server_message TEXT NOT NULL DEFAULT ''
            );
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);

        await AddColumnIfMissingAsync(connection, "file_path", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "original_filename", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "file_hash", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "file_size", "INTEGER NOT NULL DEFAULT 0", cancellationToken);
        await AddColumnIfMissingAsync(connection, "mime_type", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "upload_source", "TEXT NOT NULL DEFAULT 'manual'", cancellationToken);
        await AddColumnIfMissingAsync(connection, "source_folder", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "device_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "windows_username", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "uploaded_by_user_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "uploaded_by_username", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "uploaded_by_role", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "operator_source", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "status", "TEXT NOT NULL DEFAULT 'queued'", cancellationToken);
        await AddColumnIfMissingAsync(connection, "retry_count", "INTEGER NOT NULL DEFAULT 0", cancellationToken);
        await AddColumnIfMissingAsync(connection, "last_error", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "next_retry_at", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(connection, "created_at", "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.0000000+00:00'", cancellationToken);
        await AddColumnIfMissingAsync(connection, "uploaded_at", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(connection, "server_asset_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "server_batch_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "server_batch_no", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "server_processing_status", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "server_message", "TEXT NOT NULL DEFAULT ''", cancellationToken);

        await IgnoreRowsWithoutHashAsync(connection, cancellationToken);
        await NormalizeCorruptRowsAsync(connection, cancellationToken);
        await ResolveDuplicateFileHashesAsync(connection, cancellationToken);

        var indexCommand = connection.CreateCommand();
        indexCommand.CommandText = """
            CREATE INDEX IF NOT EXISTS idx_upload_queue_status_created
                ON upload_queue(status, created_at);
            """;
        await indexCommand.ExecuteNonQueryAsync(cancellationToken);
        await EnsureFileHashIndexAsync(connection, cancellationToken);
    }

    public async Task<UploadQueueItem?> FindByHashAsync(string fileHash, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(fileHash)) return null;

        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM upload_queue
            WHERE file_hash = $file_hash
              AND status <> $ignored
            ORDER BY
                CASE
                    WHEN status IN ($uploaded, $duplicate) THEN 0
                    WHEN status IN ($uploading, $queued, $pending, $failed) THEN 1
                    ELSE 2
                END,
                id DESC
            LIMIT 1
            """;
        command.Parameters.AddWithValue("$file_hash", fileHash);
        command.Parameters.AddWithValue("$ignored", UploadQueueStatus.Ignored);
        command.Parameters.AddWithValue("$uploaded", UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$duplicate", UploadQueueStatus.Duplicate);
        command.Parameters.AddWithValue("$uploading", UploadQueueStatus.Uploading);
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$pending", UploadQueueStatus.Pending);
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadItem(reader) : null;
    }

    public async Task<UploadQueueItem> InsertAsync(UploadQueueItem item, CancellationToken cancellationToken = default)
    {
        item.CreatedAt = item.CreatedAt == default ? DateTimeOffset.Now : item.CreatedAt;

        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO upload_queue (
                file_path,
                original_filename,
                file_hash,
                file_size,
                mime_type,
                upload_source,
                source_folder,
                device_id,
                windows_username,
                uploaded_by_user_id,
                uploaded_by_username,
                uploaded_by_role,
                operator_source,
                status,
                retry_count,
                last_error,
                next_retry_at,
                created_at,
                uploaded_at,
                server_asset_id,
                server_batch_id,
                server_batch_no,
                server_processing_status,
                server_message
            ) VALUES (
                $file_path,
                $original_filename,
                $file_hash,
                $file_size,
                $mime_type,
                $upload_source,
                $source_folder,
                $device_id,
                $windows_username,
                $uploaded_by_user_id,
                $uploaded_by_username,
                $uploaded_by_role,
                $operator_source,
                $status,
                $retry_count,
                $last_error,
                $next_retry_at,
                $created_at,
                $uploaded_at,
                $server_asset_id,
                $server_batch_id,
                $server_batch_no,
                $server_processing_status,
                $server_message
            );
            SELECT last_insert_rowid();
            """;
        BindItemParameters(command, item);
        item.Id = (long)(await command.ExecuteScalarAsync(cancellationToken) ?? 0L);
        return item;
    }

    public async Task<IReadOnlyList<UploadQueueItem>> ListRecentAsync(int limit = 50, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM upload_queue
            ORDER BY id DESC
            LIMIT $limit
            """;
        command.Parameters.AddWithValue("$limit", limit);

        var items = new List<UploadQueueItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(ReadItem(reader));
        }

        return items;
    }

    public async Task<IReadOnlyDictionary<string, int>> CountByStatusAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT status, count(*) AS count
            FROM upload_queue
            GROUP BY status
            """;

        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            counts[ReadQueueStatus(reader, 0)] = ReadNonNegativeInt32OrDefault(reader, 1);
        }

        return counts;
    }

    public async Task<(DateTimeOffset? LastQueuedAt, DateTimeOffset? LastUploadedAt, DateTimeOffset? OldestPendingUploadCreatedAt)> GetTimeWatermarksAsync(
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                (
                    SELECT created_at
                    FROM upload_queue
                    ORDER BY julianday(created_at) DESC
                    LIMIT 1
                ) AS last_queued_at,
                (
                    SELECT uploaded_at
                    FROM upload_queue
                    WHERE status IN ($uploaded, $duplicate)
                      AND uploaded_at IS NOT NULL
                    ORDER BY julianday(uploaded_at) DESC
                    LIMIT 1
                ) AS last_uploaded_at,
                (
                    SELECT created_at
                    FROM upload_queue
                    WHERE status IN ($pending, $queued, $failed, $uploading)
                    ORDER BY julianday(created_at) ASC
                    LIMIT 1
                ) AS oldest_pending_upload_created_at
            """;
        command.Parameters.AddWithValue("$uploaded", UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$duplicate", UploadQueueStatus.Duplicate);
        command.Parameters.AddWithValue("$pending", UploadQueueStatus.Pending);
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        command.Parameters.AddWithValue("$uploading", UploadQueueStatus.Uploading);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return (null, null, null);
        }

        return (
            ReadNullableDateTimeOffset(reader, 0),
            ReadNullableDateTimeOffset(reader, 1),
            ReadNullableDateTimeOffset(reader, 2));
    }

    public async Task<IReadOnlyList<UploadQueueItem>> ListActiveUploadsForHealthAsync(
        int limit = 5000,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM upload_queue
            WHERE status IN ($pending, $queued, $failed, $uploading)
            ORDER BY julianday(created_at) ASC, id ASC
            LIMIT $limit
            """;
        command.Parameters.AddWithValue("$pending", UploadQueueStatus.Pending);
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        command.Parameters.AddWithValue("$uploading", UploadQueueStatus.Uploading);
        command.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 50000));

        var items = new List<UploadQueueItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(ReadItem(reader));
        }

        return items;
    }

    public async Task<IReadOnlyList<UploadQueueItem>> ListTraceableUploadsForStatusRefreshAsync(
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM upload_queue
            WHERE trim(server_asset_id) <> ''
              AND status IN ($uploaded, $duplicate)
            ORDER BY
                CASE WHEN uploaded_at IS NULL THEN 1 ELSE 0 END,
                julianday(uploaded_at) DESC,
                id DESC
            LIMIT $limit
            """;
        command.Parameters.AddWithValue("$uploaded", UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$duplicate", UploadQueueStatus.Duplicate);
        command.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 500));

        var items = new List<UploadQueueItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(ReadItem(reader));
        }

        return items;
    }

    public async Task<(int ReadyCount, int WaitingCount, int ExhaustedCount, DateTimeOffset? NextRetryAt)> GetFailedRetrySnapshotAsync(
        int maxRetryCount,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                COALESCE(SUM(CASE
                    WHEN retry_count < $max_retry_count
                      AND (
                          next_retry_at IS NULL
                          OR trim(next_retry_at) = ''
                          OR julianday(next_retry_at) <= julianday($now)
                      )
                    THEN 1 ELSE 0 END), 0) AS ready_count,
                COALESCE(SUM(CASE
                    WHEN retry_count < $max_retry_count
                      AND next_retry_at IS NOT NULL
                      AND trim(next_retry_at) <> ''
                      AND julianday(next_retry_at) > julianday($now)
                    THEN 1 ELSE 0 END), 0) AS waiting_count,
                COALESCE(SUM(CASE
                    WHEN retry_count >= $max_retry_count
                    THEN 1 ELSE 0 END), 0) AS exhausted_count,
                MIN(CASE
                    WHEN retry_count < $max_retry_count
                      AND next_retry_at IS NOT NULL
                      AND trim(next_retry_at) <> ''
                      AND julianday(next_retry_at) > julianday($now)
                    THEN next_retry_at ELSE NULL END) AS next_retry_at
            FROM upload_queue
            WHERE status = $failed
            """;
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        command.Parameters.AddWithValue("$max_retry_count", Math.Max(1, maxRetryCount));
        command.Parameters.AddWithValue("$now", now.ToString("O"));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return (0, 0, 0, null);
        }

        return (
            ReadNonNegativeInt32OrDefault(reader, 0),
            ReadNonNegativeInt32OrDefault(reader, 1),
            ReadNonNegativeInt32OrDefault(reader, 2),
            ReadNullableDateTimeOffset(reader, 3));
    }

    public async Task<int> ResetInterruptedUploadsAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE upload_queue
            SET status = $queued,
                last_error = $last_error,
                next_retry_at = NULL
            WHERE status = $uploading
            """;
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$uploading", UploadQueueStatus.Uploading);
        command.Parameters.AddWithValue("$last_error", "采集端上次运行中断，上传任务已重新入队。");
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<UploadQueueItem?> RequeueExistingAsync(UploadQueueItem item, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE upload_queue
            SET file_path = $file_path,
                original_filename = $original_filename,
                file_size = $file_size,
                mime_type = $mime_type,
                upload_source = $upload_source,
                source_folder = $source_folder,
                device_id = $device_id,
                windows_username = $windows_username,
                uploaded_by_user_id = $uploaded_by_user_id,
                uploaded_by_username = $uploaded_by_username,
                uploaded_by_role = $uploaded_by_role,
                operator_source = $operator_source,
                status = $status,
                retry_count = 0,
                last_error = $last_error,
                next_retry_at = NULL,
                uploaded_at = NULL,
                server_asset_id = '',
                server_batch_id = '',
                server_batch_no = '',
                server_processing_status = '',
                server_message = ''
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", item.Id);
        command.Parameters.AddWithValue("$file_path", item.FilePath);
        command.Parameters.AddWithValue("$original_filename", item.OriginalFilename);
        command.Parameters.AddWithValue("$file_size", item.FileSize);
        command.Parameters.AddWithValue("$mime_type", item.MimeType);
        command.Parameters.AddWithValue("$upload_source", item.UploadSource);
        command.Parameters.AddWithValue("$source_folder", item.SourceFolder);
        command.Parameters.AddWithValue("$device_id", item.DeviceId);
        command.Parameters.AddWithValue("$windows_username", item.WindowsUsername);
        command.Parameters.AddWithValue("$uploaded_by_user_id", item.UploadedByUserId);
        command.Parameters.AddWithValue("$uploaded_by_username", item.UploadedByUsername);
        command.Parameters.AddWithValue("$uploaded_by_role", item.UploadedByRole);
        command.Parameters.AddWithValue("$operator_source", item.OperatorSource);
        command.Parameters.AddWithValue("$status", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$last_error", "同一文件再次投递，已重置重试次数并重新入队。");
        await command.ExecuteNonQueryAsync(cancellationToken);
        return await FindByHashAsync(item.FileHash, cancellationToken);
    }

    public async Task<UploadQueueItem?> GetNextPendingAsync(int maxRetryCount = 10, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM upload_queue
            WHERE status IN ($pending, $queued, $failed)
              AND retry_count < $max_retry_count
              AND (
                  status <> $failed
                  OR next_retry_at IS NULL
                  OR trim(next_retry_at) = ''
                  OR julianday(next_retry_at) <= julianday($now)
              )
            ORDER BY created_at ASC
            LIMIT 1
            """;
        command.Parameters.AddWithValue("$pending", UploadQueueStatus.Pending);
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        command.Parameters.AddWithValue("$max_retry_count", Math.Max(1, maxRetryCount));
        command.Parameters.AddWithValue("$now", DateTimeOffset.Now.ToString("O"));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadItem(reader) : null;
    }

    public async Task UpdateStatusAsync(
        long id,
        string status,
        string lastError = "",
        bool incrementRetry = false,
        DateTimeOffset? nextRetryAt = null,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE upload_queue
            SET status = $status,
                last_error = $last_error,
                retry_count = retry_count + $retry_increment,
                next_retry_at = $next_retry_at
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$status", status);
        command.Parameters.AddWithValue("$last_error", lastError);
        command.Parameters.AddWithValue("$retry_increment", incrementRetry ? 1 : 0);
        command.Parameters.AddWithValue("$next_retry_at", nextRetryAt?.ToString("O") ?? (object)DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task MarkUploadedAsync(
        long id,
        string serverAssetId,
        bool duplicate,
        CancellationToken cancellationToken = default)
    {
        await MarkUploadedAsync(
            id,
            serverAssetId,
            serverBatchId: "",
            serverBatchNo: "",
            serverProcessingStatus: "",
            serverMessage: "",
            duplicate: duplicate,
            cancellationToken: cancellationToken);
    }

    public async Task MarkUploadedAsync(
        long id,
        string serverAssetId,
        string serverBatchId,
        string serverBatchNo,
        string serverProcessingStatus,
        string serverMessage,
        bool duplicate,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE upload_queue
            SET status = $status,
                uploaded_at = $uploaded_at,
                server_asset_id = $server_asset_id,
                server_batch_id = $server_batch_id,
                server_batch_no = $server_batch_no,
                server_processing_status = $server_processing_status,
                server_message = $server_message,
                last_error = '',
                next_retry_at = NULL
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$status", duplicate ? UploadQueueStatus.Duplicate : UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$uploaded_at", DateTimeOffset.Now.ToString("O"));
        command.Parameters.AddWithValue("$server_asset_id", serverAssetId);
        command.Parameters.AddWithValue("$server_batch_id", serverBatchId);
        command.Parameters.AddWithValue("$server_batch_no", serverBatchNo);
        command.Parameters.AddWithValue("$server_processing_status", serverProcessingStatus);
        command.Parameters.AddWithValue("$server_message", serverMessage);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdateServerTraceAsync(
        long id,
        string serverBatchId,
        string serverBatchNo,
        string serverProcessingStatus,
        string serverMessage,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE upload_queue
            SET server_batch_id = $server_batch_id,
                server_batch_no = $server_batch_no,
                server_processing_status = $server_processing_status,
                server_message = $server_message
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$server_batch_id", serverBatchId);
        command.Parameters.AddWithValue("$server_batch_no", serverBatchNo);
        command.Parameters.AddWithValue("$server_processing_status", serverProcessingStatus);
        command.Parameters.AddWithValue("$server_message", serverMessage);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<int> DeleteCompletedBeforeAsync(DateTimeOffset cutoff, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM upload_queue
            WHERE (
                status IN ($uploaded, $duplicate)
                AND uploaded_at IS NOT NULL
                AND julianday(uploaded_at) < julianday($cutoff)
            )
            OR (
                status = $ignored
                AND julianday(created_at) < julianday($cutoff)
            )
            """;
        command.Parameters.AddWithValue("$uploaded", UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$duplicate", UploadQueueStatus.Duplicate);
        command.Parameters.AddWithValue("$ignored", UploadQueueStatus.Ignored);
        command.Parameters.AddWithValue("$cutoff", cutoff.ToString("O"));
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<SqliteConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        return await CollectorSqlite.OpenConnectionAsync(cancellationToken);
    }

    private static async Task AddColumnIfMissingAsync(
        SqliteConnection connection,
        string columnName,
        string definition,
        CancellationToken cancellationToken)
    {
        var existsCommand = connection.CreateCommand();
        existsCommand.CommandText = """
            SELECT 1
            FROM pragma_table_info('upload_queue')
            WHERE name = $column_name
            LIMIT 1
            """;
        existsCommand.Parameters.AddWithValue("$column_name", columnName);
        var exists = await existsCommand.ExecuteScalarAsync(cancellationToken);
        if (exists is not null) return;

        var alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE upload_queue ADD COLUMN {columnName} {definition}";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task IgnoreRowsWithoutHashAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE upload_queue
            SET status = $ignored,
                last_error = CASE
                    WHEN last_error = '' THEN $last_error
                    ELSE last_error
                END
            WHERE trim(file_hash) = ''
              AND status <> $ignored
            """;
        command.Parameters.AddWithValue("$ignored", UploadQueueStatus.Ignored);
        command.Parameters.AddWithValue("$last_error", "旧上传队列记录缺少 file_hash，已在迁移时忽略，可由监听目录重新扫描后重新入队。");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task ResolveDuplicateFileHashesAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            WITH ranked AS (
                SELECT
                    id,
                    row_number() OVER (
                        PARTITION BY file_hash
                        ORDER BY
                            CASE
                                WHEN status IN ($uploaded, $duplicate) THEN 0
                                WHEN status IN ($uploading, $queued, $pending, $failed) THEN 1
                                ELSE 2
                            END,
                            id DESC
                    ) AS duplicate_rank
                FROM upload_queue
                WHERE trim(file_hash) <> ''
                  AND status <> $ignored
            )
            UPDATE upload_queue
            SET status = $ignored,
                last_error = CASE
                    WHEN last_error = '' THEN $last_error
                    ELSE last_error
                END
            WHERE id IN (
                SELECT id
                FROM ranked
                WHERE duplicate_rank > 1
            )
            """;
        command.Parameters.AddWithValue("$ignored", UploadQueueStatus.Ignored);
        command.Parameters.AddWithValue("$uploaded", UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$duplicate", UploadQueueStatus.Duplicate);
        command.Parameters.AddWithValue("$uploading", UploadQueueStatus.Uploading);
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$pending", UploadQueueStatus.Pending);
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        command.Parameters.AddWithValue("$last_error", "重复 file_hash 旧上传队列记录已在迁移时忽略，保留同 hash 的优先记录。");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task NormalizeCorruptRowsAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        await NormalizeQueueStatusesAsync(connection, cancellationToken);
        await NormalizeRetryCountsAsync(connection, cancellationToken);
        await NormalizeFileSizesAsync(connection, cancellationToken);
    }

    private static async Task NormalizeQueueStatusesAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var normalizeKnownCommand = connection.CreateCommand();
        normalizeKnownCommand.CommandText = """
            UPDATE upload_queue
            SET status = lower(trim(CAST(status AS TEXT)))
            WHERE lower(trim(CAST(status AS TEXT))) IN (
                $pending,
                $hashing,
                $queued,
                $uploading,
                $uploaded,
                $failed,
                $duplicate,
                $ignored
            )
              AND status <> lower(trim(CAST(status AS TEXT)))
            """;
        BindStatusParameters(normalizeKnownCommand);
        await normalizeKnownCommand.ExecuteNonQueryAsync(cancellationToken);

        var invalidCommand = connection.CreateCommand();
        invalidCommand.CommandText = """
            UPDATE upload_queue
            SET status = $failed,
                last_error = CASE
                    WHEN last_error = '' THEN $last_error
                    ELSE last_error
                END
            WHERE lower(trim(CAST(status AS TEXT))) NOT IN (
                $pending,
                $hashing,
                $queued,
                $uploading,
                $uploaded,
                $failed,
                $duplicate,
                $ignored
            )
            """;
        BindStatusParameters(invalidCommand);
        invalidCommand.Parameters.AddWithValue("$last_error", "上传队列状态字段异常，已恢复为 failed，可由重试策略重新处理。");
        await invalidCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task NormalizeRetryCountsAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var numericTextCommand = connection.CreateCommand();
        numericTextCommand.CommandText = """
            UPDATE upload_queue
            SET retry_count = CAST(trim(CAST(retry_count AS TEXT)) AS INTEGER)
            WHERE typeof(retry_count) = 'text'
              AND trim(CAST(retry_count AS TEXT)) <> ''
              AND trim(CAST(retry_count AS TEXT)) NOT GLOB '*[^0-9]*'
              AND CAST(trim(CAST(retry_count AS TEXT)) AS INTEGER) <= $max_retry_count
            """;
        numericTextCommand.Parameters.AddWithValue("$max_retry_count", int.MaxValue);
        await numericTextCommand.ExecuteNonQueryAsync(cancellationToken);

        var invalidCommand = connection.CreateCommand();
        invalidCommand.CommandText = """
            UPDATE upload_queue
            SET retry_count = 0,
                last_error = CASE
                    WHEN last_error = '' THEN $last_error
                    ELSE last_error
                END
            WHERE retry_count IS NULL
               OR typeof(retry_count) NOT IN ('integer', 'real')
               OR retry_count < 0
               OR retry_count > $max_retry_count
            """;
        invalidCommand.Parameters.AddWithValue("$max_retry_count", int.MaxValue);
        invalidCommand.Parameters.AddWithValue("$last_error", "上传队列重试次数字段异常，已恢复为 0。");
        await invalidCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task NormalizeFileSizesAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var numericTextCommand = connection.CreateCommand();
        numericTextCommand.CommandText = """
            UPDATE upload_queue
            SET file_size = CAST(trim(CAST(file_size AS TEXT)) AS INTEGER)
            WHERE typeof(file_size) = 'text'
              AND trim(CAST(file_size AS TEXT)) <> ''
              AND trim(CAST(file_size AS TEXT)) NOT GLOB '*[^0-9]*'
            """;
        await numericTextCommand.ExecuteNonQueryAsync(cancellationToken);

        var invalidCommand = connection.CreateCommand();
        invalidCommand.CommandText = """
            UPDATE upload_queue
            SET file_size = 0,
                last_error = CASE
                    WHEN last_error = '' THEN $last_error
                    ELSE last_error
                END
            WHERE file_size IS NULL
               OR typeof(file_size) NOT IN ('integer', 'real')
               OR file_size < 0
            """;
        invalidCommand.Parameters.AddWithValue("$last_error", "上传队列文件大小字段异常，已恢复为 0。");
        await invalidCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void BindStatusParameters(SqliteCommand command)
    {
        command.Parameters.AddWithValue("$pending", UploadQueueStatus.Pending);
        command.Parameters.AddWithValue("$hashing", UploadQueueStatus.Hashing);
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$uploading", UploadQueueStatus.Uploading);
        command.Parameters.AddWithValue("$uploaded", UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        command.Parameters.AddWithValue("$duplicate", UploadQueueStatus.Duplicate);
        command.Parameters.AddWithValue("$ignored", UploadQueueStatus.Ignored);
    }

    private static async Task EnsureFileHashIndexAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        const string indexName = "idx_upload_queue_file_hash";

        var indexInfoCommand = connection.CreateCommand();
        indexInfoCommand.CommandText = """
            SELECT "unique", "partial"
            FROM pragma_index_list('upload_queue')
            WHERE name = $index_name
            LIMIT 1
            """;
        indexInfoCommand.Parameters.AddWithValue("$index_name", indexName);

        var shouldDrop = false;
        await using (var reader = await indexInfoCommand.ExecuteReaderAsync(cancellationToken))
        {
            if (await reader.ReadAsync(cancellationToken))
            {
                var isUnique = reader.GetInt32(0) == 1;
                var isPartial = reader.GetInt32(1) == 1;
                shouldDrop = !isUnique || !isPartial;
            }
        }

        if (shouldDrop)
        {
            var dropCommand = connection.CreateCommand();
            dropCommand.CommandText = $"DROP INDEX IF EXISTS {indexName}";
            await dropCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        var createCommand = connection.CreateCommand();
        createCommand.CommandText = """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_queue_file_hash
                ON upload_queue(file_hash)
                WHERE file_hash <> ''
                  AND status <> 'ignored';
            """;
        await createCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void BindItemParameters(SqliteCommand command, UploadQueueItem item)
    {
        command.Parameters.AddWithValue("$file_path", item.FilePath);
        command.Parameters.AddWithValue("$original_filename", item.OriginalFilename);
        command.Parameters.AddWithValue("$file_hash", item.FileHash);
        command.Parameters.AddWithValue("$file_size", item.FileSize);
        command.Parameters.AddWithValue("$mime_type", item.MimeType);
        command.Parameters.AddWithValue("$upload_source", item.UploadSource);
        command.Parameters.AddWithValue("$source_folder", item.SourceFolder);
        command.Parameters.AddWithValue("$device_id", item.DeviceId);
        command.Parameters.AddWithValue("$windows_username", item.WindowsUsername);
        command.Parameters.AddWithValue("$uploaded_by_user_id", item.UploadedByUserId);
        command.Parameters.AddWithValue("$uploaded_by_username", item.UploadedByUsername);
        command.Parameters.AddWithValue("$uploaded_by_role", item.UploadedByRole);
        command.Parameters.AddWithValue("$operator_source", item.OperatorSource);
        command.Parameters.AddWithValue("$status", item.Status);
        command.Parameters.AddWithValue("$retry_count", item.RetryCount);
        command.Parameters.AddWithValue("$last_error", item.LastError);
        command.Parameters.AddWithValue("$next_retry_at", item.NextRetryAt?.ToString("O") ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("$created_at", item.CreatedAt.ToString("O"));
        command.Parameters.AddWithValue("$uploaded_at", item.UploadedAt?.ToString("O") ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("$server_asset_id", item.ServerAssetId);
        command.Parameters.AddWithValue("$server_batch_id", item.ServerBatchId);
        command.Parameters.AddWithValue("$server_batch_no", item.ServerBatchNo);
        command.Parameters.AddWithValue("$server_processing_status", item.ServerProcessingStatus);
        command.Parameters.AddWithValue("$server_message", item.ServerMessage);
    }

    private static DateTimeOffset? ReadNullableDateTimeOffset(SqliteDataReader reader, int ordinal)
    {
        return ReadDateTimeOffsetOrDefault(reader, ordinal, null);
    }

    private static DateTimeOffset? ReadDateTimeOffsetOrDefault(
        SqliteDataReader reader,
        int ordinal,
        DateTimeOffset? fallback)
    {
        if (reader.IsDBNull(ordinal)) return fallback;

        var value = ReadStringOrDefault(reader, ordinal);
        if (string.IsNullOrWhiteSpace(value)) return fallback;

        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : fallback;
    }

    private static string ReadStringOrDefault(SqliteDataReader reader, int ordinal, string fallback = "")
    {
        if (reader.IsDBNull(ordinal)) return fallback;

        return reader.GetValue(ordinal)?.ToString() ?? fallback;
    }

    private static long ReadNonNegativeInt64OrDefault(SqliteDataReader reader, int ordinal, long fallback = 0)
    {
        if (reader.IsDBNull(ordinal)) return fallback;

        try
        {
            return reader.GetValue(ordinal) switch
            {
                long value when value >= 0 => value,
                int value when value >= 0 => value,
                short value when value >= 0 => value,
                byte value => value,
                double value when !double.IsNaN(value) && !double.IsInfinity(value) && value >= 0 => (long)value,
                float value when !float.IsNaN(value) && !float.IsInfinity(value) && value >= 0 => (long)value,
                decimal value when value >= 0 => (long)value,
                string value when long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
                    && parsed >= 0 => parsed,
                _ => fallback
            };
        }
        catch (OverflowException)
        {
            return fallback;
        }
        catch (FormatException)
        {
            return fallback;
        }
        catch (InvalidCastException)
        {
            return fallback;
        }
    }

    private static int ReadNonNegativeInt32OrDefault(SqliteDataReader reader, int ordinal, int fallback = 0)
    {
        var value = ReadNonNegativeInt64OrDefault(reader, ordinal, fallback);
        return value <= int.MaxValue ? (int)value : fallback;
    }

    private static string ReadQueueStatus(SqliteDataReader reader, int ordinal)
    {
        var status = ReadStringOrDefault(reader, ordinal, UploadQueueStatus.Failed).Trim().ToLowerInvariant();
        return KnownStatuses.Contains(status) ? status : UploadQueueStatus.Failed;
    }

    private static UploadQueueItem ReadItem(SqliteDataReader reader)
    {
        return new UploadQueueItem
        {
            Id = ReadNonNegativeInt64OrDefault(reader, reader.GetOrdinal("id")),
            FilePath = ReadStringOrDefault(reader, reader.GetOrdinal("file_path")),
            OriginalFilename = ReadStringOrDefault(reader, reader.GetOrdinal("original_filename")),
            FileHash = ReadStringOrDefault(reader, reader.GetOrdinal("file_hash")),
            FileSize = ReadNonNegativeInt64OrDefault(reader, reader.GetOrdinal("file_size")),
            MimeType = ReadStringOrDefault(reader, reader.GetOrdinal("mime_type")),
            UploadSource = ReadStringOrDefault(reader, reader.GetOrdinal("upload_source")),
            SourceFolder = ReadStringOrDefault(reader, reader.GetOrdinal("source_folder")),
            DeviceId = ReadStringOrDefault(reader, reader.GetOrdinal("device_id")),
            WindowsUsername = ReadStringOrDefault(reader, reader.GetOrdinal("windows_username")),
            UploadedByUserId = ReadStringOrDefault(reader, reader.GetOrdinal("uploaded_by_user_id")),
            UploadedByUsername = ReadStringOrDefault(reader, reader.GetOrdinal("uploaded_by_username")),
            UploadedByRole = ReadStringOrDefault(reader, reader.GetOrdinal("uploaded_by_role")),
            OperatorSource = ReadStringOrDefault(reader, reader.GetOrdinal("operator_source")),
            Status = ReadQueueStatus(reader, reader.GetOrdinal("status")),
            RetryCount = ReadNonNegativeInt32OrDefault(reader, reader.GetOrdinal("retry_count")),
            LastError = ReadStringOrDefault(reader, reader.GetOrdinal("last_error")),
            NextRetryAt = ReadNullableDateTimeOffset(reader, reader.GetOrdinal("next_retry_at")),
            CreatedAt = ReadDateTimeOffsetOrDefault(reader, reader.GetOrdinal("created_at"), DateTimeOffset.UnixEpoch)
                ?? DateTimeOffset.UnixEpoch,
            UploadedAt = ReadNullableDateTimeOffset(reader, reader.GetOrdinal("uploaded_at")),
            ServerAssetId = ReadStringOrDefault(reader, reader.GetOrdinal("server_asset_id")),
            ServerBatchId = ReadStringOrDefault(reader, reader.GetOrdinal("server_batch_id")),
            ServerBatchNo = ReadStringOrDefault(reader, reader.GetOrdinal("server_batch_no")),
            ServerProcessingStatus = ReadStringOrDefault(reader, reader.GetOrdinal("server_processing_status")),
            ServerMessage = ReadStringOrDefault(reader, reader.GetOrdinal("server_message"))
        };
    }
}
