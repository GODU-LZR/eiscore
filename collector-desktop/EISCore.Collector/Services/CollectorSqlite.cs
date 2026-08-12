using Microsoft.Data.Sqlite;

namespace EISCore.Collector.Services;

public static class CollectorSqlite
{
    private const int BusyTimeoutMilliseconds = 5000;

    public static string ConnectionString => new SqliteConnectionStringBuilder
    {
        DataSource = AppPaths.DatabasePath,
        Mode = SqliteOpenMode.ReadWriteCreate
    }.ToString();

    public static async Task<SqliteConnection> OpenConnectionAsync(CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(AppPaths.RootDirectory);
        var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await ConfigureConnectionAsync(connection, cancellationToken);
        return connection;
    }

    public static async Task ConfigureDatabaseAsync(SqliteConnection connection, CancellationToken cancellationToken = default)
    {
        await ExecutePragmaAsync(connection, "PRAGMA journal_mode = WAL", cancellationToken);
        await ExecutePragmaAsync(connection, "PRAGMA synchronous = NORMAL", cancellationToken);
        await ExecutePragmaAsync(connection, $"PRAGMA busy_timeout = {BusyTimeoutMilliseconds}", cancellationToken);
    }

    private static async Task ConfigureConnectionAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await ExecutePragmaAsync(connection, $"PRAGMA busy_timeout = {BusyTimeoutMilliseconds}", cancellationToken);
    }

    private static async Task ExecutePragmaAsync(SqliteConnection connection, string commandText, CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.CommandText = commandText;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
