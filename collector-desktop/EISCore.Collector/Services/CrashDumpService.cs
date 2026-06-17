using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace EISCore.Collector.Services;

public static class CrashDumpService
{
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
        Directory.CreateDirectory(AppPaths.CrashDumpDirectory);

        var timestamp = DateTimeOffset.Now;
        var safeSource = SanitizeToken(source);
        var baseName = $"{timestamp:yyyyMMdd-HHmmss-fff}-{safeSource}-{Environment.ProcessId}";
        var dumpPath = Path.Combine(AppPaths.CrashDumpDirectory, baseName + ".dmp");
        var manifestPath = Path.Combine(AppPaths.CrashDumpDirectory, baseName + ".json");
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
            dumpBytes = File.Exists(dumpPath) ? new FileInfo(dumpPath).Length : 0,
            dumpError
        };

        File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions
        {
            WriteIndented = true
        }));
        return manifestPath;
    }

    public static IReadOnlyList<string> ListUnreportedManifests()
    {
        if (!Directory.Exists(AppPaths.CrashDumpDirectory)) return Array.Empty<string>();
        return Directory
            .EnumerateFiles(AppPaths.CrashDumpDirectory, "*.json", SearchOption.TopDirectoryOnly)
            .Where(path => !File.Exists(path + ".reported"))
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .Take(50)
            .ToList();
    }

    public static void MarkReported(string manifestPath)
    {
        if (string.IsNullOrWhiteSpace(manifestPath) || !File.Exists(manifestPath)) return;
        File.WriteAllText(manifestPath + ".reported", DateTimeOffset.Now.ToString("O"));
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
}
