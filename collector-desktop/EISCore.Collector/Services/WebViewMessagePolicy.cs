using System.Globalization;
using System.Text.Json;

namespace EISCore.Collector.Services;

public static class WebViewMessagePolicy
{
    public static string ReadString(JsonElement root, string propertyName, string fallback = "")
    {
        return root.TryGetProperty(propertyName, out var element)
            ? ReadString(element, fallback)
            : fallback;
    }

    public static string ReadContextString(JsonElement root, string propertyName, string fallback = "")
    {
        return root.TryGetProperty(propertyName, out var element)
            ? ReadContextString(element, fallback)
            : fallback;
    }

    public static int? ReadStatusCode(JsonElement root, string propertyName = "statusCode")
    {
        if (!root.TryGetProperty(propertyName, out var element))
        {
            return null;
        }

        int? parsed = element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var value) => value,
            JsonValueKind.String when int.TryParse(
                element.GetString()?.Trim(),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var value) => value,
            _ => null
        };

        return parsed is >= 0 and <= 999 ? parsed : null;
    }

    private static string ReadString(JsonElement element, string fallback)
    {
        try
        {
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString() ?? fallback,
                JsonValueKind.Number => element.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Object => element.GetRawText(),
                JsonValueKind.Array => element.GetRawText(),
                _ => fallback
            };
        }
        catch
        {
            return fallback;
        }
    }

    private static string ReadContextString(JsonElement element, string fallback)
    {
        try
        {
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString()?.Trim() ?? fallback,
                JsonValueKind.Number => element.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Object => ReadContextObject(element, fallback),
                JsonValueKind.Array => ReadContextArray(element, fallback),
                _ => fallback
            };
        }
        catch
        {
            return fallback;
        }
    }

    private static string ReadContextObject(JsonElement element, string fallback)
    {
        foreach (var propertyName in new[]
        {
            "name", "displayName", "display_name", "realName", "real_name",
            "username", "roleName", "role_name", "role", "positionName",
            "position_name", "jobTitle", "job_title", "title", "code", "value"
        })
        {
            if (!element.TryGetProperty(propertyName, out var nested)) continue;

            var value = ReadContextString(nested, "");
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return fallback;
    }

    private static string ReadContextArray(JsonElement element, string fallback)
    {
        var values = new List<string>();
        foreach (var item in element.EnumerateArray())
        {
            if (values.Count >= 8) break;

            var value = ReadContextString(item, "").Trim();
            if (string.IsNullOrWhiteSpace(value)) continue;
            if (values.Any(existing => string.Equals(existing, value, StringComparison.OrdinalIgnoreCase))) continue;

            values.Add(value);
        }

        return values.Count > 0 ? string.Join(", ", values) : fallback;
    }
}
