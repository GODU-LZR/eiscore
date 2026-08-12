namespace EISCore.Collector.Services;

public static class CollectorFileIgnorePolicy
{
    private static readonly HashSet<string> TemporaryExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".tmp",
        ".temp",
        ".part",
        ".partial",
        ".download",
        ".crdownload"
    };

    public static bool ShouldIgnore(string filePath, out string reason)
    {
        var fileName = Path.GetFileName(filePath ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(fileName))
        {
            reason = "missing_filename";
            return true;
        }

        if (fileName.StartsWith("~$", StringComparison.Ordinal))
        {
            reason = "office_lock_file";
            return true;
        }

        if (TemporaryExtensions.Contains(Path.GetExtension(fileName)))
        {
            reason = "temporary_extension";
            return true;
        }

        reason = string.Empty;
        return false;
    }
}
