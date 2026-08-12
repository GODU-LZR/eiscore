using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class CollectorWebLoginOwnerDefaults
{
    public string EnterpriseCode { get; set; } = "";
    public string DefaultUserId { get; set; } = "";
    public string DefaultUsername { get; set; } = "";
    public string DefaultRole { get; set; } = "";

    public bool HasAny =>
        !string.IsNullOrWhiteSpace(EnterpriseCode)
        || !string.IsNullOrWhiteSpace(DefaultUserId)
        || !string.IsNullOrWhiteSpace(DefaultUsername)
        || !string.IsNullOrWhiteSpace(DefaultRole);
}

public sealed class CollectorWebLoginOwnerDisplayStatus
{
    public string State { get; set; } = "missing_context";
    public string HintText { get; set; } = "未同步，可在右侧登录后点击刷新同步。";
    public string SyncButtonText { get; set; } = "刷新网页登录用户";
    public string HintForeground { get; set; } = "#64748B";
}

public static class CollectorWebLoginOwnerDefaultPolicy
{
    public static CollectorWebLoginOwnerDefaults Resolve(UploadOwnerContext? owner)
    {
        if (owner?.HasContext != true)
        {
            return new CollectorWebLoginOwnerDefaults();
        }

        return new CollectorWebLoginOwnerDefaults
        {
            EnterpriseCode = FirstNonEmpty(owner.TenantId, owner.TenantName),
            DefaultUserId = FirstNonEmpty(owner.UserId),
            DefaultUsername = FirstNonEmpty(owner.Username),
            DefaultRole = FirstNonEmpty(owner.Role, owner.DepartmentName)
        };
    }

    public static bool Apply(AppConfig config, UploadOwnerContext? owner, bool overwrite)
    {
        var values = Resolve(owner);
        if (!values.HasAny) return false;

        var changed = false;
        changed |= ApplyValue(
            value => config.EnterpriseCode = value,
            config.EnterpriseCode,
            values.EnterpriseCode,
            overwrite);
        changed |= ApplyValue(
            value => config.DefaultUserId = value,
            config.DefaultUserId,
            values.DefaultUserId,
            overwrite);
        changed |= ApplyValue(
            value => config.DefaultUsername = value,
            config.DefaultUsername,
            values.DefaultUsername,
            overwrite);
        changed |= ApplyValue(
            value => config.DefaultRole = value,
            config.DefaultRole,
            values.DefaultRole,
            overwrite);
        return changed;
    }

    public static CollectorWebLoginOwnerDisplayStatus ResolveDisplayStatus(UploadOwnerContext? owner, AppConfig config)
    {
        if (owner?.HasContext != true)
        {
            return new CollectorWebLoginOwnerDisplayStatus();
        }

        var values = Resolve(owner);
        if (!values.HasAny)
        {
            return new CollectorWebLoginOwnerDisplayStatus
            {
                State = "missing_identity",
                HintText = "已连接网页登录，但未识别到可用于上传归属的用户或租户信息。",
                SyncButtonText = "重新识别网页登录用户",
                HintForeground = "#B45309"
            };
        }

        if (HasConflict(config.EnterpriseCode, values.EnterpriseCode)
            || HasConflict(config.DefaultUserId, values.DefaultUserId)
            || HasConflict(config.DefaultUsername, values.DefaultUsername)
            || HasConflict(config.DefaultRole, values.DefaultRole))
        {
            return new CollectorWebLoginOwnerDisplayStatus
            {
                State = "manual_override",
                HintText = "已手动覆盖：默认上传配置与网页登录用户不同，点击同步可覆盖。",
                SyncButtonText = "覆盖为网页登录用户",
                HintForeground = "#B45309"
            };
        }

        if (CanFill(config.EnterpriseCode, values.EnterpriseCode)
            || CanFill(config.DefaultUserId, values.DefaultUserId)
            || CanFill(config.DefaultUsername, values.DefaultUsername)
            || CanFill(config.DefaultRole, values.DefaultRole))
        {
            return new CollectorWebLoginOwnerDisplayStatus
            {
                State = "pending_auto_save",
                HintText = "未保存：已获取网页登录用户，缺失的默认上传配置将自动保存。",
                SyncButtonText = "自动保存中",
                HintForeground = "#2563EB"
            };
        }

        return new CollectorWebLoginOwnerDisplayStatus
        {
            State = "auto_saved",
            HintText = owner.HasIdentity
                ? "已自动保存：手动采集会优先使用当前网页登录用户。"
                : "已自动保存：租户已同步，默认上传人仍使用设备配置。",
            SyncButtonText = "刷新网页登录用户",
            HintForeground = "#047857"
        };
    }

    private static bool ApplyValue(Action<string> assign, string currentValue, string nextValue, bool overwrite)
    {
        var next = (nextValue ?? "").Trim();
        if (string.IsNullOrWhiteSpace(next)) return false;
        if (!overwrite && !string.IsNullOrWhiteSpace(currentValue)) return false;
        if (string.Equals((currentValue ?? "").Trim(), next, StringComparison.Ordinal)) return false;

        assign(next);
        return true;
    }

    private static bool CanFill(string currentValue, string nextValue)
    {
        return string.IsNullOrWhiteSpace(currentValue)
            && !string.IsNullOrWhiteSpace(nextValue);
    }

    private static bool HasConflict(string currentValue, string nextValue)
    {
        var current = (currentValue ?? "").Trim();
        var next = (nextValue ?? "").Trim();
        return !string.IsNullOrWhiteSpace(current)
            && !string.IsNullOrWhiteSpace(next)
            && !string.Equals(current, next, StringComparison.Ordinal);
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return "";
    }
}
