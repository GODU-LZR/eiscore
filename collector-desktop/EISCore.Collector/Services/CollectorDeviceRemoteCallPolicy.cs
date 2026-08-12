using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorDeviceRemoteCallState(bool CanCall, string StatusMessage, string Reason);

public static class CollectorDeviceRemoteCallPolicy
{
    public static CollectorDeviceRemoteCallState EvaluateHeartbeat(AppConfig config, string deviceToken)
    {
        return EvaluateBase(config, deviceToken, "心跳上报");
    }

    public static CollectorDeviceRemoteCallState EvaluateConfigSync(AppConfig config, string deviceToken)
    {
        if (CollectorDeviceAccessPolicy.IsDisabled(config))
        {
            return new CollectorDeviceRemoteCallState(false, "设备已被后台禁用，远程配置同步已暂停。", "device_disabled");
        }

        if (CollectorDeviceAccessPolicy.IsPending(config))
        {
            return new CollectorDeviceRemoteCallState(false, "设备待绑定，远程配置同步等待重新绑定后继续。", "binding_required");
        }

        return EvaluateBase(config, deviceToken, "远程配置同步");
    }

    private static CollectorDeviceRemoteCallState EvaluateBase(
        AppConfig config,
        string deviceToken,
        string actionName)
    {
        if (string.IsNullOrWhiteSpace(config.ServerBaseUrl))
        {
            return new CollectorDeviceRemoteCallState(false, "请先配置服务器地址。", "missing_server_address");
        }

        var serverAddress = CollectorServerAddressPolicy.Evaluate(config.ServerBaseUrl, requireNonEmpty: true);
        if (!serverAddress.IsValid)
        {
            return new CollectorDeviceRemoteCallState(false, serverAddress.StatusMessage, "invalid_server_address");
        }

        if (string.IsNullOrWhiteSpace(deviceToken))
        {
            return new CollectorDeviceRemoteCallState(false, $"设备未绑定或认证已失效，{actionName}已暂停。", "missing_device_token");
        }

        return new CollectorDeviceRemoteCallState(true, $"{actionName}可执行。", "");
    }
}
