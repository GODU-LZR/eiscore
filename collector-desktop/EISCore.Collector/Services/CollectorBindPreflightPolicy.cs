namespace EISCore.Collector.Services;

public sealed record CollectorBindPreflightState(
    bool CanBind,
    string AuthorizationCode,
    string StatusMessage,
    bool ShouldClearAuthorizationCode);

public static class CollectorBindPreflightPolicy
{
    public static CollectorBindPreflightState Evaluate(string? serverBaseUrl, string? authorizationCode)
    {
        var serverAddress = CollectorServerAddressPolicy.Evaluate(serverBaseUrl, requireNonEmpty: true);
        if (!serverAddress.IsValid)
        {
            return new CollectorBindPreflightState(false, "", serverAddress.StatusMessage, false);
        }

        var normalizedCode = CollectorAuthorizationCodePolicy.Normalize(authorizationCode);
        if (string.IsNullOrWhiteSpace(normalizedCode))
        {
            return new CollectorBindPreflightState(false, "", "请输入设备授权码。", false);
        }

        return new CollectorBindPreflightState(
            true,
            normalizedCode,
            "",
            CollectorAuthorizationCodePolicy.ShouldClearAfterBindAttempt(normalizedCode));
    }
}
