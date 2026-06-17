namespace EISCore.Collector.Services;

public static class MimeTypeService
{
    private static readonly IReadOnlyDictionary<string, string> KnownTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            [".xls"] = "application/vnd.ms-excel",
            [".csv"] = "text/csv",
            [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            [".doc"] = "application/msword",
            [".pdf"] = "application/pdf",
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
            [".bmp"] = "image/bmp",
            [".gif"] = "image/gif",
            [".webp"] = "image/webp",
            [".txt"] = "text/plain",
            [".zip"] = "application/zip",
            [".rar"] = "application/vnd.rar",
            [".7z"] = "application/x-7z-compressed"
        };

    public static string Resolve(string filePath)
    {
        var extension = Path.GetExtension(filePath);
        return KnownTypes.TryGetValue(extension, out var mimeType)
            ? mimeType
            : "application/octet-stream";
    }
}
