using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class WatchFolderDisplayPolicy
{
    public static string Format(
        WatchFolderConfig folder,
        int index,
        Func<string, bool>? directoryExists = null,
        Func<string, bool>? directoryAccessible = null)
    {
        directoryExists ??= Directory.Exists;
        directoryAccessible ??= WatchFolderHealthPolicy.CanAccessDirectory;
        var folderPath = (folder.FolderPath ?? "").Trim();
        var status = ResolveStatus(folder, folderPath, directoryExists, directoryAccessible);
        var name = string.IsNullOrWhiteSpace(folder.FolderName)
            ? GetFolderDisplayName(folderPath)
            : folder.FolderName.Trim();
        var owner = string.Join(" / ", new[] { folder.DefaultUserId, folder.DefaultUsername, folder.DefaultRole }
            .Select(item => (item ?? "").Trim())
            .Where(item => !string.IsNullOrWhiteSpace(item)));
        var suffix = string.IsNullOrWhiteSpace(owner) ? "" : $"  默认：{owner}";
        var path = string.IsNullOrWhiteSpace(folderPath) ? "未配置路径" : folderPath;

        return $"{index + 1}. [{status}] {name}  {path}{suffix}";
    }

    private static string ResolveStatus(
        WatchFolderConfig folder,
        string folderPath,
        Func<string, bool> directoryExists,
        Func<string, bool> directoryAccessible)
    {
        if (!folder.Enabled) return "停用";
        if (string.IsNullOrWhiteSpace(folderPath)) return "缺失";
        if (!directoryExists(folderPath)) return "缺失";
        return directoryAccessible(folderPath) ? "启用" : "不可访问";
    }

    private static string GetFolderDisplayName(string folderPath)
    {
        if (string.IsNullOrWhiteSpace(folderPath)) return "未配置目录";

        var trimmed = folderPath.TrimEnd('\\', '/', Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var lastSeparator = Math.Max(trimmed.LastIndexOf('\\'), trimmed.LastIndexOf('/'));
        return lastSeparator >= 0 && lastSeparator < trimmed.Length - 1
            ? trimmed[(lastSeparator + 1)..]
            : trimmed;
    }
}
