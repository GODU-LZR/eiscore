using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class CollectorRemoteWatchFolderPolicy
{
    public static List<WatchFolderConfig> NormalizeRemoteFolders(
        IEnumerable<WatchFolderConfig>? remoteFolders,
        AppConfig config)
    {
        var normalizedFolders = new List<WatchFolderConfig>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in remoteFolders ?? Enumerable.Empty<WatchFolderConfig>())
        {
            var folderPath = ConfigurationService.NormalizeText(item.FolderPath, 1024);
            if (string.IsNullOrWhiteSpace(folderPath) || !seen.Add(ConfigurationService.NormalizeWatchFolderKey(folderPath)))
            {
                continue;
            }

            var folderName = ConfigurationService.NormalizeText(
                string.IsNullOrWhiteSpace(item.FolderName) ? GetFolderDisplayName(folderPath) : item.FolderName,
                120);
            var defaultUserId = ConfigurationService.NormalizeText(
                string.IsNullOrWhiteSpace(item.DefaultUserId) ? config.DefaultUserId : item.DefaultUserId,
                128);
            var defaultUsername = ConfigurationService.NormalizeText(
                string.IsNullOrWhiteSpace(item.DefaultUsername) ? config.DefaultUsername : item.DefaultUsername,
                120);
            var defaultRole = ConfigurationService.NormalizeText(
                string.IsNullOrWhiteSpace(item.DefaultRole) ? config.DefaultRole : item.DefaultRole,
                80);

            normalizedFolders.Add(new WatchFolderConfig
            {
                FolderPath = folderPath,
                FolderName = folderName,
                DefaultUserId = defaultUserId,
                DefaultUsername = defaultUsername,
                DefaultRole = defaultRole,
                Enabled = item.Enabled
            });
        }

        return normalizedFolders;
    }

    public static bool AreEqual(IReadOnlyList<WatchFolderConfig> left, IReadOnlyList<WatchFolderConfig> right)
    {
        if (left.Count != right.Count) return false;
        return left.Zip(right).All(pair =>
            string.Equals(pair.First.FolderPath, pair.Second.FolderPath, StringComparison.OrdinalIgnoreCase)
            && string.Equals(pair.First.FolderName, pair.Second.FolderName, StringComparison.Ordinal)
            && string.Equals(pair.First.DefaultUserId, pair.Second.DefaultUserId, StringComparison.Ordinal)
            && string.Equals(pair.First.DefaultUsername, pair.Second.DefaultUsername, StringComparison.Ordinal)
            && string.Equals(pair.First.DefaultRole, pair.Second.DefaultRole, StringComparison.Ordinal)
            && pair.First.Enabled == pair.Second.Enabled);
    }

    private static string GetFolderDisplayName(string folderPath)
    {
        var trimmed = (folderPath ?? "").Trim()
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar, '\\', '/');
        var separatorIndex = Math.Max(trimmed.LastIndexOf('\\'), trimmed.LastIndexOf('/'));
        if (separatorIndex >= 0 && separatorIndex < trimmed.Length - 1)
        {
            return trimmed[(separatorIndex + 1)..];
        }

        return Path.GetFileName(trimmed) is { Length: > 0 } name ? name : trimmed;
    }
}
