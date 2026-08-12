using Microsoft.Win32;

namespace EISCore.Collector.Services;

public static class StartupService
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "EISCoreCollector";
    public const string DefaultStartupArguments = "--minimized --from-startup";

    public static void SetEnabled(bool enabled)
    {
        SetEnabled(enabled, Environment.ProcessPath ?? "");
    }

    public static void SetEnabled(bool enabled, string executablePath)
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true)
            ?? Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true);

        if (enabled)
        {
            var command = BuildStartupRunCommand(executablePath);
            if (!string.IsNullOrWhiteSpace(command))
            {
                key.SetValue(ValueName, command);
            }
        }
        else
        {
            key.DeleteValue(ValueName, throwOnMissingValue: false);
        }
    }

    public static bool IsEnabled()
    {
        return IsEnabled(Environment.ProcessPath ?? "");
    }

    public static bool IsEnabled(string executablePath)
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: false);
        return key?.GetValue(ValueName) is string value
            && IsRunCommandForExecutable(value, executablePath);
    }

    public static string BuildRunCommand(string executablePath, string arguments = "")
    {
        var normalizedPath = (executablePath ?? "").Trim().Trim('"');
        if (string.IsNullOrWhiteSpace(normalizedPath)) return "";

        var normalizedArguments = (arguments ?? "").Trim();
        return string.IsNullOrWhiteSpace(normalizedArguments)
            ? $"\"{normalizedPath}\""
            : $"\"{normalizedPath}\" {normalizedArguments}";
    }

    public static string BuildStartupRunCommand(string executablePath)
    {
        return BuildRunCommand(executablePath, DefaultStartupArguments);
    }

    public static bool ShouldStartMinimized(IEnumerable<string>? arguments)
    {
        if (arguments is null) return false;

        foreach (var argument in arguments)
        {
            var normalized = (argument ?? "").Trim();
            if (normalized.Equals("--minimized", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("/minimized", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("--from-startup", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public static bool IsRunCommandForExecutable(string? command, string executablePath)
    {
        var expectedPath = (executablePath ?? "").Trim().Trim('"');
        if (string.IsNullOrWhiteSpace(command) || string.IsNullOrWhiteSpace(expectedPath))
        {
            return false;
        }

        var actualPath = ExtractExecutablePath(command);
        return string.Equals(actualPath, expectedPath, StringComparison.OrdinalIgnoreCase);
    }

    private static string ExtractExecutablePath(string command)
    {
        var trimmed = (command ?? "").Trim();
        if (string.IsNullOrEmpty(trimmed)) return "";

        if (trimmed.StartsWith('"'))
        {
            var closingQuote = trimmed.IndexOf('"', 1);
            return closingQuote > 1
                ? trimmed[1..closingQuote].Trim()
                : "";
        }

        var firstSpace = trimmed.IndexOf(' ');
        return firstSpace > 0
            ? trimmed[..firstSpace].Trim()
            : trimmed;
    }
}
