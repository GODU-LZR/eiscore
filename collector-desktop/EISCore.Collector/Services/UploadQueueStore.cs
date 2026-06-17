using EISCore.Collector.Models;
using Microsoft.Data.Sqlite;

namespace EISCore.Collector.Services;

public sealed class UploadQueueStore
{
    private readonly string _connectionString = new SqliteConnectionStringBuilder
    {
        DataSource = AppPaths.DatabasePath,
        Mode = SqliteOpenMode.ReadWriteCreate
    }.ToString();

    public async Task EnsureCreatedAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
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
                device_id TEXT NOT NULL,
                uploaded_by_user_id TEXT NOT NULL,
                status TEXT NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                uploaded_at TEXT NULL,
                server_asset_id TEXT NOT NULL DEFAULT ''
            );

            CREATE INDEX IF NOT EXISTS idx_upload_queue_status_created
                ON upload_queue(status, created_at);

            CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_queue_file_hash
                ON upload_queue(file_hash);
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<UploadQueueItem?> FindByHashAsync(string fileHash, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = "SELECT * FROM upload_queue WHERE file_hash = $file_hash LIMIT 1";
        command.Parameters.AddWithValue("$file_hash", fileHash);
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
                device_id,
                uploaded_by_user_id,
                status,
                retry_count,
                last_error,
                created_at,
                uploaded_at,
                server_asset_id
            ) VALUES (
                $file_path,
                $original_filename,
                $file_hash,
                $file_size,
                $mime_type,
                $upload_source,
                $device_id,
                $uploaded_by_user_id,
                $status,
                $retry_count,
                $last_error,
                $created_at,
                $uploaded_at,
                $server_asset_id
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

    public async Task<UploadQueueItem?> GetNextPendingAsync(int maxRetryCount = 10, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM upload_queue
            WHERE status IN ($pending, $queued, $failed)
              AND retry_count < $max_retry_count
            ORDER BY created_at ASC
            LIMIT 1
            """;
        command.Parameters.AddWithValue("$pending", UploadQueueStatus.Pending);
        command.Parameters.AddWithValue("$queued", UploadQueueStatus.Queued);
        command.Parameters.AddWithValue("$failed", UploadQueueStatus.Failed);
        command.Parameters.AddWithValue("$max_retry_count", Math.Max(1, maxRetryCount));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadItem(reader) : null;
    }

    public async Task UpdateStatusAsync(
        long id,
        string status,
        string lastError = "",
        bool incrementRetry = false,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE upload_queue
            SET status = $status,
                last_error = $last_error,
                retry_count = retry_count + $retry_increment
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$status", status);
        command.Parameters.AddWithValue("$last_error", lastError);
        command.Parameters.AddWithValue("$retry_increment", incrementRetry ? 1 : 0);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task MarkUploadedAsync(
        long id,
        string serverAssetId,
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
                last_error = ''
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$status", duplicate ? UploadQueueStatus.Duplicate : UploadQueueStatus.Uploaded);
        command.Parameters.AddWithValue("$uploaded_at", DateTimeOffset.Now.ToString("O"));
        command.Parameters.AddWithValue("$server_asset_id", serverAssetId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<SqliteConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(AppPaths.RootDirectory);
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private static void BindItemParameters(SqliteCommand command, UploadQueueItem item)
    {
        command.Parameters.AddWithValue("$file_path", item.FilePath);
        command.Parameters.AddWithValue("$original_filename", item.OriginalFilename);
        command.Parameters.AddWithValue("$file_hash", item.FileHash);
        command.Parameters.AddWithValue("$file_size", item.FileSize);
        command.Parameters.AddWithValue("$mime_type", item.MimeType);
        command.Parameters.AddWithValue("$upload_source", item.UploadSource);
        command.Parameters.AddWithValue("$device_id", item.DeviceId);
        command.Parameters.AddWithValue("$uploaded_by_user_id", item.UploadedByUserId);
        command.Parameters.AddWithValue("$status", item.Status);
        command.Parameters.AddWithValue("$retry_count", item.RetryCount);
        command.Parameters.AddWithValue("$last_error", item.LastError);
        command.Parameters.AddWithValue("$created_at", item.CreatedAt.ToString("O"));
        command.Parameters.AddWithValue("$uploaded_at", item.UploadedAt?.ToString("O") ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("$server_asset_id", item.ServerAssetId);
    }

    private static UploadQueueItem ReadItem(SqliteDataReader reader)
    {
        return new UploadQueueItem
        {
            Id = reader.GetInt64(reader.GetOrdinal("id")),
            FilePath = reader.GetString(reader.GetOrdinal("file_path")),
            OriginalFilename = reader.GetString(reader.GetOrdinal("original_filename")),
            FileHash = reader.GetString(reader.GetOrdinal("file_hash")),
            FileSize = reader.GetInt64(reader.GetOrdinal("file_size")),
            MimeType = reader.GetString(reader.GetOrdinal("mime_type")),
            UploadSource = reader.GetString(reader.GetOrdinal("upload_source")),
            DeviceId = reader.GetString(reader.GetOrdinal("device_id")),
            UploadedByUserId = reader.GetString(reader.GetOrdinal("uploaded_by_user_id")),
            Status = reader.GetString(reader.GetOrdinal("status")),
            RetryCount = reader.GetInt32(reader.GetOrdinal("retry_count")),
            LastError = reader.GetString(reader.GetOrdinal("last_error")),
            CreatedAt = DateTimeOffset.Parse(reader.GetString(reader.GetOrdinal("created_at"))),
            UploadedAt = reader.IsDBNull(reader.GetOrdinal("uploaded_at"))
                ? null
                : DateTimeOffset.Parse(reader.GetString(reader.GetOrdinal("uploaded_at"))),
            ServerAssetId = reader.GetString(reader.GetOrdinal("server_asset_id"))
        };
    }
}
