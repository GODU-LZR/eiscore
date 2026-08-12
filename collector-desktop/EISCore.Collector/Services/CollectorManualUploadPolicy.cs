using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorManualUploadState(bool CanProcess, string StatusMessage);

public static class CollectorManualUploadPolicy
{
    public static CollectorManualUploadState Evaluate(AppConfig config, string deviceToken)
    {
        if (CollectorDeviceAccessPolicy.IsDisabled(config))
        {
            return new CollectorManualUploadState(false, "设备已被后台禁用，上传队列已暂停。");
        }

        if (CollectorDeviceAccessPolicy.IsPending(config))
        {
            return new CollectorManualUploadState(false, "设备待绑定，请重新绑定后再上传。");
        }

        var serverAddress = CollectorServerAddressPolicy.Evaluate(config.ServerBaseUrl, requireNonEmpty: true);
        if (!serverAddress.IsValid)
        {
            return new CollectorManualUploadState(false, serverAddress.StatusMessage);
        }

        if (string.IsNullOrWhiteSpace(deviceToken))
        {
            return new CollectorManualUploadState(false, "设备未绑定或认证已失效，请先绑定设备。");
        }

        return new CollectorManualUploadState(true, "正在处理上传队列...");
    }
}
