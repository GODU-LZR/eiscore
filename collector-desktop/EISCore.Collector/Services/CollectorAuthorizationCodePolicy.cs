namespace EISCore.Collector.Services;

public static class CollectorAuthorizationCodePolicy
{
    public static string Normalize(string? authorizationCode)
    {
        return (authorizationCode ?? "").Trim();
    }

    public static bool ShouldClearAfterBindAttempt(string authorizationCode)
    {
        return !string.IsNullOrWhiteSpace(authorizationCode);
    }
}
