namespace EISCore.Collector.Services;

public sealed record CollectorUpdateInstallerArgumentsState(
    bool IsValid,
    string Arguments,
    string StatusMessage,
    string Reason);

public static class CollectorUpdateInstallerArgumentsPolicy
{
    private const int MaxArgumentsLength = 512;

    public static CollectorUpdateInstallerArgumentsState Evaluate(
        string? manifestArguments,
        string? configArguments,
        bool autoInstallRequested)
    {
        var selected = string.IsNullOrWhiteSpace(configArguments)
            ? (manifestArguments ?? "").Trim()
            : (configArguments ?? "").Trim();

        if (!autoInstallRequested)
        {
            return new CollectorUpdateInstallerArgumentsState(true, selected, "", "");
        }

        if (selected.Length > MaxArgumentsLength)
        {
            return new CollectorUpdateInstallerArgumentsState(
                false,
                "",
                "自动安装参数过长。",
                "installer_arguments_too_long");
        }

        if (selected.Any(char.IsControl))
        {
            return new CollectorUpdateInstallerArgumentsState(
                false,
                "",
                "自动安装参数包含不允许的控制字符。",
                "invalid_installer_arguments");
        }

        return new CollectorUpdateInstallerArgumentsState(true, selected, "", "");
    }
}
