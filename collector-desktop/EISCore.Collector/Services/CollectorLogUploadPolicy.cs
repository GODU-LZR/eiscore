using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorLogUploadState(bool CanUpload, string StatusMessage, string Reason);

public static class CollectorLogUploadPolicy
{
    public static CollectorLogUploadState Evaluate(AppConfig config, string deviceToken)
    {
        if (!config.LogCollectionEnabled)
        {
            return new CollectorLogUploadState(false, "客户端日志采集已由后台策略停用。", "log_collection_disabled");
        }

        if (CollectorDeviceAccessPolicy.IsDisabled(config))
        {
            return new CollectorLogUploadState(false, "设备已被后台禁用，日志补传已暂停。", "device_disabled");
        }

        if (CollectorDeviceAccessPolicy.IsPending(config))
        {
            return new CollectorLogUploadState(false, "设备待绑定，日志补传等待重新绑定后继续。", "binding_required");
        }

        var serverAddress = CollectorServerAddressPolicy.Evaluate(config.ServerBaseUrl, requireNonEmpty: true);
        if (!serverAddress.IsValid)
        {
            return new CollectorLogUploadState(false, serverAddress.StatusMessage, "invalid_server_address");
        }

        if (string.IsNullOrWhiteSpace(deviceToken))
        {
            return new CollectorLogUploadState(false, "设备未绑定或认证已失效，日志补传已暂停。", "missing_device_token");
        }

        return new CollectorLogUploadState(true, "正在补传客户端日志...", "");
    }
}
