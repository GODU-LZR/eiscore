using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace EISCore.Collector.Services;

public static class CrashDumpService
{
    private const int MaxPruneBatchSize = 500;

    [Flags]
    private enum MinidumpType : uint
    {
        MiniDumpNormal = 0x00000000,
        MiniDumpWithDataSegs = 0x00000001,
        MiniDumpWithHandleData = 0x00000004,
        MiniDumpWithUnloadedModules = 0x00000020,
        MiniDumpWithThreadInfo = 0x00001000
    }

    [DllImport("dbghelp.dll", SetLastError = true)]
    private static extern bool MiniDumpWriteDump(
        IntPtr hProcess,
        int processId,
        IntPtr hFile,
        MinidumpType dumpType,
        IntPtr exceptionParam,
        IntPtr userStreamParam,
        IntPtr callbackParam);

    public static string WriteCrashReport(Exception exception, string source, bool isTerminating)
    {
        try
        {
            var crashDumpDirectory = AppPaths.CrashDumpDirectory;
            var timestamp = DateTimeOffset.Now;
            var safeSource = SanitizeToken(source);
            var baseName = $"{timestamp:yyyyMMdd-HHmmss-fff}-{safeSource}-{Environment.ProcessId}";
            var dumpPath = Path.Combine(crashDumpDirectory, baseName + ".dmp");
            var manifestPath = Path.Combine(crashDumpDirectory, baseName + ".json");
            string dumpError = "";

            try
            {
                WriteMiniDump(dumpPath);
            }
            catch (Exception dumpException)
            {
                dumpError = dumpException.Message;
            }

            var manifest = new
            {
                source,
                isTerminating,
                createdAt = timestamp,
                processId = Environment.ProcessId,
                machineName = Environment.MachineName,
                windowsUser = Environment.UserDomainName + "\\" + Environment.UserName,
                appVersion = typeof(CrashDumpService).Assembly.GetName().Version?.ToString() ?? "",
                exceptionType = exception.GetType().FullName ?? exception.GetType().Name,
                message = ClientLogService.Sanitize(exception.Message),
                stack = ClientLogService.Sanitize(exception.ToString()),
                dumpPath = File.Exists(dumpPath) ? dumpPath : "",
                dumpBytes = GetFileLengthOrDefault(dumpPath),
                dumpError
            };

            File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions
            {
                WriteIndented = true
            }));
            return manifestPath;
        }
        catch
        {
            return "";
        }
    }

    public static IReadOnlyList<string> ListUnreportedManifests()
    {
        try
        {
            var crashDumpDirectory = AppPaths.CrashDumpDirectory;
            if (!Directory.Exists(crashDumpDirectory)) return Array.Empty<string>();
            return Directory
                .EnumerateFiles(crashDumpDirectory, "*.json", SearchOption.TopDirectoryOnly)
                .Where(path => !File.Exists(path + ".reported"))
                .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                .Take(50)
                .ToList();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    public static void MarkReported(string manifestPath)
    {
        if (string.IsNullOrWhiteSpace(manifestPath) || !File.Exists(manifestPath)) return;
        try
        {
            File.WriteAllText(manifestPath + ".reported", DateTimeOffset.Now.ToString("O"));
        }
        catch
        {
            // Crash reporting is best-effort; a missing marker only means the report may be retried later.
        }
    }

    public static int PruneReportedReports(DateTimeOffset cutoff, int maxReports = MaxPruneBatchSize)
    {
        var deleted = 0;
        var limit = Math.Clamp(maxReports, 1, MaxPruneBatchSize);
        IReadOnlyList<string> manifestPaths;
        try
        {
            var crashDumpDirectory = AppPaths.CrashDumpDirectory;
            if (!Directory.Exists(crashDumpDirectory)) return 0;
            manifestPaths = Directory
                .EnumerateFiles(crashDumpDirectory, "*.json", SearchOption.TopDirectoryOnly)
                .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                .Take(limit)
                .ToList();
        }
        catch
        {
            return 0;
        }

        foreach (var manifestPath in manifestPaths)
        {
            try
            {
                if (!File.Exists(manifestPath + ".reported")) continue;
                if (!IsReportBefore(manifestPath, cutoff)) continue;

                DeleteReportFiles(manifestPath);
                deleted++;
            }
            catch
            {
                // Crash dump retention is best-effort and must not block collector startup.
            }
        }

        return deleted;
    }

    public static (
        int PendingReportCount,
        int ReportedReportCount,
        DateTimeOffset? OldestPendingReportCreatedAt,
        DateTimeOffset? LastReportCreatedAt,
        long? DirectoryBytes) GetHealthSnapshot()
    {
        if (!Directory.Exists(AppPaths.CrashDumpDirectory))
        {
            return (0, 0, null, null, 0);
        }

        try
        {
            var pendingCount = 0;
            var reportedCount = 0;
            DateTimeOffset? oldestPending = null;
            DateTimeOffset? lastReport = null;

            foreach (var manifestPath in Directory.EnumerateFiles(AppPaths.CrashDumpDirectory, "*.json", SearchOption.TopDirectoryOnly))
            {
                try
                {
                    var createdAt = ReadReportCreatedAt(manifestPath);
                    if (lastReport is null || createdAt > lastReport)
                    {
                        lastReport = createdAt;
                    }

                    if (File.Exists(manifestPath + ".reported"))
                    {
                        reportedCount++;
                    }
                    else
                    {
                        pendingCount++;
                        if (oldestPending is null || createdAt < oldestPending)
                        {
                            oldestPending = createdAt;
                        }
                    }
                }
                catch
                {
                    // Individual bad or disappearing manifests should not fail heartbeat health.
                }
            }

            return (pendingCount, reportedCount, oldestPending, lastReport, GetDirectoryBytes());
        }
        catch
        {
            return (0, 0, null, null, null);
        }
    }

    private static void WriteMiniDump(string dumpPath)
    {
        using var process = Process.GetCurrentProcess();
        using var stream = new FileStream(dumpPath, FileMode.Create, FileAccess.Write, FileShare.None);
        var dumpType = MinidumpType.MiniDumpWithHandleData
            | MinidumpType.MiniDumpWithUnloadedModules
            | MinidumpType.MiniDumpWithThreadInfo
            | MinidumpType.MiniDumpWithDataSegs;

        if (!MiniDumpWriteDump(
            process.Handle,
            process.Id,
            stream.SafeFileHandle.DangerousGetHandle(),
            dumpType,
            IntPtr.Zero,
            IntPtr.Zero,
            IntPtr.Zero))
        {
            throw new InvalidOperationException($"MiniDumpWriteDump failed: {Marshal.GetLastWin32Error()}");
        }
    }

    private static string SanitizeToken(string value)
    {
        var raw = string.IsNullOrWhiteSpace(value) ? "unknown" : value;
        var safe = new string(raw.Select(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-').ToArray());
        return safe.Trim('-').Length > 0 ? safe.Trim('-') : "unknown";
    }

    private static bool IsReportBefore(string manifestPath, DateTimeOffset cutoff)
    {
        var createdAt = ReadReportCreatedAt(manifestPath);
        return createdAt < cutoff;
    }

    private static DateTimeOffset ReadReportCreatedAt(string manifestPath)
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
            if (doc.RootElement.TryGetProperty("createdAt", out var createdAtElement)
                && createdAtElement.ValueKind == JsonValueKind.String
                && DateTimeOffset.TryParse(createdAtElement.GetString(), out var createdAt))
            {
                return createdAt;
            }
        }
        catch
        {
        }

        return File.GetLastWriteTimeUtc(manifestPath);
    }

    private static void DeleteReportFiles(string manifestPath)
    {
        var dumpPath = Path.ChangeExtension(manifestPath, ".dmp");
        TryDeleteFile(dumpPath);
        TryDeleteFile(manifestPath + ".reported");
        TryDeleteFile(manifestPath);
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // Crash dump cleanup should never block collector startup.
        }
    }

    private static long GetDirectoryBytes()
    {
        long bytes = 0;
        foreach (var path in Directory.EnumerateFiles(AppPaths.CrashDumpDirectory, "*", SearchOption.TopDirectoryOnly))
        {
            try
            {
                bytes += new FileInfo(path).Length;
            }
            catch
            {
                // Best-effort storage metric only.
            }
        }

        return bytes;
    }

    private static long GetFileLengthOrDefault(string path)
    {
        try
        {
            return File.Exists(path) ? new FileInfo(path).Length : 0;
        }
        catch
        {
            return 0;
        }
    }
}
