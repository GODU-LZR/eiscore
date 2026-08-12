using System.Text.Json;
using System.Text;

namespace EISCore.Collector.Services;

public static class ClientLogMetadata
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = new SnakeCaseLowerNamingPolicy()
    };

    public static string Serialize<T>(T value)
    {
        try
        {
            return JsonSerializer.Serialize(value, JsonOptions);
        }
        catch
        {
            return "{}";
        }
    }

    private sealed class SnakeCaseLowerNamingPolicy : JsonNamingPolicy
    {
        public override string ConvertName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;

            var builder = new StringBuilder(name.Length + 8);
            for (var index = 0; index < name.Length; index++)
            {
                var current = name[index];
                if (char.IsUpper(current))
                {
                    if (index > 0 && builder.Length > 0 && builder[^1] != '_')
                    {
                        builder.Append('_');
                    }

                    builder.Append(char.ToLowerInvariant(current));
                    continue;
                }

                builder.Append(current);
            }

            return builder.ToString();
        }
    }
}
