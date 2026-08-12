namespace EISCore.Collector.Services;

public sealed record CollectorUpdateUrlState(
    bool IsValid,
    Uri? Uri,
    string StatusMessage,
    string Reason);

public static class CollectorUpdateUrlPolicy
{
    public static CollectorUpdateUrlState EvaluateManifestUrl(string? url)
    {
        return Evaluate(url, "missing_manifest_url", "invalid_manifest_url", "请先配置更新 manifest 地址。");
    }

    public static CollectorUpdateUrlState EvaluateDownloadUrl(string? url)
    {
        return Evaluate(url, "missing_download_url", "invalid_download_url", "更新 manifest 缺少下载地址。");
    }

    private static CollectorUpdateUrlState Evaluate(
        string? url,
        string missingReason,
        string invalidReason,
        string missingMessage)
    {
        var input = (url ?? "").Trim();
        if (string.IsNullOrWhiteSpace(input))
        {
            return new CollectorUpdateUrlState(false, null, missingMessage, missingReason);
        }

        if (!Uri.TryCreate(input, UriKind.Absolute, out var uri)
            || string.IsNullOrWhiteSpace(uri.Host)
            || uri.Scheme is not ("http" or "https"))
        {
            return new CollectorUpdateUrlState(
                false,
                null,
                "更新地址必须是 http/https 绝对地址。",
                invalidReason);
        }

        return new CollectorUpdateUrlState(true, uri, "", "");
    }
}
