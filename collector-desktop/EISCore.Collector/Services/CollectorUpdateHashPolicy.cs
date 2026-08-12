namespace EISCore.Collector.Services;

public sealed record CollectorUpdateHashState(bool IsValid, string NormalizedSha256, string StatusMessage, string Reason);

public static class CollectorUpdateHashPolicy
{
    public static CollectorUpdateHashState EvaluateSha256(string? sha256)
    {
        var value = (sha256 ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(value))
        {
            return new CollectorUpdateHashState(false, "", "更新 manifest 缺少 SHA256。", "missing_sha256");
        }

        if (value.Length != 64 || !value.All(IsHex))
        {
            return new CollectorUpdateHashState(false, value, "更新 manifest 的 SHA256 格式无效。", "invalid_sha256");
        }

        return new CollectorUpdateHashState(true, value, "", "");
    }

    private static bool IsHex(char ch)
    {
        return ch is >= '0' and <= '9' or >= 'a' and <= 'f';
    }
}
