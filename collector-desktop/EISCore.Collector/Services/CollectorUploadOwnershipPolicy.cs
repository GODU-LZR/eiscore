using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class CollectorUploadOwnershipPolicy
{
    public static UploadOwnership Resolve(
        string uploadSource,
        AppConfig config,
        WatchFolderConfig? watchFolder = null,
        UploadOwnerContext? webOwner = null)
    {
        var isWatchFolder = string.Equals(uploadSource, "watch_folder", StringComparison.OrdinalIgnoreCase);
        var folderOwner = isWatchFolder ? watchFolder : null;
        var hasFolderOwner = folderOwner is not null
            && (!string.IsNullOrWhiteSpace(folderOwner.DefaultUserId)
                || !string.IsNullOrWhiteSpace(folderOwner.DefaultUsername)
                || !string.IsNullOrWhiteSpace(folderOwner.DefaultRole));
        var hasWebOwner = !isWatchFolder && webOwner?.HasIdentity == true;
        var hasDeviceDefaultOwner = HasAny(config.DefaultUserId, config.DefaultUsername);

        return new UploadOwnership
        {
            UploadedByUserId = FirstNonEmpty(folderOwner?.DefaultUserId, hasWebOwner ? webOwner?.UserId : null, config.DefaultUserId),
            UploadedByUsername = FirstNonEmpty(folderOwner?.DefaultUsername, hasWebOwner ? webOwner?.Username : null, config.DefaultUsername),
            UploadedByRole = FirstNonEmpty(folderOwner?.DefaultRole, hasWebOwner ? webOwner?.Role : null, config.DefaultRole),
            OperatorSource = ResolveOperatorSource(uploadSource, isWatchFolder, hasFolderOwner, hasWebOwner, hasDeviceDefaultOwner)
        };
    }

    private static string ResolveOperatorSource(
        string uploadSource,
        bool isWatchFolder,
        bool hasFolderOwner,
        bool hasWebOwner,
        bool hasDeviceDefaultOwner)
    {
        if (isWatchFolder && hasFolderOwner)
        {
            return "folder_binding_user";
        }

        if (hasWebOwner)
        {
            return "web_login_user";
        }

        if (!hasDeviceDefaultOwner)
        {
            return "unknown";
        }

        if (string.Equals(uploadSource, "manual_selected_file", StringComparison.OrdinalIgnoreCase))
        {
            return "manual_selected_user";
        }

        return "device_default_user";
    }

    private static bool HasAny(params string?[] values)
    {
        return values.Any(value => !string.IsNullOrWhiteSpace(value));
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return "";
    }
}
