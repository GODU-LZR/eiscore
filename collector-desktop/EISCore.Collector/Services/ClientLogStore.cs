using EISCore.Collector.Models;
using Microsoft.Data.Sqlite;
using System.Globalization;

namespace EISCore.Collector.Services;

public sealed class ClientLogStore
{
    public async Task EnsureCreatedAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await CollectorSqlite.ConfigureDatabaseAsync(connection, cancellationToken);
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
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);

        await AddColumnIfMissingAsync(connection, "level", "TEXT NOT NULL DEFAULT 'info'", cancellationToken);
        await AddColumnIfMissingAsync(connection, "event_type", "TEXT NOT NULL DEFAULT 'collector_event'", cancellationToken);
        await AddColumnIfMissingAsync(connection, "message", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "stack", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "device_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "device_name", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "user_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "username", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "role", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "app_module", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "route", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "url", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "request_url", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "status_code", "INTEGER NULL", cancellationToken);
        await AddColumnIfMissingAsync(connection, "client_session_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "trace_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "ai_import_batch_id", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "source_file_hash", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "app_version", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "webview_version", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(connection, "created_at", "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.0000000+00:00'", cancellationToken);
        await AddColumnIfMissingAsync(connection, "metadata", "TEXT NOT NULL DEFAULT '{}'", cancellationToken);
        await AddColumnIfMissingAsync(connection, "uploaded", "INTEGER NOT NULL DEFAULT 0", cancellationToken);

        await NormalizeCorruptRowsAsync(connection, cancellationToken);

        var indexCommand = connection.CreateCommand();
        indexCommand.CommandText = """
            CREATE INDEX IF NOT EXISTS idx_client_log_uploaded_created
                ON client_log_events(uploaded, created_at);
            """;
        await indexCommand.ExecuteNonQueryAsync(cancellationToken);

        var eventIndexCommand = connection.CreateCommand();
        eventIndexCommand.CommandText = """
            CREATE INDEX IF NOT EXISTS idx_client_log_event_created
                ON client_log_events(event_type, created_at);
            """;
        await eventIndexCommand.ExecuteNonQueryAsync(cancellationToken);
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

    public async Task<int> CountPendingAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = "SELECT count(*) FROM client_log_events WHERE uploaded = 0";
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    public async Task<(DateTimeOffset? LastLogCreatedAt, DateTimeOffset? OldestPendingLogCreatedAt, DateTimeOffset? LastUploadedLogCreatedAt)> GetTimeWatermarksAsync(
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                (
                    SELECT created_at
                    FROM client_log_events
                    ORDER BY julianday(created_at) DESC, id DESC
                    LIMIT 1
                ) AS last_log_created_at,
                (
                    SELECT created_at
                    FROM client_log_events
                    WHERE uploaded = 0
                    ORDER BY julianday(created_at) ASC, id ASC
                    LIMIT 1
                ) AS oldest_pending_log_created_at,
                (
                    SELECT created_at
                    FROM client_log_events
                    WHERE uploaded = 1
                    ORDER BY julianday(created_at) DESC, id DESC
                    LIMIT 1
                ) AS last_uploaded_log_created_at
            """;

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

    public async Task<int> CountTemporaryFileIgnoredSinceAsync(
        DateTimeOffset since,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT count(*) FROM client_log_events
            WHERE event_type = 'file_ignored'
              AND julianday(created_at) >= julianday($since)
              AND (
                  metadata LIKE '%"ignore_reason":"office_lock_file"%'
                  OR metadata LIKE '%"ignore_reason":"temporary_extension"%'
              )
            """;
        command.Parameters.AddWithValue("$since", since.ToString("O"));
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    public async Task<(string Status, DateTimeOffset? LastOfflineAt, DateTimeOffset? LastOnlineAt)> GetUploadConnectivitySnapshotAsync(
        CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                (
                    SELECT event_type
                    FROM client_log_events
                    WHERE event_type IN ($offline, $online)
                    ORDER BY julianday(created_at) DESC, id DESC
                    LIMIT 1
                ) AS latest_event_type,
                (
                    SELECT created_at
                    FROM client_log_events
                    WHERE event_type = $offline
                    ORDER BY julianday(created_at) DESC, id DESC
                    LIMIT 1
                ) AS last_offline_at,
                (
                    SELECT created_at
                    FROM client_log_events
                    WHERE event_type = $online
                    ORDER BY julianday(created_at) DESC, id DESC
                    LIMIT 1
                ) AS last_online_at
            """;
        command.Parameters.AddWithValue("$offline", "upload_connectivity_offline");
        command.Parameters.AddWithValue("$online", "upload_connectivity_online");

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return ("unknown", null, null);
        }

        var latestEventType = reader.IsDBNull(0) ? "" : reader.GetString(0);
        var status = latestEventType switch
        {
            "upload_connectivity_offline" => "offline",
            "upload_connectivity_online" => "online",
            _ => "unknown"
        };

        return (status, ReadNullableDateTimeOffset(reader, 1), ReadNullableDateTimeOffset(reader, 2));
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

    public async Task<int> DeleteUploadedBeforeAsync(DateTimeOffset cutoff, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM client_log_events
            WHERE uploaded = 1
              AND created_at < $cutoff
            """;
        command.Parameters.AddWithValue("$cutoff", cutoff.ToString("O"));
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<int> DeletePendingBeforeAsync(DateTimeOffset cutoff, CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM client_log_events
            WHERE uploaded = 0
              AND created_at < $cutoff
            """;
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
            FROM pragma_table_info('client_log_events')
            WHERE name = $column_name
            LIMIT 1
            """;
        existsCommand.Parameters.AddWithValue("$column_name", columnName);
        var exists = await existsCommand.ExecuteScalarAsync(cancellationToken);
        if (exists is not null) return;

        var alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE client_log_events ADD COLUMN {columnName} {definition}";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
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

    private static async Task NormalizeCorruptRowsAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        await NormalizeUploadedFlagsAsync(connection, cancellationToken);
        await NormalizeStatusCodesAsync(connection, cancellationToken);
        await NormalizeMetadataAsync(connection, cancellationToken);
    }

    private static async Task NormalizeUploadedFlagsAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE client_log_events
            SET uploaded = CASE
                WHEN uploaded = 1 THEN 1
                WHEN lower(trim(CAST(uploaded AS TEXT))) IN ('1', 'true', 'yes') THEN 1
                ELSE 0
            END
            WHERE uploaded IS NULL
               OR typeof(uploaded) <> 'integer'
               OR uploaded NOT IN (0, 1)
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task NormalizeStatusCodesAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var numericTextCommand = connection.CreateCommand();
        numericTextCommand.CommandText = """
            UPDATE client_log_events
            SET status_code = CAST(trim(CAST(status_code AS TEXT)) AS INTEGER)
            WHERE typeof(status_code) = 'text'
              AND trim(CAST(status_code AS TEXT)) <> ''
              AND trim(CAST(status_code AS TEXT)) NOT GLOB '*[^0-9]*'
              AND CAST(trim(CAST(status_code AS TEXT)) AS INTEGER) BETWEEN 0 AND 999
            """;
        await numericTextCommand.ExecuteNonQueryAsync(cancellationToken);

        var invalidCommand = connection.CreateCommand();
        invalidCommand.CommandText = """
            UPDATE client_log_events
            SET status_code = NULL
            WHERE status_code IS NOT NULL
              AND (
                  typeof(status_code) NOT IN ('integer', 'real')
                  OR status_code < 0
                  OR status_code > 999
              )
            """;
        await invalidCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task NormalizeMetadataAsync(
        SqliteConnection connection,
        CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE client_log_events
            SET metadata = '{}'
            WHERE metadata IS NULL
               OR trim(CAST(metadata AS TEXT)) = ''
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static ClientLogEvent ReadEvent(SqliteDataReader reader)
    {
        return new ClientLogEvent
        {
            Id = ReadNonNegativeInt64OrDefault(reader, reader.GetOrdinal("id")),
            Level = ReadStringOrDefault(reader, reader.GetOrdinal("level"), "info"),
            EventType = ReadStringOrDefault(reader, reader.GetOrdinal("event_type"), "collector_event"),
            Message = ReadStringOrDefault(reader, reader.GetOrdinal("message")),
            Stack = ReadStringOrDefault(reader, reader.GetOrdinal("stack")),
            DeviceId = ReadStringOrDefault(reader, reader.GetOrdinal("device_id")),
            DeviceName = ReadStringOrDefault(reader, reader.GetOrdinal("device_name")),
            UserId = ReadStringOrDefault(reader, reader.GetOrdinal("user_id")),
            Username = ReadStringOrDefault(reader, reader.GetOrdinal("username")),
            Role = ReadStringOrDefault(reader, reader.GetOrdinal("role")),
            AppModule = ReadStringOrDefault(reader, reader.GetOrdinal("app_module")),
            Route = ReadStringOrDefault(reader, reader.GetOrdinal("route")),
            Url = ReadStringOrDefault(reader, reader.GetOrdinal("url")),
            RequestUrl = ReadStringOrDefault(reader, reader.GetOrdinal("request_url")),
            StatusCode = ReadNullableInt32InRange(reader, reader.GetOrdinal("status_code"), 0, 999),
            ClientSessionId = ReadStringOrDefault(reader, reader.GetOrdinal("client_session_id")),
            TraceId = ReadStringOrDefault(reader, reader.GetOrdinal("trace_id")),
            AiImportBatchId = ReadStringOrDefault(reader, reader.GetOrdinal("ai_import_batch_id")),
            SourceFileHash = ReadStringOrDefault(reader, reader.GetOrdinal("source_file_hash")),
            AppVersion = ReadStringOrDefault(reader, reader.GetOrdinal("app_version")),
            WebViewVersion = ReadStringOrDefault(reader, reader.GetOrdinal("webview_version")),
            CreatedAt = ReadDateTimeOffsetOrDefault(reader, reader.GetOrdinal("created_at"), DateTimeOffset.UnixEpoch)
                ?? DateTimeOffset.UnixEpoch,
            MetadataJson = ReadMetadataJson(reader, reader.GetOrdinal("metadata"))
        };
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
        if (reader.IsDBNull(ordinal))
        {
            return fallback;
        }

        var value = ReadStringOrDefault(reader, ordinal);
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }

        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : fallback;
    }

    private static string ReadStringOrDefault(SqliteDataReader reader, int ordinal, string fallback = "")
    {
        if (reader.IsDBNull(ordinal)) return fallback;

        var value = reader.GetValue(ordinal)?.ToString();
        return string.IsNullOrEmpty(value) ? fallback : value;
    }

    private static string ReadMetadataJson(SqliteDataReader reader, int ordinal)
    {
        var value = ReadStringOrDefault(reader, ordinal, "{}");
        return string.IsNullOrWhiteSpace(value) ? "{}" : value;
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

    private static int? ReadNullableInt32InRange(SqliteDataReader reader, int ordinal, int min, int max)
    {
        if (reader.IsDBNull(ordinal)) return null;

        try
        {
            var value = reader.GetValue(ordinal) switch
            {
                int intValue => intValue,
                long longValue when longValue >= int.MinValue && longValue <= int.MaxValue => (int)longValue,
                short shortValue => shortValue,
                byte byteValue => byteValue,
                double doubleValue when !double.IsNaN(doubleValue)
                    && !double.IsInfinity(doubleValue)
                    && doubleValue >= int.MinValue
                    && doubleValue <= int.MaxValue => (int)doubleValue,
                float floatValue when !float.IsNaN(floatValue)
                    && !float.IsInfinity(floatValue)
                    && floatValue >= int.MinValue
                    && floatValue <= int.MaxValue => (int)floatValue,
                decimal decimalValue when decimalValue >= int.MinValue && decimalValue <= int.MaxValue => (int)decimalValue,
                string stringValue when int.TryParse(stringValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) => parsed,
                _ => (int?)null
            };

            return value is >= 0 && value >= min && value <= max ? value : null;
        }
        catch (OverflowException)
        {
            return null;
        }
        catch (FormatException)
        {
            return null;
        }
        catch (InvalidCastException)
        {
            return null;
        }
    }
}
