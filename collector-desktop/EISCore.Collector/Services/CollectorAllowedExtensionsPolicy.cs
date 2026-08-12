namespace EISCore.Collector.Services;

public static class CollectorAllowedExtensionsPolicy
{
    private const int MaxExtensionLength = 31;
    private const int MaxExtensions = 128;

    public static List<string> Normalize(IEnumerable<string>? extensions)
    {
        return (extensions ?? Enumerable.Empty<string>())
            .Select(NormalizeExtension)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .Take(MaxExtensions)
            .ToList();
    }

    private static string NormalizeExtension(string? extension)
    {
        var value = StripControlCharacters(extension).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        if (value.StartsWith('.'))
        {
            value = value[1..];
        }

        if (value.Length is < 1 or > MaxExtensionLength || value.Any(ch => !IsAsciiLetterOrDigit(ch)))
        {
            return "";
        }

        return "." + value;
    }

    private static bool IsAsciiLetterOrDigit(char ch)
    {
        return ch is >= 'a' and <= 'z' or >= '0' and <= '9';
    }

    private static string StripControlCharacters(string? value)
    {
        return new string((value ?? "")
            .Trim()
            .Where(ch => !char.IsControl(ch))
            .ToArray());
    }
}
