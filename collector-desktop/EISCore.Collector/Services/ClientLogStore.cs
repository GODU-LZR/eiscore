using EISCore.Collector.Models;
using Microsoft.Data.Sqlite;

namespace EISCore.Collector.Services;

public sealed class ClientLogStore
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
            CREATE TABLE IF NOT EXISTS client_log_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                stack TEXT NOT NULL,
                device_id TEXT NOT NULL,
                device_name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                role TEXT NOT NULL,
                app_module TEXT NOT NULL,
                route TEXT NOT NULL,
                url TEXT NOT NULL,
                request_url TEXT NOT NULL,
                status_code INTEGER NULL,
                client_session_id TEXT NOT NULL,
                trace_id TEXT NOT NULL,
                ai_import_batch_id TEXT NOT NULL,
                source_file_hash TEXT NOT NULL,
                app_version TEXT NOT NULL,
                webview_version TEXT NOT NULL,
                created_at TEXT NOT NULL,
                metadata TEXT NOT NULL,
                uploaded INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_client_log_uploaded_created
                ON client_log_events(uploaded, created_at);
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<long> InsertAsync(ClientLogEvent logEvent, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO client_log_events (
                level,
                event_type,
                message,
                stack,
                device_id,
                device_name,
                user_id,
                username,
                role,
                app_module,
                route,
                url,
                request_url,
                status_code,
                client_session_id,
                trace_id,
                ai_import_batch_id,
                source_file_hash,
                app_version,
                webview_version,
                created_at,
                metadata,
                uploaded
            ) VALUES (
                $level,
                $event_type,
                $message,
                $stack,
                $device_id,
                $device_name,
                $user_id,
                $username,
                $role,
                $app_module,
                $route,
                $url,
                $request_url,
                $status_code,
                $client_session_id,
                $trace_id,
                $ai_import_batch_id,
                $source_file_hash,
                $app_version,
                $webview_version,
                $created_at,
                $metadata,
                0
            );
            SELECT last_insert_rowid();
            """;
        BindParameters(command, logEvent);
        return (long)(await command.ExecuteScalarAsync(cancellationToken) ?? 0L);
    }

    public async Task<IReadOnlyList<ClientLogEvent>> ListPendingAsync(int limit = 100, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM client_log_events
            WHERE uploaded = 0
            ORDER BY id ASC
            LIMIT $limit
            """;
        command.Parameters.AddWithValue("$limit", limit);

        var events = new List<ClientLogEvent>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            events.Add(ReadEvent(reader));
        }

        return events;
    }

    public async Task MarkUploadedAsync(IEnumerable<long> ids, CancellationToken cancellationToken = default)
    {
        var idList = ids.Distinct().ToList();
        if (idList.Count == 0) return;

        await using var connection = await OpenConnectionAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        foreach (var id in idList)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "UPDATE client_log_events SET uploaded = 1 WHERE id = $id";
            command.Parameters.AddWithValue("$id", id);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        transaction.Commit();
    }

    private async Task<SqliteConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(AppPaths.RootDirectory);
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private static void BindParameters(SqliteCommand command, ClientLogEvent logEvent)
    {
        command.Parameters.AddWithValue("$level", logEvent.Level);
        command.Parameters.AddWithValue("$event_type", logEvent.EventType);
        command.Parameters.AddWithValue("$message", logEvent.Message);
        command.Parameters.AddWithValue("$stack", logEvent.Stack);
        command.Parameters.AddWithValue("$device_id", logEvent.DeviceId);
        command.Parameters.AddWithValue("$device_name", logEvent.DeviceName);
        command.Parameters.AddWithValue("$user_id", logEvent.UserId);
        command.Parameters.AddWithValue("$username", logEvent.Username);
        command.Parameters.AddWithValue("$role", logEvent.Role);
        command.Parameters.AddWithValue("$app_module", logEvent.AppModule);
        command.Parameters.AddWithValue("$route", logEvent.Route);
        command.Parameters.AddWithValue("$url", logEvent.Url);
        command.Parameters.AddWithValue("$request_url", logEvent.RequestUrl);
        command.Parameters.AddWithValue("$status_code", logEvent.StatusCode ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("$client_session_id", logEvent.ClientSessionId);
        command.Parameters.AddWithValue("$trace_id", logEvent.TraceId);
        command.Parameters.AddWithValue("$ai_import_batch_id", logEvent.AiImportBatchId);
        command.Parameters.AddWithValue("$source_file_hash", logEvent.SourceFileHash);
        command.Parameters.AddWithValue("$app_version", logEvent.AppVersion);
        command.Parameters.AddWithValue("$webview_version", logEvent.WebViewVersion);
        command.Parameters.AddWithValue("$created_at", logEvent.CreatedAt.ToString("O"));
        command.Parameters.AddWithValue("$metadata", logEvent.MetadataJson);
    }

    private static ClientLogEvent ReadEvent(SqliteDataReader reader)
    {
        return new ClientLogEvent
        {
            Id = reader.GetInt64(reader.GetOrdinal("id")),
            Level = reader.GetString(reader.GetOrdinal("level")),
            EventType = reader.GetString(reader.GetOrdinal("event_type")),
            Message = reader.GetString(reader.GetOrdinal("message")),
            Stack = reader.GetString(reader.GetOrdinal("stack")),
            DeviceId = reader.GetString(reader.GetOrdinal("device_id")),
            DeviceName = reader.GetString(reader.GetOrdinal("device_name")),
            UserId = reader.GetString(reader.GetOrdinal("user_id")),
            Username = reader.GetString(reader.GetOrdinal("username")),
            Role = reader.GetString(reader.GetOrdinal("role")),
            AppModule = reader.GetString(reader.GetOrdinal("app_module")),
            Route = reader.GetString(reader.GetOrdinal("route")),
            Url = reader.GetString(reader.GetOrdinal("url")),
            RequestUrl = reader.GetString(reader.GetOrdinal("request_url")),
            StatusCode = reader.IsDBNull(reader.GetOrdinal("status_code"))
                ? null
                : reader.GetInt32(reader.GetOrdinal("status_code")),
            ClientSessionId = reader.GetString(reader.GetOrdinal("client_session_id")),
            TraceId = reader.GetString(reader.GetOrdinal("trace_id")),
            AiImportBatchId = reader.GetString(reader.GetOrdinal("ai_import_batch_id")),
            SourceFileHash = reader.GetString(reader.GetOrdinal("source_file_hash")),
            AppVersion = reader.GetString(reader.GetOrdinal("app_version")),
            WebViewVersion = reader.GetString(reader.GetOrdinal("webview_version")),
            CreatedAt = DateTimeOffset.Parse(reader.GetString(reader.GetOrdinal("created_at"))),
            MetadataJson = reader.GetString(reader.GetOrdinal("metadata"))
        };
    }
}
