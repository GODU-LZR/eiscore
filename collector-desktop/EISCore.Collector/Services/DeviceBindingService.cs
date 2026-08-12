using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class DeviceBindingService
{
    private readonly CollectorApiClient _apiClient;
    private readonly ConfigurationService _configurationService;

    public DeviceBindingService(CollectorApiClient apiClient, ConfigurationService configurationService)
    {
        _apiClient = apiClient;
        _configurationService = configurationService;
    }

    public async Task<AppConfig> BindAsync(
        AppConfig config,
        string authorizationCode,
        CancellationToken cancellationToken = default)
    {
        var response = await _apiClient.BindDeviceAsync(
            config.ServerBaseUrl,
            new DeviceBindRequest
            {
                EnterpriseCode = config.EnterpriseCode,
                DeviceCode = config.DeviceCode,
                DeviceName = config.DeviceName,
                DefaultUserId = config.DefaultUserId,
                DefaultUsername = config.DefaultUsername,
                DefaultRole = config.DefaultRole,
                AuthorizationCode = authorizationCode,
                WindowsUsername = Environment.UserDomainName + "\\" + Environment.UserName,
                ClientVersion = config.ClientVersion,
                WebViewVersion = config.WebViewVersion
            },
            cancellationToken);

        ValidateBindResponse(response);
        config.DeviceId = response.DeviceId;
        config.DeviceCode = string.IsNullOrWhiteSpace(response.DeviceCode) ? config.DeviceCode : response.DeviceCode;
        config.DeviceName = string.IsNullOrWhiteSpace(response.DeviceName) ? config.DeviceName : response.DeviceName;
        config.DefaultUserId = string.IsNullOrWhiteSpace(response.DefaultUserId) ? config.DefaultUserId : response.DefaultUserId;
        config.DefaultUsername = string.IsNullOrWhiteSpace(response.DefaultUsername) ? config.DefaultUsername : response.DefaultUsername;
        config.DefaultRole = string.IsNullOrWhiteSpace(response.DefaultRole) ? config.DefaultRole : response.DefaultRole;
        config.EncryptedDeviceToken = _configurationService.ProtectToken(response.DeviceToken);
        config.DeviceStatus = "active";
        config.LastBoundAt = DateTimeOffset.Now;

        await _configurationService.SaveAsync(config, cancellationToken);
        return config;
    }

    private static void ValidateBindResponse(DeviceBindResponse response)
    {
        var missingFields = new List<string>();
        if (string.IsNullOrWhiteSpace(response.DeviceId)) missingFields.Add("deviceId");
        if (string.IsNullOrWhiteSpace(response.DeviceToken)) missingFields.Add("deviceToken");

        if (missingFields.Count > 0)
        {
            throw new InvalidOperationException($"设备绑定接口响应缺少必需字段：{string.Join(", ", missingFields)}。");
        }
    }
}
