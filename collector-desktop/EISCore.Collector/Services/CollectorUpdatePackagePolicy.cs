namespace EISCore.Collector.Services;

public sealed record CollectorUpdatePackageState(
    bool IsValid,
    string Extension,
    string StatusMessage,
    string Reason);

public static class CollectorUpdatePackagePolicy
{
    private static readonly HashSet<string> DownloadableExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe",
        ".msi",
        ".zip"
    };

    private static readonly HashSet<string> InstallerExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe",
        ".msi"
    };

    public static CollectorUpdatePackageState Evaluate(Uri downloadUri, bool autoInstallRequested)
    {
        var extension = Path.GetExtension(downloadUri.LocalPath).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !DownloadableExtensions.Contains(extension))
        {
            return new CollectorUpdatePackageState(
                false,
                extension,
                "更新包类型不受支持。",
                "unsupported_package_extension");
        }

        if (autoInstallRequested && !InstallerExtensions.Contains(extension))
        {
            return new CollectorUpdatePackageState(
                false,
                extension,
                "自动安装只支持 EXE 或 MSI 安装包。",
                "unsupported_auto_install_package");
        }

        return new CollectorUpdatePackageState(true, extension, "", "");
    }
}
